const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Import JARVIS-like AI systems
const MCPManager = require('./src/mcp/MCPManager');
const GeminiAbacusOrchestrator = require('./src/ai/GeminiAbacusOrchestrator');

// Import G Memory System
const MemoryManager = require('./src/memory/MemoryManager');
const createMemoryRoutes = require('./src/memory/memoryRoutes');

const app = express();
const PORT = process.env.PORT || 5050;

// Initialize AI and MCP systems with Google Gemini and Abacus AI
const mcpManager = new MCPManager();
const aiOrchestrator = new GeminiAbacusOrchestrator({
    primaryModel: process.env.GEMINI_MODEL || 'gemini-pro',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.95,
    topK: 40
});

// Initialize G Memory Manager
const memoryManager = new MemoryManager();

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'Z8dg0fyk7p6js7cQ7lgi';

// Initialize JARVIS systems on startup
async function initializeJARVIS() {
    console.log('🚀 Initializing JARVIS-Wakandan Hybrid System...');
    
    try {
        // Initialize MCP connections
        await mcpManager.initialize();
        
        // Set up MCP event listeners
        mcpManager.on('ready', () => {
            console.log('✅ MCP System ready');
        });
        
        mcpManager.on('toolExecuted', (data) => {
            console.log('🔧 Tool executed:', data.tool);
        });
        
        console.log('🤖 JARVIS systems online and ready');
    } catch (error) {
        console.error('⚠️ JARVIS initialization warning:', error.message);
        console.log('📌 Running in limited mode without MCP');
    }
}

// Call initialization
initializeJARVIS();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Memory API routes
app.use('/api/memory', createMemoryRoutes(memoryManager));

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

// Voice info endpoint
app.get('/api/voice', (req, res) => {
    res.json({
        default_voice_id: ELEVENLABS_VOICE_ID,
        configured: !!ELEVENLABS_API_KEY
    });
});

// API endpoint for Griot wisdom - Now enhanced with JARVIS AI
app.post('/api/griot/wisdom', async (req, res) => {
    const { message } = req.body;
    
    try {
        // Use AI Orchestrator for intelligent responses
        const response = await aiOrchestrator.processQuery(message, {
            source: 'griot-api',
            tone: 'wakandan',
            timestamp: new Date().toISOString()
        });
        
        res.json({ 
            response: response.content,
            timestamp: new Date().toISOString(),
            processedBy: 'JARVIS-Vibranium-v3.0',
            metadata: response.metadata
        });
    } catch (error) {
        // Fallback to simulated responses
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
    }
});

// Advanced JARVIS AI endpoint with MCP capabilities
app.post('/api/jarvis/query', async (req, res) => {
    const { query, context = {}, tools = [] } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }
    
    try {
        console.log('🎯 JARVIS Query:', query);
        
        // Store user message in memory
        const userMessageId = memoryManager.addMessage('user', query, 'main');
        
        // Get recent conversation context for AI
        const conversationHistory = memoryManager.getConversationHistory('main', 10);
        
        // Process with AI Orchestrator
        const aiResponse = await aiOrchestrator.processQuery(query, {
            ...context,
            conversationHistory,
            requestedTools: tools,
            source: 'jarvis-api'
        });
        
        // Execute MCP tools if needed
        let toolResults = {};
        if (aiResponse.metadata?.analysis?.requiredTools?.length > 0) {
            for (const tool of aiResponse.metadata.analysis.requiredTools) {
                try {
                    const result = await mcpManager.executeTool(tool, {
                        query,
                        context: aiResponse.metadata.analysis
                    });
                    toolResults[tool] = result;
                } catch (error) {
                    console.error(`Tool execution failed for ${tool}:`, error);
                    toolResults[tool] = { error: error.message };
                }
            }
        }
        
        // Store AI response in memory
        const assistantMessageId = memoryManager.addMessage('assistant', aiResponse.content, 'main', {
            toolResults,
            processingTime: Date.now() - new Date(context.timestamp || Date.now()).getTime()
        });

        res.json({
            success: true,
            response: aiResponse.content,
            metadata: {
                ...aiResponse.metadata,
                toolResults,
                memoryIds: { user: userMessageId, assistant: assistantMessageId },
                processingTime: Date.now() - new Date(context.timestamp || Date.now()).getTime(),
                capabilities: {
                    mcp: mcpManager.servers.size > 0,
                    ai: !aiOrchestrator.useLocalIntelligence,
                    tools: Array.from(mcpManager.tools.keys()),
                    memory: true
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('JARVIS query error:', error);
        res.status(500).json({
            success: false,
            error: 'Processing failed',
            message: error.message,
            fallback: 'I apologize for the inconvenience. My advanced systems are temporarily unavailable, but I can still assist you with basic queries.'
        });
    }
});

// Get JARVIS system status
app.get('/api/jarvis/status', async (req, res) => {
    const status = {
        online: true,
        version: '3.0.0',
        name: 'JARVIS-Wakandan Hybrid',
        capabilities: {
            ai: {
                available: !aiOrchestrator.useLocalIntelligence,
                models: [],
                conversationHistory: aiOrchestrator.conversationHistory.length
            },
            mcp: {
                connected: mcpManager.servers.size > 0,
                servers: Array.from(mcpManager.servers.keys()),
                tools: Array.from(mcpManager.tools.keys()),
                resources: Array.from(mcpManager.resources.keys())
            },
            voice: {
                tts: {
                    elevenlabs: ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== 'your_api_key_here',
                    voiceId: ELEVENLABS_VOICE_ID
                }
            }
        },
        timestamp: new Date().toISOString()
    };
    
    // Add available AI models
    const aiCapabilities = aiOrchestrator.getCapabilities();
    if (aiCapabilities.gemini) {
        status.capabilities.ai.models.push('google-gemini-pro');
    }
    if (aiCapabilities.abacus) {
        status.capabilities.ai.models.push('abacus-ai');
    }
    if (status.capabilities.ai.models.length === 0) {
        status.capabilities.ai.models.push('local-intelligence');
    }
    
    // Add detailed AI status
    status.capabilities.ai.gemini = aiCapabilities.gemini;
    status.capabilities.ai.abacus = aiCapabilities.abacus;
    status.capabilities.ai.primaryModel = aiCapabilities.primaryModel;
    
    res.json(status);
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
        
        // Use the AI orchestrator for G's response
        const aiResponse = await aiOrchestrator.processQuery(message, {
            system: system || "You are G, a helpful, capable personal AI assistant with a warm, concise, optimistic style. Ask before taking impactful actions.",
            conversationHistory: recentMessages,
            source: 'g-assistant'
        });
        
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

// Clear JARVIS conversation history
app.post('/api/jarvis/clear-history', (req, res) => {
    aiOrchestrator.clearHistory();
    res.json({ 
        success: true, 
        message: 'Conversation history cleared',
        timestamp: new Date().toISOString()
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║       JARVIS-WAKANDAN HYBRID SYSTEM ACTIVE        ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  🎯 JARVIS Core: ONLINE                           ║');
    console.log('║  💜 Vibranium Network: OPERATIONAL                ║');
    console.log('║  🤖 AI Systems: READY                             ║');
    console.log('║  🔧 MCP Tools: INITIALIZING                       ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  Service Port: ${PORT}                               ║`);
    console.log(`║  Local URL: http://localhost:${PORT}                 ║`);
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  API Endpoints:                                   ║');
    console.log('║    - GET  /health                                 ║');
    console.log('║    - GET  /api/jarvis/status                      ║');
    console.log('║    - POST /api/griot/wisdom                       ║');
    console.log('║    - POST /api/jarvis/query                       ║');
    console.log('║    - POST /api/jarvis/clear-history               ║');
    console.log('║    - POST /api/tts/elevenlabs                     ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  Voice: ElevenLabs ID: ' + ELEVENLABS_VOICE_ID.substring(0, 8) + '...          ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('\n🚀 "At your service, Sir." - JARVIS');
    console.log('⚡ Wakanda Forever! 🐾\n');
});