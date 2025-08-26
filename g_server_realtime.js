const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const http = require('http');
require('dotenv').config();

// Import G Memory System
const MemoryManager = require('./src/memory/MemoryManager');
const SemanticMemoryManager = require('./src/memory/SemanticMemoryManager');
const createMemoryRoutes = require('./src/memory/memoryRoutes');
const createVectorRoutes = require('./src/memory/vectorRoutes');

// Import AI and Tools systems
const GeminiAbacusOrchestrator = require('./src/ai/GeminiAbacusOrchestrator');
const FunctionCallingOrchestrator = require('./src/ai/FunctionCallingOrchestrator');
const ToolsManager = require('./src/tools/ToolsManager');

// Import Services
const STTService = require('./src/services/STTService');
const RealTimeVoiceService = require('./src/services/RealTimeVoiceService');

// Import Multi-Agent System
const MultiAgentOrchestrator = require('./src/agents/MultiAgentOrchestrator');
const SemanticMultiAgentOrchestrator = require('./src/agents/SemanticMultiAgentOrchestrator');

// Import Integrations System
const IntegrationsManager = require('./src/integrations/IntegrationsManager');
const passport = require('passport');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5050;

// Initialize G Memory Manager with Semantic capabilities
const memoryManager = new MemoryManager();
const semanticMemoryManager = new SemanticMemoryManager();
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

// Initialize Multi-Agent Orchestrator with Semantic capabilities
const multiAgentOrchestrator = new MultiAgentOrchestrator(functionCallingAI, toolsManager);
const semanticMultiAgentOrchestrator = new SemanticMultiAgentOrchestrator(functionCallingAI, toolsManager, semanticMemoryManager);

// Initialize Integrations Manager
const integrationsManager = new IntegrationsManager(memoryManager);

// Initialize Real-Time Voice Service with WebSocket and Semantic Memory
const rtVoiceService = new RealTimeVoiceService(
    server, 
    sttService, 
    semanticMemoryManager, 
    functionCallingAI
);

// Import metrics middleware
const { metricsMiddleware, metricsHandler, metrics } = require('./src/middleware/metrics');

// Apply metrics middleware
app.use(metricsMiddleware);

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

// Session middleware for OAuth
app.use(session({
    secret: process.env.SESSION_SECRET || 'g-assistant-session-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from examples directory
app.use('/demo', express.static('examples'));

// Memory API routes
app.use('/api/memory', createMemoryRoutes(memoryManager));
app.use('/api/semantic', createVectorRoutes(semanticMemoryManager));

// Metrics endpoint
app.get('/api/metrics', metricsHandler);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'G Assistant Real-Time',
        timestamp: new Date().toISOString(),
        memory_stats: memoryManager.getStats(),
        semantic_stats: semanticMemoryManager.getDatabaseStats(),
        voice_stats: rtVoiceService.getServiceStats()
    });
});

// Simple chat endpoint for G Assistant
app.post('/api/chat', async (req, res) => {
    const { message, system } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    try {
        // Store user message in both traditional and semantic memory
        memoryManager.addMessage('user', message);
        await semanticMemoryManager.storeMemory('conversation', message, {
            type: 'user_input',
            timestamp: new Date().toISOString()
        });
        
        // Get recent conversation for context
        const recentMessages = memoryManager.getConversationHistory('main', 10);
        
        // Get semantic context for enhanced responses
        const semanticContext = await semanticMemoryManager.contextualSearch(
            message,
            recentMessages.slice(-5),
            req.body.userPreferences || {}
        );
        
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
        
        // Store G's response in both traditional and semantic memory
        memoryManager.addMessage('assistant', aiResponse.content);
        await semanticMemoryManager.storeMemory('conversation', aiResponse.content, {
            type: 'assistant_response',
            user_query: message,
            timestamp: new Date().toISOString()
        });
        
        // Track metrics
        metrics.httpRequestsTotal.inc({ method: 'POST', route: '/api/chat', status_code: 200 });
        
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

// Real-time voice service endpoints
app.get('/api/voice/realtime/stats', (req, res) => {
    res.json({
        success: true,
        stats: rtVoiceService.getServiceStats(),
        timestamp: new Date().toISOString()
    });
});

app.post('/api/voice/realtime/broadcast', (req, res) => {
    const { event, data } = req.body;
    
    if (!event) {
        return res.status(400).json({ error: 'Event is required' });
    }
    
    rtVoiceService.broadcast(event, data);
    
    res.json({
        success: true,
        message: 'Broadcast sent to all connected clients',
        timestamp: new Date().toISOString()
    });
});

// Combined voice capabilities endpoint
app.get('/api/voice', (req, res) => {
    res.json({
        tts: {
            default_voice_id: ELEVENLABS_VOICE_ID,
            configured: !!ELEVENLABS_API_KEY,
            provider: 'ElevenLabs'
        },
        stt: sttService.getServiceInfo(),
        realtime: {
            enabled: true,
            websocket_path: '/socket.io/',
            active_sessions: rtVoiceService.getServiceStats().activeSessions,
            supported_transports: ['websocket', 'polling']
        }
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

// Multi-Agent System endpoints
app.get('/api/agents', (req, res) => {
    try {
        const status = multiAgentOrchestrator.getStatus();
        res.json({
            success: true,
            orchestrator_status: status,
            available_capabilities: multiAgentOrchestrator.getCapabilities(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/agents/:agentName/status', (req, res) => {
    try {
        const { agentName } = req.params;
        const orchestratorStatus = multiAgentOrchestrator.getStatus();
        const agent = orchestratorStatus.agents.find(a => a.name === agentName);
        
        if (!agent) {
            return res.status(404).json({ success: false, error: 'Agent not found' });
        }
        
        res.json({ success: true, agent: agent });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agents/execute', async (req, res) => {
    try {
        const { task } = req.body;
        
        if (!task || !task.type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Task object with type is required' 
            });
        }
        
        console.log(`🤖 Multi-agent task request: ${task.type}`);
        
        const result = await multiAgentOrchestrator.processComplexTask(task);
        
        res.json({
            success: true,
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Multi-agent execution error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.post('/api/agents/:agentName/execute', async (req, res) => {
    try {
        const { agentName } = req.params;
        const { task } = req.body;
        
        if (!task || !task.type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Task object with type is required' 
            });
        }
        
        // Get specific agent
        const orchestratorStatus = multiAgentOrchestrator.getStatus();
        const agentStatus = orchestratorStatus.agents.find(a => a.name === agentName);
        
        if (!agentStatus) {
            return res.status(404).json({ success: false, error: 'Agent not found' });
        }
        
        // Get the actual agent instance
        const agent = multiAgentOrchestrator.agents.get(agentName);
        
        if (!agent) {
            return res.status(404).json({ success: false, error: 'Agent instance not found' });
        }
        
        console.log(`🎯 Direct agent task: ${agentName} -> ${task.type}`);
        
        const result = await agent.handleTask(task);
        
        res.json({
            success: true,
            result: result,
            agent: agentName,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`Agent ${req.params.agentName} execution error:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            agent: req.params.agentName,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/agents/capabilities', (req, res) => {
    try {
        const capabilities = multiAgentOrchestrator.getCapabilities();
        const agentCapabilities = {};
        
        const status = multiAgentOrchestrator.getStatus();
        status.agents.forEach(agent => {
            agentCapabilities[agent.name] = agent.status.capabilities;
        });
        
        res.json({
            success: true,
            all_capabilities: capabilities,
            agent_capabilities: agentCapabilities,
            total_agents: status.agents.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Semantic Multi-Agent System endpoints
app.get('/api/semantic/agents', async (req, res) => {
    try {
        const status = await semanticMultiAgentOrchestrator.getSemanticStats();
        res.json({
            success: true,
            semantic_orchestrator_status: status,
            vector_search_enabled: true,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/semantic/agents/execute', async (req, res) => {
    try {
        const { task, context = {} } = req.body;
        
        if (!task) {
            return res.status(400).json({ 
                success: false, 
                error: 'Task is required' 
            });
        }
        
        console.log(`🧠 Semantic multi-agent task request: ${task}`);
        
        const result = await semanticMultiAgentOrchestrator.processComplexTask(task, {
            ...context,
            userPreferences: req.body.userPreferences || {},
            urgency: req.body.urgency || 'normal'
        });
        
        // Track metrics
        metrics.agentExecutions.inc({ agent_type: 'semantic_orchestrator', status: result.success ? 'success' : 'failure' });
        
        res.json({
            success: true,
            result: result,
            semantic_enhancement: true,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Semantic multi-agent execution error:', error);
        metrics.agentExecutions.inc({ agent_type: 'semantic_orchestrator', status: 'error' });
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.post('/api/semantic/chat', async (req, res) => {
    try {
        const { message, conversationHistory = [], userPreferences = {} } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Enhanced semantic chat with context
        const semanticResults = await semanticMemoryManager.contextualSearch(
            message,
            conversationHistory,
            userPreferences
        );
        
        // Build enhanced prompt with semantic context
        let enhancedPrompt = message;
        if (semanticResults.success && semanticResults.memories.length > 0) {
            enhancedPrompt += '\n\nRelevant context from past conversations:\n';
            semanticResults.memories.slice(0, 3).forEach((memory, index) => {
                enhancedPrompt += `${index + 1}. ${memory.content}\n`;
            });
        }
        
        // Process with semantic orchestrator
        const result = await semanticMultiAgentOrchestrator.processComplexTask(enhancedPrompt, {
            conversationHistory,
            userPreferences,
            semanticContext: semanticResults
        });
        
        // Store in semantic memory
        await semanticMemoryManager.storeMemory('enhanced_conversation', message, {
            type: 'semantic_chat',
            response: result.result,
            contextUsed: semanticResults.memories?.length || 0,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            reply: result.result,
            semantic_enhancement: true,
            context_memories_used: semanticResults.memories?.length || 0,
            agents_used: result.agentsUsed || [],
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Semantic chat error:', error);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced agent learning endpoints
app.get('/api/semantic/agents/:agentName/learning', async (req, res) => {
    try {
        const { agentName } = req.params;
        const agent = semanticMultiAgentOrchestrator.agents[agentName];
        
        if (!agent) {
            return res.status(404).json({ success: false, error: 'Agent not found' });
        }
        
        const learningStats = await agent.getLearningStats();
        res.json({
            success: true,
            agent: agentName,
            learning_stats: learningStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// OAuth Authentication Routes
app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/gmail.readonly'] 
}));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        res.redirect('/auth/success?provider=google');
    }
);

app.get('/auth/github', passport.authenticate('github', { 
    scope: ['user', 'repo', 'notifications'] 
}));

app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        res.redirect('/auth/success?provider=github');
    }
);

app.get('/auth/notion/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        if (!code) {
            return res.redirect('/auth/failure?error=no_code');
        }
        
        const user = await integrationsManager.handleOAuthCallback('notion', code, state);
        
        res.redirect('/auth/success?provider=notion');
        
    } catch (error) {
        console.error('Notion OAuth callback error:', error);
        res.redirect(`/auth/failure?error=${encodeURIComponent(error.message)}`);
    }
});

app.get('/auth/success', (req, res) => {
    const { provider } = req.query;
    res.json({
        success: true,
        message: `Successfully connected to ${provider}`,
        provider: provider,
        timestamp: new Date().toISOString()
    });
});

app.get('/auth/failure', (req, res) => {
    const { error } = req.query;
    res.status(400).json({
        success: false,
        message: 'Authentication failed',
        error: error || 'Unknown error',
        timestamp: new Date().toISOString()
    });
});

// Integration Management Endpoints
app.get('/api/integrations', (req, res) => {
    try {
        const status = integrationsManager.getStatus();
        res.json({
            success: true,
            integrations: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/integrations/capabilities', (req, res) => {
    try {
        const capabilities = integrationsManager.getCapabilities();
        res.json({
            success: true,
            capabilities: capabilities,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/integrations/oauth-urls', (req, res) => {
    try {
        const urls = integrationsManager.getOAuthUrls();
        res.json({
            success: true,
            oauth_urls: urls,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/integrations/:service/:action', async (req, res) => {
    try {
        const { service, action } = req.params;
        const parameters = req.body;
        
        console.log(`🔗 Integration request: ${service}.${action}`);
        
        const result = await integrationsManager.executeAction(service, action, parameters);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('Integration execution error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.delete('/api/integrations/:service', (req, res) => {
    try {
        const { service } = req.params;
        const success = integrationsManager.disconnectService(service);
        
        if (success) {
            res.json({
                success: true,
                message: `${service} integration disconnected`,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                message: `${service} integration not found or already disconnected`,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/integrations/test', async (req, res) => {
    try {
        const results = await integrationsManager.testAllConnections();
        res.json({
            success: true,
            test_results: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/integrations/usage', (req, res) => {
    try {
        const usage = integrationsManager.getUsageStats();
        res.json({
            success: true,
            usage: usage,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server with WebSocket support
server.listen(PORT, '0.0.0.0', () => {
    const agentStatus = multiAgentOrchestrator.getStatus();
    const agentCount = agentStatus.agents.length;
    const totalCapabilities = multiAgentOrchestrator.getCapabilities().length;
    const integrationStatus = integrationsManager.getStatus();
    const connectedServices = integrationStatus.total_connected;
    
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║        G ASSISTANT INTEGRATED AI SYSTEM           ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  🤖 G Core: ONLINE                               ║`);
    console.log(`║  🧠 Memory System: OPERATIONAL                   ║`);
    console.log(`║  🎤 TTS Voice: ${ELEVENLABS_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}                   ║`);
    console.log(`║  🗣️  STT Speech: ${sttService.isAvailable() ? 'CONFIGURED' : 'NOT CONFIGURED'}                ║`);
    console.log(`║  🌐 Real-Time Voice: ENABLED                     ║`);
    console.log(`║  🛠️  Function Calling: ENABLED                   ║`);
    console.log(`║  🤖 Multi-Agent System: ${agentCount} AGENTS ONLINE        ║`);
    console.log(`║  🔗 OAuth Integrations: ${connectedServices}/3 CONNECTED          ║`);
    console.log(`║  🎯 Total Capabilities: ${totalCapabilities}                      ║`);
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  Service Port: ${PORT}                               ║`);
    console.log(`║  Local URL: http://localhost:${PORT}                 ║`);
    console.log(`║  WebSocket: ws://localhost:${PORT}/socket.io/         ║`);
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  Specialized Agents:                              ║');
    agentStatus.agents.forEach(agent => {
        const name = agent.name.padEnd(12);
        console.log(`║    🤖 ${name}: ${agent.status.capabilities.length} capabilities           ║`);
    });
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  OAuth Providers:                                 ║');
    const oauthConfig = integrationStatus.oauth.configured_providers;
    console.log(`║    🔐 Google: ${oauthConfig.google ? 'CONFIGURED' : 'NOT CONFIGURED'}                      ║`);
    console.log(`║    🔐 GitHub: ${oauthConfig.github ? 'CONFIGURED' : 'NOT CONFIGURED'}                      ║`);
    console.log(`║    🔐 Notion: ${oauthConfig.notion ? 'CONFIGURED' : 'NOT CONFIGURED'}                      ║`);
    console.log('╠════════════════════════════════════════════════════╣');
    console.log('║  API Endpoints:                                   ║');
    console.log('║    - GET  /health                                 ║');
    console.log('║    - POST /api/chat                               ║');
    console.log('║    - POST /api/tts (text-to-speech)               ║');
    console.log('║    - POST /api/stt (speech-to-text)               ║');
    console.log('║    - GET  /api/voice (capabilities)               ║');
    console.log('║    - WebSocket: Real-time voice communication     ║');
    console.log('║    - GET  /api/agents (multi-agent system)        ║');
    console.log('║    - GET  /api/integrations (OAuth & services)    ║');
    console.log('║    - GET  /auth/google, /auth/github (OAuth)      ║');
    console.log('║    - POST /api/integrations/:service/:action      ║');
    console.log('║    - GET  /api/tools (function calling)           ║');
    console.log('║    - /api/memory/* (full memory API)              ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🚀 "Hello, I am G. I can now integrate with your apps!"');
    console.log(`🎯 Agent capabilities: ${multiAgentOrchestrator.getCapabilities().slice(0,3).join(', ')} + ${totalCapabilities-3} more`);
    console.log(`🔗 Available integrations: Google, GitHub, Notion (${connectedServices} connected)`);
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down G Assistant Real-Time...');
    memoryManager.close();
    server.close();
    process.exit(0);
});