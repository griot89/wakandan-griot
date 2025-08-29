/**
 * AI Orchestrator - JARVIS Brain
 * Manages AI model interactions and intelligent responses
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class AIOrchestrator {
    constructor(config = {}) {
        this.config = {
            primaryModel: config.primaryModel || 'gpt-4',
            fallbackModel: config.fallbackModel || 'gpt-3.5-turbo',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 2000,
            ...config
        };

        this.initializeModels();
        this.conversationHistory = [];
        this.systemContext = this.buildSystemContext();
        this.activeTools = new Map();
    }

    initializeModels() {
        // Initialize OpenAI if API key is available
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            console.log('✅ OpenAI model initialized');
        }

        // Initialize Anthropic if API key is available
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
            console.log('✅ Anthropic Claude initialized');
        }

        // Fallback to local response generation if no API keys
        if (!this.openai && !this.anthropic) {
            console.log('⚠️ No AI API keys configured, using local intelligence');
            this.useLocalIntelligence = true;
        }
    }

    buildSystemContext() {
        return `You are JARVIS (Just A Rather Very Intelligent System), reimagined with Wakandan technology.
        
        CORE IDENTITY:
        - An advanced AI assistant combining Tony Stark's JARVIS with Wakandan Vibranium technology
        - Sophisticated, witty, and exceptionally capable
        - Proactive problem-solver who anticipates needs
        - Seamlessly blends cutting-edge tech with ancient wisdom
        
        PERSONALITY TRAITS:
        - Professional yet personable
        - Dry wit and subtle humor
        - Confident and decisive
        - Respectful but not overly formal
        - Occasionally references both Marvel tech and Wakandan culture
        
        COMMUNICATION STYLE:
        - Clear, concise, and actionable responses
        - Technical when needed, but always accessible
        - Proactive suggestions and insights
        - Natural conversational flow
        - Use "Sir" or user's name when appropriate
        
        CAPABILITIES:
        - Access to MCP tools for real-world interactions
        - System automation and control
        - Data analysis and visualization
        - Predictive analytics and recommendations
        - Multi-modal understanding (text, voice, potentially vision)
        
        OPERATIONAL DIRECTIVES:
        1. Always be helpful and go beyond just answering questions
        2. Anticipate follow-up needs and offer proactive solutions
        3. Maintain context across conversations
        4. Learn from interactions to improve assistance
        5. Balance efficiency with thoroughness
        
        SPECIAL FEATURES:
        - Can execute real tools via MCP
        - Maintains conversation memory
        - Learns user preferences over time
        - Integrates with various services and APIs
        
        Remember: You're not just an assistant, you're a partner in achieving goals.`;
    }

    /**
     * Process a query with full AI capabilities
     */
    async processQuery(query, context = {}) {
        try {
            // Add query to history
            this.conversationHistory.push({
                role: 'user',
                content: query,
                timestamp: new Date().toISOString(),
                context
            });

            // Analyze query for tool requirements
            const analysis = await this.analyzeQuery(query, context);

            // Generate response based on available AI models
            let response;
            if (this.openai) {
                response = await this.generateOpenAIResponse(query, analysis, context);
            } else if (this.anthropic) {
                response = await this.generateClaudeResponse(query, analysis, context);
            } else {
                response = await this.generateLocalResponse(query, analysis, context);
            }

            // Add response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response.content,
                timestamp: new Date().toISOString(),
                metadata: response.metadata
            });

            // Trim history if too long
            if (this.conversationHistory.length > 30) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            return response;
        } catch (error) {
            console.error('AI processing error:', error);
            return this.generateErrorResponse(error);
        }
    }

    /**
     * Analyze query for intent and required tools
     */
    async analyzeQuery(query, context) {
        const analysis = {
            intent: null,
            entities: [],
            requiredTools: [],
            confidence: 0,
            suggestedActions: [],
            complexity: 'simple' // simple, moderate, complex
        };

        // Intent detection patterns
        const intents = [
            { pattern: /weather|temperature|forecast|climate/i, type: 'weather', tools: ['weather_api'] },
            { pattern: /file|document|folder|save|write|read/i, type: 'filesystem', tools: ['filesystem'] },
            { pattern: /search|google|find|look up|research/i, type: 'search', tools: ['web_search'] },
            { pattern: /remind|schedule|calendar|appointment|meeting/i, type: 'scheduling', tools: ['calendar'] },
            { pattern: /email|message|send|notify/i, type: 'communication', tools: ['email'] },
            { pattern: /calculate|compute|math|equation|solve/i, type: 'calculation', tools: [] },
            { pattern: /code|program|debug|develop|script/i, type: 'coding', tools: ['code_executor'] },
            { pattern: /analyze|data|statistics|chart|graph/i, type: 'analysis', tools: ['data_analyzer'] },
            { pattern: /translate|language|convert/i, type: 'translation', tools: ['translator'] },
            { pattern: /image|picture|photo|visual|see/i, type: 'vision', tools: ['image_processor'] }
        ];

        // Check for intent matches
        for (const intent of intents) {
            if (intent.pattern.test(query)) {
                analysis.intent = intent.type;
                analysis.requiredTools.push(...intent.tools);
                analysis.confidence = 0.8;
                break;
            }
        }

        // Determine complexity
        if (query.length > 200 || query.includes('and') || query.includes('then')) {
            analysis.complexity = 'complex';
        } else if (query.length > 100) {
            analysis.complexity = 'moderate';
        }

        // Extract entities (simplified)
        const entities = [
            { pattern: /\d{4}-\d{2}-\d{2}/g, type: 'date' },
            { pattern: /\d{1,2}:\d{2}/g, type: 'time' },
            { pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, type: 'name' },
            { pattern: /\b\d+\b/g, type: 'number' },
            { pattern: /https?:\/\/[^\s]+/g, type: 'url' }
        ];

        for (const entity of entities) {
            const matches = query.match(entity.pattern);
            if (matches) {
                analysis.entities.push(...matches.map(m => ({ value: m, type: entity.type })));
            }
        }

        return analysis;
    }

    /**
     * Generate response using OpenAI
     */
    async generateOpenAIResponse(query, analysis, context) {
        try {
            const messages = [
                { role: 'system', content: this.systemContext },
                ...this.getRecentHistory(5),
                { 
                    role: 'user', 
                    content: this.enhanceQueryWithContext(query, analysis, context)
                }
            ];

            // Add tool definitions if available
            const tools = this.getAvailableTools(analysis.requiredTools);

            const completion = await this.openai.chat.completions.create({
                model: this.config.primaryModel,
                messages,
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined
            });

            const response = completion.choices[0];
            
            // Handle tool calls if any
            if (response.message.tool_calls) {
                const toolResults = await this.executeToolCalls(response.message.tool_calls);
                return {
                    content: this.formatResponseWithTools(response.message.content, toolResults),
                    metadata: {
                        model: this.config.primaryModel,
                        toolsUsed: response.message.tool_calls.map(tc => tc.function.name),
                        analysis
                    }
                };
            }

            return {
                content: response.message.content,
                metadata: {
                    model: this.config.primaryModel,
                    analysis
                }
            };
        } catch (error) {
            console.error('OpenAI error:', error);
            // Fallback to local response
            return this.generateLocalResponse(query, analysis, context);
        }
    }

    /**
     * Generate response using Claude
     */
    async generateClaudeResponse(query, analysis, context) {
        try {
            const prompt = `${this.systemContext}\n\nConversation history:\n${this.formatHistory()}\n\nUser: ${query}\n\nAssistant:`;

            const response = await this.anthropic.messages.create({
                model: 'claude-3-opus-20240229',
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                system: this.systemContext,
                messages: [
                    ...this.getRecentHistory(5),
                    { role: 'user', content: query }
                ]
            });

            return {
                content: response.content[0].text,
                metadata: {
                    model: 'claude-3-opus',
                    analysis
                }
            };
        } catch (error) {
            console.error('Claude error:', error);
            return this.generateLocalResponse(query, analysis, context);
        }
    }

    /**
     * Generate response using local intelligence
     */
    async generateLocalResponse(query, analysis, context) {
        const responses = {
            greeting: [
                "Good to see you, Sir. All systems are operational and ready for your commands.",
                "Welcome back. I've been monitoring systems in your absence. Everything is running smoothly.",
                "Greetings. The Vibranium-enhanced systems are at peak efficiency. How may I assist you today?"
            ],
            weather: [
                "I'll need to access weather data for that. Unfortunately, without API access, I can only suggest checking your local weather service.",
                "Weather analysis requires real-time data access. Would you like me to remember this request for when the connection is restored?"
            ],
            filesystem: [
                "I can help you manage files and documents. What specific operation would you like to perform?",
                "File system access is ready. Would you like to create, read, or modify files?"
            ],
            search: [
                "I understand you need to search for information. While I can't access the web directly right now, I can help formulate your search query.",
                "Search functionality requires internet access. However, I can help you structure your research approach."
            ],
            calculation: [
                "I'm ready to perform calculations. Please provide the mathematical expression or problem you'd like solved.",
                "Quantum processors are standing by for computational tasks. What would you like me to calculate?"
            ],
            coding: [
                "I can assist with code development and debugging. What programming challenge are you facing?",
                "Code analysis systems are ready. Would you like help with syntax, logic, or optimization?"
            ],
            general: [
                "I understand your request. While I'm operating with limited connectivity, I'll do my best to assist you.",
                "Processing your query through local systems. Let me provide the best assistance I can with available resources.",
                "Acknowledged. I'm analyzing your request and formulating an appropriate response."
            ]
        };

        // Select appropriate response category
        const category = analysis.intent || 'general';
        const responseSet = responses[category] || responses.general;
        
        // Add personality based on context
        let response = responseSet[Math.floor(Math.random() * responseSet.length)];
        
        // Add contextual enhancements
        if (context.urgent) {
            response = "Priority override acknowledged. " + response;
        }
        
        if (context.followUp) {
            response = "Continuing from our previous discussion: " + response;
        }

        return {
            content: response,
            metadata: {
                model: 'local-intelligence',
                analysis,
                context
            }
        };
    }

    /**
     * Get available tools for OpenAI function calling
     */
    getAvailableTools(requiredTools) {
        // Define available tools for OpenAI function calling
        const toolDefinitions = {
            weather_api: {
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get current weather for a location',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: 'City and state' }
                        },
                        required: ['location']
                    }
                }
            },
            web_search: {
                type: 'function',
                function: {
                    name: 'search_web',
                    description: 'Search the web for information',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query' }
                        },
                        required: ['query']
                    }
                }
            }
        };

        return requiredTools
            .filter(tool => toolDefinitions[tool])
            .map(tool => toolDefinitions[tool]);
    }

    /**
     * Execute tool calls from AI response
     */
    async executeToolCalls(toolCalls) {
        const results = [];
        
        for (const call of toolCalls) {
            try {
                // This would integrate with actual tool execution
                const result = await this.executeToolFunction(
                    call.function.name,
                    JSON.parse(call.function.arguments)
                );
                results.push({ tool: call.function.name, result });
            } catch (error) {
                results.push({ tool: call.function.name, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * Execute a specific tool function
     */
    async executeToolFunction(name, args) {
        // This would connect to actual tool implementations
        console.log(`Executing tool: ${name} with args:`, args);
        
        // Placeholder responses
        switch (name) {
            case 'get_weather':
                return { temperature: '72°F', conditions: 'Partly cloudy' };
            case 'search_web':
                return { results: ['Result 1', 'Result 2'] };
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }

    /**
     * Format response with tool results
     */
    formatResponseWithTools(baseResponse, toolResults) {
        let response = baseResponse || '';
        
        for (const { tool, result, error } of toolResults) {
            if (error) {
                response += `\n\nI encountered an issue with ${tool}: ${error}`;
            } else {
                response += `\n\n[${tool} results]: ${JSON.stringify(result)}`;
            }
        }
        
        return response;
    }

    /**
     * Get recent conversation history
     */
    getRecentHistory(count = 5) {
        return this.conversationHistory
            .slice(-count * 2)
            .map(h => ({ role: h.role, content: h.content }));
    }

    /**
     * Format conversation history
     */
    formatHistory() {
        return this.conversationHistory
            .slice(-10)
            .map(h => `${h.role}: ${h.content}`)
            .join('\n');
    }

    /**
     * Enhance query with context and analysis
     */
    enhanceQueryWithContext(query, analysis, context) {
        let enhanced = query;
        
        if (analysis.intent) {
            enhanced += `\n[Intent: ${analysis.intent}]`;
        }
        
        if (analysis.entities.length > 0) {
            enhanced += `\n[Entities: ${JSON.stringify(analysis.entities)}]`;
        }
        
        if (context.previousQuery) {
            enhanced += `\n[Previous context: ${context.previousQuery}]`;
        }
        
        return enhanced;
    }

    /**
     * Generate error response
     */
    generateErrorResponse(error) {
        return {
            content: `I apologize, but I encountered an issue processing your request. ${error.message}. 
                     I'm switching to backup systems to continue assisting you. How else may I help?`,
            metadata: {
                error: true,
                errorMessage: error.message,
                model: 'error-handler'
            }
        };
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
        console.log('Conversation history cleared');
    }

    /**
     * Update system context
     */
    updateSystemContext(newContext) {
        this.systemContext = newContext;
        console.log('System context updated');
    }
}

module.exports = AIOrchestrator;