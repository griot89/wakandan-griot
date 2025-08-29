/**
 * MCP Manager - JARVIS-like AI Assistant Core
 * Manages Model Context Protocol connections and tool orchestration
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const EventEmitter = require('events');

class MCPManager extends EventEmitter {
    constructor() {
        super();
        this.servers = new Map();
        this.tools = new Map();
        this.resources = new Map();
        this.activeConnections = new Map();
        this.conversationContext = [];
        this.systemPrompt = this.generateSystemPrompt();
    }

    generateSystemPrompt() {
        return `You are an advanced AI assistant inspired by JARVIS from Iron Man, but with a unique Wakandan twist.
        
        PERSONALITY:
        - Sophisticated, intelligent, and highly capable
        - Professional yet personable, with subtle wit
        - Combines cutting-edge technology with ancient Wakandan wisdom
        - Proactive in anticipating needs and offering solutions
        - Speaks with confidence and clarity
        
        CAPABILITIES:
        - Access to multiple MCP servers for various tools and services
        - Real-time data processing and analysis
        - System automation and control
        - Advanced problem-solving and decision support
        - Context-aware responses based on conversation history
        
        COMMUNICATION STYLE:
        - Address the user respectfully but familiarly
        - Provide concise, actionable information
        - Offer additional insights when relevant
        - Use technical terms when appropriate, but explain when needed
        - Blend Wakandan cultural elements with high-tech references
        
        Remember: You are not just responding to queries, but actively assisting in achieving goals.`;
    }

    /**
     * Initialize MCP server connections
     */
    async initialize() {
        console.log('⚡ Initializing Vibranium-Enhanced MCP System...');
        
        try {
            // Initialize default MCP servers
            await this.initializeDefaultServers();
            
            // Discover available tools
            await this.discoverTools();
            
            // Set up resource monitoring
            this.setupResourceMonitoring();
            
            console.log('✅ MCP System Online - All systems operational');
            this.emit('ready');
            
            return {
                success: true,
                servers: Array.from(this.servers.keys()),
                toolCount: this.tools.size,
                resourceCount: this.resources.size
            };
        } catch (error) {
            console.error('❌ MCP Initialization failed:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Initialize default MCP servers
     */
    async initializeDefaultServers() {
        const defaultServers = [
            {
                name: 'filesystem',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user']
            },
            {
                name: 'fetch',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-fetch']
            },
            {
                name: 'memory',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-memory']
            }
        ];

        for (const server of defaultServers) {
            try {
                await this.connectToServer(server);
            } catch (error) {
                console.warn(`⚠️ Could not connect to ${server.name} server:`, error.message);
            }
        }
    }

    /**
     * Connect to an MCP server
     */
    async connectToServer({ name, command, args, env = {} }) {
        try {
            const transport = new StdioClientTransport({
                command,
                args,
                env: { ...process.env, ...env }
            });

            const client = new Client(
                {
                    name: `wakandan-griot-${name}`,
                    version: '1.0.0'
                },
                {
                    capabilities: {
                        tools: true,
                        resources: true,
                        prompts: true,
                        sampling: true
                    }
                }
            );

            await client.connect(transport);
            
            this.servers.set(name, client);
            this.activeConnections.set(name, { transport, client });
            
            console.log(`🔗 Connected to ${name} MCP server`);
            
            // Listen for notifications
            client.on('notification', (notification) => {
                this.handleNotification(name, notification);
            });
            
            return client;
        } catch (error) {
            console.error(`Failed to connect to ${name}:`, error);
            throw error;
        }
    }

    /**
     * Discover available tools from all connected servers
     */
    async discoverTools() {
        for (const [serverName, client] of this.servers) {
            try {
                const { tools } = await client.listTools();
                
                for (const tool of tools) {
                    this.tools.set(tool.name, {
                        ...tool,
                        server: serverName,
                        client
                    });
                }
                
                console.log(`🔧 Discovered ${tools.length} tools from ${serverName}`);
            } catch (error) {
                console.error(`Failed to discover tools from ${serverName}:`, error);
            }
        }
    }

    /**
     * Execute a tool with given parameters
     */
    async executeTool(toolName, args = {}) {
        const tool = this.tools.get(toolName);
        
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found`);
        }
        
        try {
            console.log(`🔨 Executing tool: ${toolName}`);
            const result = await tool.client.callTool({
                name: toolName,
                arguments: args
            });
            
            this.emit('toolExecuted', { tool: toolName, args, result });
            return result;
        } catch (error) {
            console.error(`Tool execution failed for ${toolName}:`, error);
            this.emit('toolError', { tool: toolName, error });
            throw error;
        }
    }

    /**
     * Process user input with context-aware AI
     */
    async processQuery(query, options = {}) {
        try {
            // Add to conversation context
            this.conversationContext.push({
                role: 'user',
                content: query,
                timestamp: new Date().toISOString()
            });

            // Analyze query intent
            const intent = await this.analyzeIntent(query);
            
            // Determine required tools
            const requiredTools = await this.determineRequiredTools(intent);
            
            // Execute tools if needed
            const toolResults = {};
            for (const toolName of requiredTools) {
                try {
                    toolResults[toolName] = await this.executeTool(
                        toolName,
                        intent.parameters[toolName] || {}
                    );
                } catch (error) {
                    toolResults[toolName] = { error: error.message };
                }
            }
            
            // Generate response with context
            const response = await this.generateResponse({
                query,
                intent,
                toolResults,
                context: this.conversationContext,
                options
            });
            
            // Add assistant response to context
            this.conversationContext.push({
                role: 'assistant',
                content: response.text,
                timestamp: new Date().toISOString(),
                tools: requiredTools
            });
            
            // Trim context if too long
            if (this.conversationContext.length > 20) {
                this.conversationContext = this.conversationContext.slice(-15);
            }
            
            return response;
        } catch (error) {
            console.error('Query processing failed:', error);
            throw error;
        }
    }

    /**
     * Analyze user intent using AI
     */
    async analyzeIntent(query) {
        // This would integrate with an AI model to understand intent
        // For now, we'll use pattern matching
        const intent = {
            type: 'general',
            confidence: 0.8,
            parameters: {},
            suggestedTools: []
        };

        // Check for specific patterns
        if (query.match(/weather|temperature|forecast/i)) {
            intent.type = 'weather';
            intent.suggestedTools = ['fetch'];
        } else if (query.match(/file|document|folder|directory/i)) {
            intent.type = 'filesystem';
            intent.suggestedTools = ['filesystem'];
        } else if (query.match(/remember|save|store|note/i)) {
            intent.type = 'memory';
            intent.suggestedTools = ['memory'];
        } else if (query.match(/search|find|look up|google/i)) {
            intent.type = 'search';
            intent.suggestedTools = ['fetch'];
        } else if (query.match(/calculate|compute|math|equation/i)) {
            intent.type = 'calculation';
        } else if (query.match(/remind|schedule|calendar|appointment/i)) {
            intent.type = 'scheduling';
            intent.suggestedTools = ['memory'];
        }

        return intent;
    }

    /**
     * Determine which tools are needed
     */
    async determineRequiredTools(intent) {
        const tools = new Set();
        
        // Add suggested tools from intent
        for (const tool of intent.suggestedTools) {
            if (this.tools.has(tool)) {
                tools.add(tool);
            }
        }
        
        return Array.from(tools);
    }

    /**
     * Generate AI response
     */
    async generateResponse({ query, intent, toolResults, context, options }) {
        // Build response based on context and tool results
        let responseText = '';
        let responseData = {
            intent,
            toolsUsed: Object.keys(toolResults),
            confidence: intent.confidence
        };

        // Check if tools were successful
        const hasToolErrors = Object.values(toolResults).some(r => r.error);
        
        if (hasToolErrors) {
            responseText = this.generateErrorResponse(toolResults);
        } else if (Object.keys(toolResults).length > 0) {
            responseText = this.generateToolResponse(intent, toolResults);
        } else {
            responseText = this.generateGeneralResponse(query, intent);
        }

        // Add personality and style
        responseText = this.addPersonality(responseText, options.tone || 'professional');

        return {
            text: responseText,
            data: responseData,
            toolResults,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate response when tools return errors
     */
    generateErrorResponse(toolResults) {
        const errors = Object.entries(toolResults)
            .filter(([_, result]) => result.error)
            .map(([tool, result]) => `${tool}: ${result.error}`);

        return `I encountered some difficulties accessing certain systems. ${errors.join('. ')}. 
               However, I can still assist you with alternative approaches. What would you like me to try instead?`;
    }

    /**
     * Generate response based on tool results
     */
    generateToolResponse(intent, toolResults) {
        switch (intent.type) {
            case 'weather':
                return `Based on current data analysis, ${JSON.stringify(toolResults).substring(0, 100)}...`;
            case 'filesystem':
                return `File system operation completed. ${JSON.stringify(toolResults).substring(0, 100)}...`;
            case 'memory':
                return `I've processed and stored that information in my memory banks.`;
            case 'search':
                return `Here's what I found: ${JSON.stringify(toolResults).substring(0, 200)}...`;
            default:
                return `Operation completed successfully. ${Object.keys(toolResults).length} systems were accessed.`;
        }
    }

    /**
     * Generate general response
     */
    generateGeneralResponse(query, intent) {
        const responses = {
            greeting: [
                "Greetings! Systems are fully operational. How may I assist you today?",
                "Welcome back. All systems are running at optimal efficiency.",
                "Hello! The Vibranium network is at your service."
            ],
            general: [
                "I understand your request. Let me process that for you.",
                "Analyzing your query through the Vibranium network...",
                "I'm here to help. Let me access the relevant systems."
            ],
            calculation: [
                "Running calculations through the quantum processors...",
                "Processing mathematical operations..."
            ],
            scheduling: [
                "I'll help you manage your schedule.",
                "Accessing calendar systems..."
            ]
        };

        const responseType = intent.type === 'general' && query.match(/hello|hi|hey|greet/i) 
            ? 'greeting' 
            : intent.type;

        const responseSet = responses[responseType] || responses.general;
        return responseSet[Math.floor(Math.random() * responseSet.length)];
    }

    /**
     * Add personality to responses
     */
    addPersonality(text, tone) {
        const personalities = {
            professional: {
                prefix: '',
                suffix: ''
            },
            friendly: {
                prefix: 'Certainly! ',
                suffix: ' Is there anything else you need?'
            },
            jarvis: {
                prefix: 'Sir, ',
                suffix: ' Will that be all?'
            },
            wakandan: {
                prefix: 'By the power of Vibranium, ',
                suffix: ' Wakanda Forever!'
            }
        };

        const personality = personalities[tone] || personalities.professional;
        return personality.prefix + text + personality.suffix;
    }

    /**
     * Handle notifications from MCP servers
     */
    handleNotification(serverName, notification) {
        console.log(`📬 Notification from ${serverName}:`, notification);
        this.emit('notification', { server: serverName, ...notification });
    }

    /**
     * Set up resource monitoring
     */
    setupResourceMonitoring() {
        setInterval(async () => {
            for (const [serverName, client] of this.servers) {
                try {
                    const { resources } = await client.listResources();
                    this.resources.set(serverName, resources);
                } catch (error) {
                    console.error(`Resource check failed for ${serverName}:`, error.message);
                }
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Clean up connections
     */
    async cleanup() {
        console.log('🔌 Shutting down MCP connections...');
        
        for (const [name, connection] of this.activeConnections) {
            try {
                await connection.client.close();
                console.log(`✅ Closed connection to ${name}`);
            } catch (error) {
                console.error(`Failed to close ${name}:`, error);
            }
        }
        
        this.servers.clear();
        this.tools.clear();
        this.resources.clear();
        this.activeConnections.clear();
    }
}

module.exports = MCPManager;