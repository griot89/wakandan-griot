const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\nWakanda Forever! 🐾\n');
});