const { GoogleGenerativeAI } = require('@google/generative-ai');

class FunctionCallingOrchestrator {
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        this.model = options.model || 'gemini-1.5-flash';
        this.temperature = options.temperature || 0.7;
        this.maxTokens = options.maxTokens || 2048;
        
        if (!this.apiKey) {
            console.warn('⚠️ No Google API key found for function calling');
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.geminiModel = this.genAI.getGenerativeModel({ 
                model: this.model,
                generationConfig: {
                    temperature: this.temperature,
                    maxOutputTokens: this.maxTokens
                }
            });
            console.log(`✅ Function Calling AI initialized with ${this.model}`);
        } catch (error) {
            console.error('❌ Failed to initialize Gemini for function calling:', error.message);
        }
    }

    convertToolsToGeminiFormat(toolDefinitions) {
        return toolDefinitions.map(tool => ({
            function_declarations: [{
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }]
        }));
    }

    async processWithFunctionCalling(message, context = {}) {
        if (!this.geminiModel) {
            throw new Error('Gemini model not initialized');
        }

        try {
            const { toolsManager, conversationHistory, system } = context;
            
            // Build conversation context
            let conversationContext = '';
            if (conversationHistory && conversationHistory.length > 0) {
                conversationContext = '\n\nRecent conversation:\n' + 
                    conversationHistory.slice(-5).map(msg => 
                        `${msg.role}: ${msg.content}`
                    ).join('\n');
            }

            // System prompt with function calling instructions
            const systemPrompt = `${system || 'You are G, a helpful AI assistant.'}\n
You have access to various tools to help users. When appropriate, use these tools to provide accurate and helpful responses.
Always explain what you're doing when using tools.${conversationContext}

Available tools: ${toolsManager ? toolsManager.getAvailableTools().join(', ') : 'none'}`;

            // Get available tools for Gemini
            const tools = toolsManager ? this.convertToolsToGeminiFormat(toolsManager.getToolDefinitions()) : [];

            // Generate response with function calling
            const chat = this.geminiModel.startChat({
                tools: tools,
                history: []
            });

            const result = await chat.sendMessage(`${systemPrompt}\n\nUser: ${message}`);
            const response = await result.response;

            // Check for function calls
            const functionCalls = response.functionCalls();
            let toolResults = {};
            let finalResponse = response.text();

            if (functionCalls && functionCalls.length > 0) {
                console.log(`🔧 Function calls detected: ${functionCalls.length}`);
                
                // Execute each function call
                for (const call of functionCalls) {
                    try {
                        const toolName = call.name;
                        const params = call.args || {};
                        
                        if (toolsManager) {
                            const result = await toolsManager.executeTool(toolName, params);
                            toolResults[toolName] = result;
                        }
                    } catch (error) {
                        console.error(`Function call ${call.name} failed:`, error);
                        toolResults[call.name] = { error: error.message };
                    }
                }

                // Generate final response incorporating tool results
                try {
                    const toolResultsText = Object.entries(toolResults)
                        .map(([tool, result]) => `${tool}: ${JSON.stringify(result)}`)
                        .join('\n');

                    const followUpResult = await chat.sendMessage(
                        `Tool execution results:\n${toolResultsText}\n\nPlease provide a natural response to the user based on these results.`
                    );
                    
                    finalResponse = followUpResult.response.text();
                } catch (error) {
                    console.error('Failed to generate follow-up response:', error);
                }
            }

            return {
                content: finalResponse,
                metadata: {
                    model: this.model,
                    functionCalls: functionCalls ? functionCalls.map(call => ({
                        name: call.name,
                        args: call.args
                    })) : [],
                    toolResults,
                    hasToolUse: functionCalls && functionCalls.length > 0
                }
            };

        } catch (error) {
            console.error('Function calling error:', error);
            throw error;
        }
    }

    async processQuery(message, context = {}) {
        // If tools are available, use function calling
        if (context.toolsManager) {
            return await this.processWithFunctionCalling(message, context);
        }

        // Fallback to regular text generation
        try {
            const systemPrompt = context.system || 'You are G, a helpful AI assistant.';
            const conversationContext = context.conversationHistory 
                ? context.conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')
                : '';

            const fullPrompt = `${systemPrompt}\n\n${conversationContext}\n\nUser: ${message}`;

            const result = await this.geminiModel.generateContent(fullPrompt);
            const response = await result.response;

            return {
                content: response.text(),
                metadata: {
                    model: this.model,
                    hasToolUse: false
                }
            };
        } catch (error) {
            console.error('Regular processing error:', error);
            throw error;
        }
    }

    getCapabilities() {
        return {
            functionCalling: !!this.geminiModel,
            model: this.model,
            configured: !!this.apiKey
        };
    }
}

module.exports = FunctionCallingOrchestrator;
