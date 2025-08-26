/**
 * Real-Time Voice Service for G Assistant
 * Handles WebSocket connections for real-time voice communication
 * Integrates STT and TTS for live voice interaction
 */

const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

class RealTimeVoiceService {
    constructor(server, sttService, memoryManager, aiOrchestrator) {
        this.server = server;
        this.sttService = sttService;
        this.memoryManager = memoryManager;
        this.aiOrchestrator = aiOrchestrator;
        
        // Initialize Socket.IO with CORS configuration
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: false
            },
            transports: ['websocket', 'polling']
        });
        
        // Active voice sessions
        this.activeSessions = new Map();
        
        // Audio chunk buffer for each session
        this.audioBuffers = new Map();
        
        // Configuration
        this.config = {
            maxAudioChunkSize: 1024 * 1024, // 1MB
            audioChunkTimeout: 5000, // 5 seconds
            maxSessionDuration: 30 * 60 * 1000, // 30 minutes
            supportedFormats: ['audio/webm', 'audio/wav', 'audio/ogg'],
        };
        
        this.setupEventHandlers();
        console.log('🎙️ Real-time Voice Service initialized');
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔗 Voice client connected: ${socket.id}`);
            
            // Initialize session
            this.activeSessions.set(socket.id, {
                startTime: Date.now(),
                isRecording: false,
                conversationHistory: [],
                preferences: {}
            });
            
            // Handle voice session start
            socket.on('start_voice_session', (data) => {
                this.handleStartVoiceSession(socket, data);
            });
            
            // Handle audio chunk received from client
            socket.on('audio_chunk', (data) => {
                this.handleAudioChunk(socket, data);
            });
            
            // Handle end of audio stream
            socket.on('audio_end', (data) => {
                this.handleAudioEnd(socket, data);
            });
            
            // Handle voice settings update
            socket.on('update_voice_settings', (data) => {
                this.handleVoiceSettings(socket, data);
            });
            
            // Handle manual text input (fallback)
            socket.on('text_message', (data) => {
                this.handleTextMessage(socket, data);
            });
            
            // Handle session management
            socket.on('pause_session', () => {
                this.handlePauseSession(socket);
            });
            
            socket.on('resume_session', () => {
                this.handleResumeSession(socket);
            });
            
            // Handle disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
            
            // Send initial capabilities
            socket.emit('voice_capabilities', {
                stt: this.sttService.getServiceInfo(),
                realTime: true,
                supportedFormats: this.config.supportedFormats,
                maxChunkSize: this.config.maxAudioChunkSize
            });
        });
    }

    handleStartVoiceSession(socket, data) {
        const session = this.activeSessions.get(socket.id);
        if (!session) return;
        
        console.log(`🎤 Starting voice session for ${socket.id}`);
        
        session.isRecording = true;
        session.preferences = { ...session.preferences, ...data.preferences };
        
        // Initialize audio buffer for this session
        this.audioBuffers.set(socket.id, []);
        
        socket.emit('voice_session_started', {
            sessionId: socket.id,
            status: 'recording',
            timestamp: new Date().toISOString()
        });
        
        // Set session timeout
        session.timeout = setTimeout(() => {
            this.handleSessionTimeout(socket);
        }, this.config.maxSessionDuration);
    }

    async handleAudioChunk(socket, data) {
        const session = this.activeSessions.get(socket.id);
        if (!session || !session.isRecording) return;
        
        try {
            const { audioData, format, sequenceId } = data;
            
            if (!this.config.supportedFormats.includes(format)) {
                socket.emit('voice_error', {
                    error: `Unsupported audio format: ${format}`,
                    code: 'UNSUPPORTED_FORMAT'
                });
                return;
            }
            
            // Get or create audio buffer for this session
            let buffer = this.audioBuffers.get(socket.id) || [];
            
            // Convert base64 to buffer if needed
            const chunkBuffer = typeof audioData === 'string' 
                ? Buffer.from(audioData, 'base64') 
                : Buffer.from(audioData);
                
            buffer.push({
                data: chunkBuffer,
                sequenceId: sequenceId || Date.now(),
                format: format,
                timestamp: Date.now()
            });
            
            this.audioBuffers.set(socket.id, buffer);
            
            // Acknowledge chunk received
            socket.emit('audio_chunk_ack', {
                sequenceId: sequenceId,
                received: true,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error handling audio chunk:', error);
            socket.emit('voice_error', {
                error: 'Failed to process audio chunk',
                details: error.message,
                code: 'PROCESSING_ERROR'
            });
        }
    }

    async handleAudioEnd(socket, data) {
        const session = this.activeSessions.get(socket.id);
        if (!session) return;
        
        console.log(`🎤 Audio ended for ${socket.id}, processing...`);
        
        try {
            // Get accumulated audio buffer
            const audioBuffer = this.audioBuffers.get(socket.id) || [];
            
            if (audioBuffer.length === 0) {
                socket.emit('voice_error', {
                    error: 'No audio data received',
                    code: 'NO_AUDIO_DATA'
                });
                return;
            }
            
            // Combine all audio chunks
            const combinedBuffer = Buffer.concat(audioBuffer.map(chunk => chunk.data));
            const format = audioBuffer[0].format;
            
            // Clear the buffer
            this.audioBuffers.set(socket.id, []);
            
            // Create temporary file for STT processing
            const tempFilePath = await this.createTempAudioFile(combinedBuffer, format);
            
            // Emit processing status
            socket.emit('voice_processing', {
                status: 'transcribing',
                message: 'Converting speech to text...'
            });
            
            // Process with STT service
            const sttResult = await this.sttService.transcribeAudio(
                tempFilePath, 
                format, 
                session.preferences
            );
            
            // Clean up temp file
            this.cleanupTempFile(tempFilePath);
            
            if (sttResult.success && sttResult.transcription) {
                console.log(`📝 Transcribed: "${sttResult.transcription}"`);
                
                // Store in memory
                this.memoryManager.addMessage('user', sttResult.transcription, 'voice_input');
                
                // Emit transcription result
                socket.emit('transcription_result', {
                    transcription: sttResult.transcription,
                    confidence: sttResult.confidence,
                    language: sttResult.language,
                    timestamp: sttResult.timestamp
                });
                
                // Process with AI and generate response
                await this.processAIResponse(socket, sttResult.transcription);
                
            } else {
                socket.emit('voice_error', {
                    error: 'Transcription failed',
                    details: sttResult.error,
                    code: 'TRANSCRIPTION_FAILED'
                });
            }
            
        } catch (error) {
            console.error('Error processing audio end:', error);
            socket.emit('voice_error', {
                error: 'Failed to process audio',
                details: error.message,
                code: 'PROCESSING_ERROR'
            });
        }
    }

    async processAIResponse(socket, userMessage) {
        try {
            socket.emit('voice_processing', {
                status: 'thinking',
                message: 'G is thinking...'
            });
            
            // Get conversation history
            const history = this.memoryManager.getConversationHistory('main', 10);
            
            // Process with AI
            const aiResponse = await this.aiOrchestrator.processQuery(userMessage, {
                system: "You are G, a helpful AI assistant. Provide concise, natural responses suitable for voice interaction. Avoid long lists or complex formatting.",
                conversationHistory: history,
                source: 'voice-chat'
            });
            
            // Store AI response
            this.memoryManager.addMessage('assistant', aiResponse.content);
            
            // Emit AI response text
            socket.emit('ai_response', {
                response: aiResponse.content,
                timestamp: new Date().toISOString()
            });
            
            // Generate TTS audio for the response
            socket.emit('voice_processing', {
                status: 'speaking',
                message: 'Converting to speech...'
            });
            
            // Note: In a full implementation, you would generate TTS audio here
            // and stream it back to the client. For now, we'll emit the text response.
            socket.emit('voice_response_ready', {
                text: aiResponse.content,
                // audio: audioBuffer, // Would include generated audio
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error processing AI response:', error);
            socket.emit('voice_error', {
                error: 'Failed to generate response',
                details: error.message,
                code: 'AI_PROCESSING_ERROR'
            });
        }
    }

    async handleTextMessage(socket, data) {
        // Fallback for text-based interaction
        const { message } = data;
        
        if (!message) return;
        
        console.log(`💬 Text message from ${socket.id}: ${message}`);
        
        // Store in memory
        this.memoryManager.addMessage('user', message, 'text_input');
        
        // Process with AI
        await this.processAIResponse(socket, message);
    }

    handleVoiceSettings(socket, data) {
        const session = this.activeSessions.get(socket.id);
        if (!session) return;
        
        session.preferences = { ...session.preferences, ...data };
        
        socket.emit('voice_settings_updated', {
            settings: session.preferences,
            timestamp: new Date().toISOString()
        });
    }

    handlePauseSession(socket) {
        const session = this.activeSessions.get(socket.id);
        if (!session) return;
        
        session.isRecording = false;
        
        socket.emit('voice_session_paused', {
            timestamp: new Date().toISOString()
        });
    }

    handleResumeSession(socket) {
        const session = this.activeSessions.get(socket.id);
        if (!session) return;
        
        session.isRecording = true;
        
        socket.emit('voice_session_resumed', {
            timestamp: new Date().toISOString()
        });
    }

    handleSessionTimeout(socket) {
        console.log(`⏱️ Voice session timeout for ${socket.id}`);
        
        socket.emit('voice_session_timeout', {
            message: 'Voice session timed out',
            timestamp: new Date().toISOString()
        });
        
        this.handleDisconnect(socket);
    }

    handleDisconnect(socket) {
        console.log(`🔌 Voice client disconnected: ${socket.id}`);
        
        const session = this.activeSessions.get(socket.id);
        if (session && session.timeout) {
            clearTimeout(session.timeout);
        }
        
        // Clean up session data
        this.activeSessions.delete(socket.id);
        this.audioBuffers.delete(socket.id);
    }

    async createTempAudioFile(audioBuffer, format) {
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const extension = format.split('/')[1] || 'tmp';
        const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
        const filePath = path.join(tempDir, fileName);
        
        fs.writeFileSync(filePath, audioBuffer);
        
        return filePath;
    }

    cleanupTempFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('🧹 Cleaned up temporary audio file');
            }
        } catch (error) {
            console.warn('⚠️ Failed to clean up temporary file:', error.message);
        }
    }

    // Get service statistics
    getServiceStats() {
        return {
            activeSessions: this.activeSessions.size,
            activeBuffers: this.audioBuffers.size,
            configuration: this.config,
            uptime: process.uptime()
        };
    }

    // Broadcast to all connected clients
    broadcast(event, data) {
        this.io.emit(event, data);
    }

    // Send to specific session
    sendToSession(sessionId, event, data) {
        const socket = this.io.sockets.sockets.get(sessionId);
        if (socket) {
            socket.emit(event, data);
        }
    }
}

module.exports = RealTimeVoiceService;