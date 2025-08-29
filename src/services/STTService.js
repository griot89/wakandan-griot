/**
 * STT (Speech-to-Text) Service using Google Gemini
 * Handles audio file transcription for voice input
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class STTService {
    constructor() {
        this.apiKey = process.env.GOOGLE_API_KEY;
        if (!this.apiKey) {
            console.warn('⚠️  STT Service: Google API key not found. STT functionality will be disabled.');
        }
        
        // Initialize Gemini AI for speech processing
        this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
        
        // Supported audio formats
        this.supportedFormats = [
            'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 
            'audio/webm', 'audio/flac', 'audio/aac'
        ];
        
        // Maximum file size (10MB)
        this.maxFileSize = 10 * 1024 * 1024;
    }

    /**
     * Check if STT service is available
     */
    isAvailable() {
        return !!this.genAI;
    }

    /**
     * Validate audio file
     */
    validateAudioFile(file) {
        const errors = [];
        
        if (!file) {
            errors.push('No audio file provided');
            return errors;
        }
        
        // Check file size
        if (file.size > this.maxFileSize) {
            errors.push(`File size too large. Maximum allowed: ${this.maxFileSize / (1024 * 1024)}MB`);
        }
        
        // Check mime type
        if (!this.supportedFormats.includes(file.mimetype)) {
            errors.push(`Unsupported audio format: ${file.mimetype}. Supported: ${this.supportedFormats.join(', ')}`);
        }
        
        return errors;
    }

    /**
     * Convert audio file to base64 for Gemini
     */
    async prepareAudioData(filePath, mimeType) {
        try {
            const audioBuffer = fs.readFileSync(filePath);
            const base64Audio = audioBuffer.toString('base64');
            
            return {
                inlineData: {
                    data: base64Audio,
                    mimeType: mimeType
                }
            };
        } catch (error) {
            throw new Error(`Failed to prepare audio data: ${error.message}`);
        }
    }

    /**
     * Transcribe audio using Gemini
     */
    async transcribeAudio(filePath, mimeType, options = {}) {
        if (!this.isAvailable()) {
            throw new Error('STT Service not available: Missing Google API key');
        }

        try {
            console.log('🎤 Starting audio transcription...');
            
            // Prepare audio data
            const audioPart = await this.prepareAudioData(filePath, mimeType);
            
            // Use Gemini 1.5 Flash for audio processing
            const model = this.genAI.getGenerativeModel({ 
                model: 'gemini-1.5-flash',
                generationConfig: {
                    temperature: 0.1, // Low temperature for accurate transcription
                }
            });

            // Create prompt for transcription
            const prompt = options.language 
                ? `Please transcribe this audio file to text in ${options.language}. Return only the transcribed text without any additional commentary.`
                : 'Please transcribe this audio file to text. Return only the transcribed text without any additional commentary.';

            // Send request to Gemini
            const result = await model.generateContent([prompt, audioPart]);
            const response = await result.response;
            const transcription = response.text().trim();

            console.log('✅ Audio transcription completed');
            
            return {
                success: true,
                transcription: transcription,
                confidence: 0.95, // Gemini doesn't provide confidence scores, so we use a high default
                language: options.language || 'auto-detected',
                duration: null, // Could be calculated if needed
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ STT transcription error:', error);
            
            return {
                success: false,
                error: error.message,
                transcription: null,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Process uploaded audio file and return transcription
     */
    async processAudioFile(file, options = {}) {
        // Validate the file
        const validationErrors = this.validateAudioFile(file);
        if (validationErrors.length > 0) {
            return {
                success: false,
                error: `Validation failed: ${validationErrors.join(', ')}`,
                transcription: null
            };
        }

        let tempFilePath = null;
        
        try {
            // Save uploaded file temporarily
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const fileExtension = path.extname(file.originalname) || '.tmp';
            tempFilePath = path.join(tempDir, fileName + fileExtension);
            
            // Write buffer to temporary file
            fs.writeFileSync(tempFilePath, file.buffer);
            
            // Transcribe the audio
            const result = await this.transcribeAudio(tempFilePath, file.mimetype, options);
            
            return result;
            
        } catch (error) {
            console.error('❌ Error processing audio file:', error);
            return {
                success: false,
                error: `Processing failed: ${error.message}`,
                transcription: null
            };
        } finally {
            // Clean up temporary file
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    console.log('🧹 Cleaned up temporary audio file');
                } catch (cleanupError) {
                    console.warn('⚠️  Failed to clean up temporary file:', cleanupError.message);
                }
            }
        }
    }

    /**
     * Get STT service info and capabilities
     */
    getServiceInfo() {
        return {
            name: 'G Assistant STT Service',
            provider: 'Google Gemini 1.5 Flash',
            available: this.isAvailable(),
            supportedFormats: this.supportedFormats,
            maxFileSize: this.maxFileSize,
            capabilities: {
                languages: ['auto-detect', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
                realTime: false, // This implementation is file-based, not real-time
                confidence: false, // Gemini doesn't provide confidence scores
                timestamps: false, // Word-level timestamps not implemented
                speakerDiarization: false // Not implemented in this version
            }
        };
    }

    /**
     * Health check for the STT service
     */
    async healthCheck() {
        if (!this.isAvailable()) {
            return {
                status: 'unhealthy',
                message: 'STT Service unavailable: Missing Google API key',
                timestamp: new Date().toISOString()
            };
        }

        try {
            // Test with a minimal request to check API connectivity
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent('Health check');
            
            return {
                status: 'healthy',
                message: 'STT Service is operational',
                provider: 'Google Gemini 1.5 Flash',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `STT Service error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = STTService;