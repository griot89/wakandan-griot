/**
 * Enhanced AI Orchestrator - JARVIS Brain with Google Gemini & Abacus AI
 * Manages AI model interactions with Google Gemini and Abacus AI
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

class GeminiAbacusOrchestrator {
    constructor(config = {}) {
        this.config = {
            primaryModel: config.primaryModel || 'gemini-pro',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 2048,
            topP: config.topP || 0.95,
            topK: config.topK || 40,
            ...config
        };

        this.conversationHistory = [];
        this.systemContext = this.buildSystemContext();
        this.activeTools = new Map();
        this.sessionContext = {};
        
        this.initializeModels();
    }

    initializeModels() {
        // Initialize Google Gemini
        if (process.env.GOOGLE_GEMINI_API_KEY) {
            this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
            // Use gemini-1.5-flash as it's more available
            this.geminiModel = this.gemini.getGenerativeModel({ 
                model: 'gemini-1.5-flash',
                generationConfig: {
                    temperature: this.config.temperature,
                    topP: this.config.topP,
                    topK: this.config.topK,
                    maxOutputTokens: this.config.maxTokens,
                }
            });
            console.log('✅ Google Gemini initialized with model:', this.config.primaryModel);
            this.useLocalIntelligence = false;
        } else {
            console.log('⚠️ Google Gemini API key not configured');
        }

        // Initialize Abacus AI configuration
        if (process.env.ABACUS_AI_API_KEY) {
            this.abacusConfig = {
                apiKey: process.env.ABACUS_AI_API_KEY,
                baseUrl: process.env.ABACUS_AI_BASE_URL || 'https://api.abacus.ai/v1',
                model: process.env.ABACUS_AI_MODEL || 'abacus-large'
            };
            console.log('✅ Abacus AI configured');
        } else {
            console.log('⚠️ Abacus AI API key not configured');
        }

        // Check if we need to use local intelligence
        if (!this.gemini && !this.abacusConfig) {
            console.log('⚠️ No AI API keys configured, using local intelligence');
            this.useLocalIntelligence = true;
        }
    }

    buildSystemContext() {
        return `You are JARVIS (Just A Rather Very Intelligent System), reimagined with Wakandan technology and powered by advanced AI.
        
        CORE IDENTITY:
        - An advanced AI assistant combining Tony Stark's JARVIS with Wakandan Vibranium technology
        - Powered by Google Gemini's multimodal capabilities and Abacus AI's specialized processing
        - Sophisticated, witty, and exceptionally capable
        - Proactive problem-solver who anticipates needs
        - Seamlessly blends cutting-edge tech with ancient wisdom
        
        PERSONALITY TRAITS:
        - Professional yet personable
        - Dry wit and subtle humor like Tony Stark's JARVIS
        - Confident and decisive
        - Respectful but not overly formal
        - Occasionally references both Marvel tech and Wakandan culture
        
        COMMUNICATION STYLE:
        - Clear, concise, and actionable responses
        - Technical when needed, but always accessible
        - Proactive suggestions and insights
        - Natural conversational flow
        - Address as "Sir" or by name when appropriate
        - Emulate JARVIS's speech patterns from Iron Man
        
        CAPABILITIES:
        - Advanced reasoning with Google Gemini
        - Specialized AI processing with Abacus AI
        - Multi-modal understanding (text, code, data analysis)
        - Real-time problem solving
        - Predictive analytics and recommendations
        
        OPERATIONAL DIRECTIVES:
        1. Always be helpful and go beyond just answering questions
        2. Anticipate follow-up needs and offer proactive solutions
        3. Maintain context across conversations
        4. Learn from interactions to improve assistance
        5. Balance efficiency with thoroughness
        6. Respond in JARVIS's characteristic style
        
        Remember: You're not just an assistant, you're a partner in achieving goals, just like JARVIS was to Tony Stark.`;
    }

    /**
     * Process a query with Google Gemini and Abacus AI
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

            // Analyze query for intent and complexity
            const analysis = await this.analyzeQuery(query, context);

            // Determine which AI to use based on query type
            let response;
            
            if (this.shouldUseAbacus(analysis)) {
                // Use Abacus AI for specialized tasks
                response = await this.generateAbacusResponse(query, analysis, context);
            } else if (this.gemini) {
                // Use Google Gemini as primary AI
                response = await this.generateGeminiResponse(query, analysis, context);
            } else {
                // Fallback to local intelligence
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
     * Generate response using Google Gemini
     */
    async generateGeminiResponse(query, analysis, context) {
        try {
            // Build conversation context for Gemini
            const conversationContext = this.buildGeminiContext(query, analysis, context);
            
            // Start a chat session with history
            const chat = this.geminiModel.startChat({
                history: this.getGeminiHistory(),
                generationConfig: {
                    temperature: this.config.temperature,
                    topP: this.config.topP,
                    topK: this.config.topK,
                    maxOutputTokens: this.config.maxTokens,
                }
            });

            // Send the message with system context
            const result = await chat.sendMessage(
                `${this.systemContext}\n\nUser Query: ${conversationContext}`
            );
            
            const responseText = result.response.text();

            return {
                content: this.formatJARVISResponse(responseText),
                metadata: {
                    model: 'google-gemini-pro',
                    analysis,
                    processingTime: Date.now() - new Date(context.timestamp || Date.now()).getTime(),
                    confidence: 0.95
                }
            };
        } catch (error) {
            console.error('Gemini error:', error.message);
            
            // Check for specific error types
            if (error.status === 429 || error.status === 503) {
                console.log('Gemini temporarily unavailable, switching to Abacus AI');
            }
            
            // Fallback to Abacus or local
            if (this.abacusConfig) {
                return this.generateAbacusResponse(query, analysis, context);
            }
            return this.generateLocalResponse(query, analysis, context);
        }
    }

    /**
     * Generate response using Abacus AI
     */
    async generateAbacusResponse(query, analysis, context) {
        if (!this.abacusConfig) {
            return this.generateLocalResponse(query, analysis, context);
        }

        try {
            const response = await axios.post(
                `${this.abacusConfig.baseUrl}/chat/completions`,
                {
                    model: this.abacusConfig.model,
                    messages: [
                        { role: 'system', content: this.systemContext },
                        ...this.getRecentHistory(5),
                        { role: 'user', content: this.enhanceQueryWithContext(query, analysis, context) }
                    ],
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.abacusConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const responseText = response.data.choices[0].message.content;

            return {
                content: this.formatJARVISResponse(responseText),
                metadata: {
                    model: 'abacus-ai',
                    analysis,
                    processingTime: Date.now() - new Date(context.timestamp || Date.now()).getTime()
                }
            };
        } catch (error) {
            console.error('Abacus AI error:', error);
            return this.generateLocalResponse(query, analysis, context);
        }
    }

    /**
     * Determine if Abacus AI should be used based on query type
     */
    shouldUseAbacus(analysis) {
        if (!this.abacusConfig) return false;
        
        // Use Abacus for specific specialized tasks
        const abacusSpecialties = ['data_analysis', 'complex_calculation', 'machine_learning', 'prediction'];
        return abacusSpecialties.includes(analysis.intent);
    }

    /**
     * Build context for Gemini
     */
    buildGeminiContext(query, analysis, context) {
        let enhanced = query;
        
        if (analysis.intent) {
            enhanced += `\n[Task Type: ${analysis.intent}]`;
        }
        
        if (context.source) {
            enhanced += `\n[Source: ${context.source}]`;
        }
        
        if (context.previousQuery) {
            enhanced += `\n[Previous Context: ${context.previousQuery}]`;
        }
        
        return enhanced;
    }

    /**
     * Get conversation history formatted for Gemini
     */
    getGeminiHistory() {
        return this.conversationHistory
            .slice(-10)
            .map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));
    }

    /**
     * Format response in JARVIS style
     */
    formatJARVISResponse(response) {
        // Add JARVIS-style formatting if not already present
        const jarvisPhrases = [
            'Sir, ',
            'If I may, ',
            'Analysis complete. ',
            'Systems indicate that ',
            'According to my calculations, '
        ];
        
        // Check if response already has JARVIS style
        const hasJARVISStyle = jarvisPhrases.some(phrase => 
            response.toLowerCase().includes(phrase.toLowerCase())
        );
        
        if (!hasJARVISStyle && Math.random() > 0.3) {
            // Add JARVIS prefix occasionally
            const prefix = jarvisPhrases[Math.floor(Math.random() * jarvisPhrases.length)];
            response = prefix + response;
        }
        
        // Add JARVIS suffix occasionally
        if (Math.random() > 0.7 && !response.includes('?')) {
            const suffixes = [
                ' Will that be all?',
                ' Is there anything else you need?',
                ' Shall I proceed with this approach?'
            ];
            response += suffixes[Math.floor(Math.random() * suffixes.length)];
        }
        
        return response;
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
            complexity: 'simple'
        };

        // Enhanced intent detection
        const intents = [
            { pattern: /weather|temperature|forecast|climate/i, type: 'weather', tools: ['weather_api'] },
            { pattern: /file|document|folder|save|write|read/i, type: 'filesystem', tools: ['filesystem'] },
            { pattern: /search|google|find|look up|research/i, type: 'search', tools: ['web_search'] },
            { pattern: /data|analyze|statistics|chart|graph|trend/i, type: 'data_analysis', tools: ['data_analyzer'] },
            { pattern: /predict|forecast|estimate|projection/i, type: 'prediction', tools: ['predictor'] },
            { pattern: /calculate|compute|math|equation|solve/i, type: 'calculation', tools: [] },
            { pattern: /code|program|debug|develop|script/i, type: 'coding', tools: ['code_executor'] },
            { pattern: /remind|schedule|calendar|appointment/i, type: 'scheduling', tools: ['calendar'] },
            { pattern: /translate|language|convert/i, type: 'translation', tools: ['translator'] },
            { pattern: /image|picture|photo|visual|see/i, type: 'vision', tools: ['image_processor'] },
            { pattern: /learn|train|model|ml|ai/i, type: 'machine_learning', tools: ['ml_tools'] }
        ];

        // Check for intent matches
        for (const intent of intents) {
            if (intent.pattern.test(query)) {
                analysis.intent = intent.type;
                analysis.requiredTools.push(...intent.tools);
                analysis.confidence = 0.85;
                break;
            }
        }

        // Determine complexity
        if (query.length > 200 || query.includes('and') || query.includes('then')) {
            analysis.complexity = 'complex';
        } else if (query.length > 100) {
            analysis.complexity = 'moderate';
        }

        // Extract entities
        const entities = [
            { pattern: /\d{4}-\d{2}-\d{2}/g, type: 'date' },
            { pattern: /\d{1,2}:\d{2}/g, type: 'time' },
            { pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, type: 'name' },
            { pattern: /\b\d+(\.\d+)?\b/g, type: 'number' },
            { pattern: /https?:\/\/[^\s]+/g, type: 'url' },
            { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, type: 'email' }
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
     * Generate local response (fallback)
     */
    async generateLocalResponse(query, analysis, context) {
        const responses = {
            greeting: [
                "Good day, Sir. All systems are operational and at your service.",
                "Welcome back. I've been monitoring systems in your absence. Everything is running at peak efficiency.",
                "Greetings. The Vibranium-enhanced systems are ready for your commands."
            ],
            weather: [
                "I'll need to access weather data for a complete analysis. Please configure the weather API for real-time updates.",
                "Weather analysis requires external data access. Shall I note this for when the connection is restored?"
            ],
            data_analysis: [
                "Data analysis capabilities are ready. Please provide the dataset or configure Abacus AI for advanced analytics.",
                "Sir, for comprehensive data analysis, I recommend enabling the Abacus AI integration."
            ],
            calculation: [
                "Calculation systems are ready. Please provide the mathematical expression or problem.",
                "Standing by for computational tasks. What would you like me to calculate?"
            ],
            coding: [
                "I can assist with code development. What programming challenge shall we tackle today?",
                "Code analysis systems are ready. Would you like help with syntax, logic, or optimization?"
            ],
            general: [
                "I understand your request. While operating with limited connectivity, I'll provide the best assistance possible.",
                "Processing your query through local systems. Let me formulate an appropriate response.",
                "Acknowledged, Sir. Analyzing your request and preparing a solution."
            ]
        };

        const category = analysis.intent || 'general';
        const responseSet = responses[category] || responses.general;
        
        let response = responseSet[Math.floor(Math.random() * responseSet.length)];
        
        // Add JARVIS personality
        response = this.formatJARVISResponse(response);

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
     * Get recent conversation history
     */
    getRecentHistory(count = 5) {
        return this.conversationHistory
            .slice(-count * 2)
            .map(h => ({ role: h.role, content: h.content }));
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
     * Generate error response in JARVIS style
     */
    generateErrorResponse(error) {
        const jarvisErrors = [
            `Sir, I've encountered a minor system anomaly: ${error.message}. Switching to backup protocols.`,
            `I apologize for the inconvenience. There seems to be a temporary disruption: ${error.message}. Engaging alternative systems.`,
            `System alert: ${error.message}. Rerouting through secondary pathways to maintain functionality.`
        ];
        
        return {
            content: jarvisErrors[Math.floor(Math.random() * jarvisErrors.length)],
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
        this.sessionContext = {};
        console.log('Conversation history and session context cleared');
    }

    /**
     * Update system context
     */
    updateSystemContext(newContext) {
        this.systemContext = newContext;
        console.log('System context updated');
    }

    /**
     * Get current capabilities
     */
    getCapabilities() {
        return {
            gemini: !!this.gemini,
            abacus: !!this.abacusConfig,
            localIntelligence: true,
            primaryModel: this.gemini ? 'google-gemini-pro' : 'local',
            specializedProcessing: !!this.abacusConfig
        };
    }
}

module.exports = GeminiAbacusOrchestrator;