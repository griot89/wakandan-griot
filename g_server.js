const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
require('dotenv').config();

// Import G Memory System
const MemoryManager = require('./src/memory/MemoryManager');
const createMemoryRoutes = require('./src/memory/memoryRoutes');

// Import AI and Tools systems
const GeminiAbacusOrchestrator = require('./src/ai/GeminiAbacusOrchestrator');
const FunctionCallingOrchestrator = require('./src/ai/FunctionCallingOrchestrator');
const ToolsManager = require('./src/tools/ToolsManager');

// Import STT Service
const STTService = require('./src/services/STTService');

const app = express();
const PORT = process.env.PORT || 5050;

// Initialize G Memory Manager, Tools, AI, and STT
const memoryManager = new MemoryManager();
const toolsManager = new ToolsManager(memoryManager);
const functionCallingAI = new FunctionCallingOrchestrator({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    temperature: 0.7,
    maxTokens: 2048
});
const fallbackAI = new GeminiAbacusOrchestrator({
    primaryModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    temperature: 0.7,
    maxTokens: 2048
});
const sttService = new STTService();

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'Z8dg0fyk7p6js7cQ7lgi';

// Multer configuration for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg',
            'audio/webm', 'audio/flac', 'audio/aac', 'audio/mpeg'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Memory API routes
app.use('/api/memory', createMemoryRoutes(memoryManager));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'G Assistant',
        timestamp: new Date().toISOString(),
        memory_stats: memoryManager.getStats()
    });
});

// Simple chat endpoint for G Assistant
app.post('/api/chat', async (req, res) => {
    const { message, system } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    try {
        // Store user message in memory
        memoryManager.addMessage('user', message);
        
        // Get recent conversation for context
        const recentMessages = memoryManager.getConversationHistory('main', 10);
        
        // Use function calling AI if available, otherwise fallback
        let aiResponse;
        try {
            aiResponse = await functionCallingAI.processQuery(message, {
                system: system || "You are G, a helpful, capable personal AI assistant with a warm, concise, optimistic style. Ask before taking impactful actions.",
                conversationHistory: recentMessages,
                toolsManager: toolsManager,
                source: 'g-assistant'
            });
        } catch (error) {
            console.log('Function calling failed, using fallback AI:', error.message);
            aiResponse = await fallbackAI.processQuery(message, {
                system: system || "You are G, a helpful, capable personal AI assistant with a warm, concise, optimistic style. Ask before taking impactful actions.",
                conversationHistory: recentMessages,
                source: 'g-assistant'
            });
        }
        
        // Store G's response in memory
        memoryManager.addMessage('assistant', aiResponse.content);
        
        res.json({
            reply: aiResponse.content,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Chat error:', error);
        const fallbackReply = `I encountered an error processing your message. ${error.message}`;
        memoryManager.addMessage('assistant', fallbackReply);
        
        res.json({
            reply: fallbackReply,
            timestamp: new Date().toISOString()
        });
    }
});

// Simple TTS endpoint for G Assistant frontend compatibility
app.post('/api/tts', async (req, res) => {
    const { text, voice_id } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }
    
    // If no API key is configured, return error
    if (!ELEVENLABS_API_KEY) {
        return res.status(500).json({ 
            error: 'ElevenLabs API not configured'
        });
    }
    
    try {
        const voiceId = voice_id || ELEVENLABS_VOICE_ID;
        
        // ElevenLabs API request
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY
                },
                responseType: 'stream'
            }
        );
        
        // Stream the audio response directly to client
        res.setHeader('Content-Type', 'audio/mpeg');
        response.data.pipe(res);
        
    } catch (error) {
        console.error('TTS error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'TTS generation failed',
            details: error.response?.data?.detail?.message || error.message
        });
    }
});

// STT (Speech-to-Text) endpoint
app.post('/api/stt', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No audio file provided' 
            });
        }

        // Get transcription options from request
        const options = {
            language: req.body.language || 'auto',
        };

        console.log(`🎤 Processing STT request for ${req.file.originalname} (${req.file.mimetype})`);

        // Process the audio file
        const result = await sttService.processAudioFile(req.file, options);

        if (result.success) {
            console.log(`✅ STT successful: "${result.transcription}"`);
            
            // Optionally store the transcription in memory as a user message
            if (result.transcription && result.transcription.trim()) {
                memoryManager.addMessage('user', result.transcription, 'voice_input');
            }
        } else {
            console.error(`❌ STT failed: ${result.error}`);
        }

        res.json(result);

    } catch (error) {
        console.error('STT endpoint error:', error);
        
        // Handle multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                error: 'Audio file too large. Maximum size: 10MB'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'STT processing failed',
            details: error.message
        });
    }
});

// STT service info endpoint
app.get('/api/stt/info', (req, res) => {
    res.json(sttService.getServiceInfo());
});

// STT health check endpoint
app.get('/api/stt/health', async (req, res) => {
    const health = await sttService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Combined voice capabilities endpoint
app.get('/api/voice', (req, res) => {
    res.json({
        tts: {
            default_voice_id: ELEVENLABS_VOICE_ID,
            configured: !!ELEVENLABS_API_KEY,
            provider: 'ElevenLabs'
        },
        stt: sttService.getServiceInfo()
    });
});

// Export conversation history endpoint
app.get('/api/export', (req, res) => {
    try {
        const messages = memoryManager.getConversationHistory('main', 1000);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tools API endpoints
app.get('/api/tools', (req, res) => {
    try {
        res.json({
            success: true,
            available_tools: toolsManager.getAvailableTools(),
            tool_definitions: toolsManager.getToolDefinitions(),
            count: toolsManager.tools.size
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/tools/:name', (req, res) => {
    try {
        const toolInfo = toolsManager.getToolInfo(req.params.name);
        if (!toolInfo) {
            return res.status(404).json({ success: false, error: 'Tool not found' });
        }
        res.json({ success: true, tool: toolInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/tools/:name/execute', async (req, res) => {
    try {
        const { parameters } = req.body;
        const result = await toolsManager.executeTool(req.params.name, parameters || {});
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║                G ASSISTANT API                     ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  🤖 G Core: ONLINE                               ║`);
    console.log(`║  🧠 Memory System: OPERATIONAL                   ║`);
    console.log(`║  🎤 TTS Voice: ${ELEVENLABS_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}                   ║`);
    console.log(`║  🗣️  STT Speech: ${sttService.isAvailable() ? 'CONFIGURED' : 'NOT CONFIGURED'}                ║`);
    console.log(`║  🛠️  Function Calling: ENABLED                   ║`);
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  Service Port: ${PORT}                               ║`);
    console.log(`║  Local URL: http://localhost:${PORT}                 ║`);
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  API Endpoints:                                   ║');
    console.log('║    - GET  /health                                 ║');
    console.log('║    - POST /api/chat                               ║');
    console.log('║    - POST /api/tts (text-to-speech)               ║');
    console.log('║    - POST /api/stt (speech-to-text)               ║');
    console.log('║    - GET  /api/voice                              ║');
    console.log('║    - GET  /api/export                             ║');
    console.log('║    - GET  /api/tools (function calling)           ║');
    console.log('║    - /api/memory/* (full memory API)              ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🚀 "Hello, I am G. I can now listen AND speak!"');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down G Assistant...');
    memoryManager.close();
    process.exit(0);
});
