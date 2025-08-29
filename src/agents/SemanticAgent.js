const BaseAgent = require('./BaseAgent');

class SemanticAgent extends BaseAgent {
    constructor(name, capabilities, llmService, toolsManager, semanticMemoryManager) {
        super(name, capabilities, llmService, toolsManager);
        this.semanticMemoryManager = semanticMemoryManager;
        this.contextWindow = [];
        this.maxContextLength = 10;
        this.learningEnabled = true;
    }

    /**
     * Enhanced task execution with semantic context
     */
    async executeTask(task, context = {}) {
        try {
            console.log(`${this.name} executing task with semantic enhancement: ${task}`);

            // Build semantic context
            const semanticContext = await this.buildSemanticContext(task, context);
            
            // Execute task with enhanced context
            const result = await this.executeWithSemanticContext(task, semanticContext);
            
            // Store execution context for future learning
            if (this.learningEnabled) {
                await this.storeExecutionMemory(task, context, result);
            }
            
            // Update context window
            this.updateContextWindow(task, result);
            
            return {
                ...result,
                semanticEnhancement: true,
                contextUsed: semanticContext.memories?.length || 0,
                agent: this.name
            };

        } catch (error) {
            console.error(`Error in ${this.name} semantic task execution:`, error);
            return {
                success: false,
                error: error.message,
                agent: this.name,
                task
            };
        }
    }

    /**
     * Build semantic context from memory and conversation history
     */
    async buildSemanticContext(task, context) {
        try {
            const semanticContext = {
                task,
                context,
                memories: [],
                relatedExperiences: [],
                conversationHistory: this.contextWindow.slice(-5), // Last 5 interactions
                userPreferences: context.userPreferences || {}
            };

            // Retrieve relevant memories using semantic search
            const memoryResults = await this.semanticMemoryManager.contextualSearch(
                task,
                this.contextWindow,
                context.userPreferences || {}
            );

            if (memoryResults.success) {
                semanticContext.memories = memoryResults.memories.slice(0, 8); // Top 8 relevant memories
            }

            // Find related execution patterns
            if (semanticContext.memories.length > 0) {
                const relatedMemories = await Promise.all(
                    semanticContext.memories.slice(0, 3).map(async memory => {
                        const related = await this.semanticMemoryManager.findRelatedMemories(
                            memory.id, 
                            0.75, 
                            3
                        );
                        return related.success ? related.relatedMemories : [];
                    })
                );

                semanticContext.relatedExperiences = relatedMemories
                    .flat()
                    .filter((memory, index, array) => 
                        array.findIndex(m => m.id === memory.id) === index // Deduplicate
                    )
                    .slice(0, 5);
            }

            return semanticContext;
        } catch (error) {
            console.error('Error building semantic context:', error);
            return { task, context, memories: [], relatedExperiences: [] };
        }
    }

    /**
     * Execute task with semantic context enhancement
     */
    async executeWithSemanticContext(task, semanticContext) {
        try {
            // Prepare enhanced prompt with semantic context
            const enhancedPrompt = this.buildEnhancedPrompt(task, semanticContext);
            
            // Use function calling if available
            if (this.llmService.generateWithFunctions) {
                const availableTools = this.toolsManager.getAvailableTools();
                const functions = this.toolsManager.getFunctionSchemas();
                
                const response = await this.llmService.generateWithFunctions(
                    enhancedPrompt,
                    functions
                );

                if (response.functionCall) {
                    const toolResult = await this.toolsManager.executeTool(
                        response.functionCall.name,
                        response.functionCall.arguments
                    );
                    
                    return {
                        success: true,
                        result: response.content,
                        toolUsed: response.functionCall.name,
                        toolResult: toolResult,
                        reasoning: response.reasoning || 'Function-based execution',
                        semanticContextApplied: true
                    };
                }
                
                return {
                    success: true,
                    result: response.content,
                    reasoning: response.reasoning || 'Direct response',
                    semanticContextApplied: true
                };
            }

            // Fallback to basic LLM
            const response = await this.llmService.generateResponse(enhancedPrompt);
            
            return {
                success: true,
                result: response,
                reasoning: 'Enhanced with semantic context',
                semanticContextApplied: true
            };

        } catch (error) {
            console.error('Error in semantic execution:', error);
            
            // Fallback to base execution
            return await super.executeTask(task);
        }
    }

    /**
     * Build enhanced prompt with semantic context
     */
    buildEnhancedPrompt(task, semanticContext) {
        let prompt = `Task: ${task}\n\n`;

        // Add agent capabilities
        prompt += `Agent: ${this.name}\n`;
        prompt += `Capabilities: ${this.capabilities.join(', ')}\n\n`;

        // Add relevant memories
        if (semanticContext.memories.length > 0) {
            prompt += 'Relevant Past Experiences:\n';
            semanticContext.memories.forEach((memory, index) => {
                prompt += `${index + 1}. [${memory.type}] ${memory.content}\n`;
                if (memory.context && Object.keys(memory.context).length > 0) {
                    prompt += `   Context: ${JSON.stringify(memory.context)}\n`;
                }
            });
            prompt += '\n';
        }

        // Add related experiences
        if (semanticContext.relatedExperiences.length > 0) {
            prompt += 'Related Execution Patterns:\n';
            semanticContext.relatedExperiences.forEach((experience, index) => {
                prompt += `${index + 1}. ${experience.content}\n`;
            });
            prompt += '\n';
        }

        // Add conversation history
        if (semanticContext.conversationHistory.length > 0) {
            prompt += 'Recent Conversation Context:\n';
            semanticContext.conversationHistory.forEach((entry, index) => {
                prompt += `${index + 1}. ${entry.task} -> ${entry.result?.result || 'No result'}\n`;
            });
            prompt += '\n';
        }

        // Add user preferences
        if (semanticContext.userPreferences && Object.keys(semanticContext.userPreferences).length > 0) {
            prompt += 'User Preferences:\n';
            Object.entries(semanticContext.userPreferences).forEach(([key, value]) => {
                prompt += `- ${key}: ${value}\n`;
            });
            prompt += '\n';
        }

        // Add execution instructions
        prompt += `Based on the above context and experiences, execute the task: "${task}"\n\n`;
        prompt += 'Please provide a comprehensive response that takes into account the relevant past experiences and user preferences. ';
        prompt += 'If you use any tools or functions, explain your reasoning for the choice.';

        return prompt;
    }

    /**
     * Store execution memory for future learning
     */
    async storeExecutionMemory(task, context, result) {
        try {
            const memoryContent = {
                task,
                result: result.result,
                success: result.success,
                agent: this.name,
                toolUsed: result.toolUsed || null,
                reasoning: result.reasoning || null,
                timestamp: new Date().toISOString()
            };

            await this.semanticMemoryManager.storeMemory(
                'agent_execution',
                JSON.stringify(memoryContent),
                {
                    agent: this.name,
                    taskType: this.categorizeTask(task),
                    success: result.success,
                    ...context
                }
            );

            console.log(`${this.name} stored execution memory for learning`);
        } catch (error) {
            console.error('Error storing execution memory:', error);
        }
    }

    /**
     * Categorize task for better organization
     */
    categorizeTask(task) {
        const taskLower = task.toLowerCase();
        
        if (taskLower.includes('code') || taskLower.includes('program') || taskLower.includes('develop')) {
            return 'development';
        } else if (taskLower.includes('analyze') || taskLower.includes('research') || taskLower.includes('study')) {
            return 'analysis';
        } else if (taskLower.includes('create') || taskLower.includes('write') || taskLower.includes('generate')) {
            return 'creation';
        } else if (taskLower.includes('plan') || taskLower.includes('organize') || taskLower.includes('schedule')) {
            return 'planning';
        } else if (taskLower.includes('help') || taskLower.includes('support') || taskLower.includes('assist')) {
            return 'assistance';
        } else {
            return 'general';
        }
    }

    /**
     * Update context window with recent interaction
     */
    updateContextWindow(task, result) {
        this.contextWindow.push({
            task,
            result,
            timestamp: new Date().toISOString()
        });

        // Maintain context window size
        if (this.contextWindow.length > this.maxContextLength) {
            this.contextWindow.shift();
        }
    }

    /**
     * Get agent's learning statistics
     */
    async getLearningStats() {
        try {
            const agentMemories = await this.semanticMemoryManager.retrieveMemories(
                `agent: ${this.name}`,
                { type: 'agent_execution', maxResults: 1000 }
            );

            const memories = agentMemories.memories || [];
            const successRate = memories.length > 0 
                ? memories.filter(m => m.context?.success === true).length / memories.length 
                : 0;

            const taskCategories = {};
            memories.forEach(memory => {
                const category = memory.context?.taskType || 'unknown';
                taskCategories[category] = (taskCategories[category] || 0) + 1;
            });

            return {
                agent: this.name,
                totalExecutions: memories.length,
                successRate: Math.round(successRate * 100),
                taskCategoryBreakdown: taskCategories,
                contextWindowSize: this.contextWindow.length,
                learningEnabled: this.learningEnabled,
                semanticMemoryIntegration: true
            };
        } catch (error) {
            console.error('Error getting learning stats:', error);
            return {
                agent: this.name,
                error: error.message
            };
        }
    }

    /**
     * Clear agent's context window
     */
    clearContextWindow() {
        this.contextWindow = [];
        console.log(`${this.name} context window cleared`);
    }

    /**
     * Enable or disable learning
     */
    toggleLearning(enabled) {
        this.learningEnabled = enabled;
        console.log(`${this.name} learning ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get similar past executions for a given task
     */
    async getSimilarExecutions(task, threshold = 0.8, limit = 5) {
        try {
            const searchQuery = `agent: ${this.name} task: ${task}`;
            const results = await this.semanticMemoryManager.retrieveMemories(searchQuery, {
                useSemanticSearch: true,
                semanticThreshold: threshold,
                maxResults: limit,
                type: 'agent_execution'
            });

            return {
                success: true,
                task,
                similarExecutions: results.memories || [],
                agent: this.name
            };
        } catch (error) {
            console.error('Error finding similar executions:', error);
            return {
                success: false,
                error: error.message,
                agent: this.name
            };
        }
    }
}

module.exports = SemanticAgent;