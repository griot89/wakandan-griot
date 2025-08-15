const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'Z8dg0fyk7p6js7cQ7lgi';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'Wakandan Griot',
        timestamp: new Date().toISOString(),
        vibraniumLevel: '100%'
    });
});

// API endpoint for text-to-speech using ElevenLabs
app.post('/api/tts/elevenlabs', async (req, res) => {
    const { text, voiceSettings = {} } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }
    
    // If no API key is configured, return a message
    if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY === 'your_api_key_here') {
        return res.status(503).json({ 
            error: 'ElevenLabs API not configured',
            message: 'Please add your ElevenLabs API key to the .env file',
            voiceId: ELEVENLABS_VOICE_ID
        });
    }
    
    try {
        // ElevenLabs API request
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
            {
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: voiceSettings.stability || 0.75,
                    similarity_boost: voiceSettings.similarity_boost || 0.75,
                    style: voiceSettings.style || 0.5,
                    use_speaker_boost: true
                }
            },
            {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY
                },
                responseType: 'arraybuffer'
            }
        );
        
        // Convert to base64 for easier client-side handling
        const audioBase64 = Buffer.from(response.data).toString('base64');
        
        res.json({
            success: true,
            audio: `data:audio/mpeg;base64,${audioBase64}`,
            voiceId: ELEVENLABS_VOICE_ID
        });
    } catch (error) {
        console.error('ElevenLabs API error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to generate speech',
            message: error.response?.data?.detail?.message || error.message
        });
    }
});

// API endpoint for Griot wisdom (can be extended with AI integration)
app.post('/api/griot/wisdom', (req, res) => {
    const { message } = req.body;
    
    // Simulated Griot response - this could be connected to an AI service
    const responses = {
        greetings: [
            "Greetings, Friend. The ancestors smile upon our meeting.",
            "Welcome, honored one. The Vibranium network acknowledges you.",
            "Blessings of the Black Panther upon you."
        ],
        wakanda: [
            "Wakanda is more than a nation - it is the future realized.",
            "Our technology grows from the earth itself, guided by Vibranium.",
            "Wakanda Forever is not just a salute - it is a promise."
        ],
        default: [
            "Your query travels through the sacred networks of Wakanda.",
            "The Vibranium network processes your request with ancient wisdom.",
            "I hear your question, Friend. The answer emerges from quantum possibility."
        ]
    };
    
    let responseCategory = 'default';
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('hello') || msgLower.includes('hi')) {
        responseCategory = 'greetings';
    } else if (msgLower.includes('wakanda')) {
        responseCategory = 'wakanda';
    }
    
    const categoryResponses = responses[responseCategory];
    const response = categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
    
    res.json({ 
        response,
        timestamp: new Date().toISOString(),
        processedBy: 'Vibranium-Network-v2.0'
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║        WAKANDAN GRIOT SERVER ACTIVE            ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  Vibranium Network Status: ONLINE              ║`);
    console.log(`║  Service Port: ${PORT}                            ║`);
    console.log(`║  Local URL: http://localhost:${PORT}              ║`);
    console.log('║  API Endpoints:                                ║');
    console.log('║    - GET  /health                              ║');
    console.log('║    - POST /api/griot/wisdom                    ║');
    console.log('║    - POST /api/tts/elevenlabs                  ║');
    console.log('║  ElevenLabs Voice ID: ' + ELEVENLABS_VOICE_ID.substring(0, 8) + '...       ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\nWakanda Forever! 🐾\n');
});