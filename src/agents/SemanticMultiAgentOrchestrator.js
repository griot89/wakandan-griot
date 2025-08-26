const MultiAgentOrchestrator = require('./MultiAgentOrchestrator');
const SemanticAgent = require('./SemanticAgent');

class SemanticMultiAgentOrchestrator extends MultiAgentOrchestrator {
    constructor(llmService, toolsManager, semanticMemoryManager) {
        super(llmService, toolsManager);
        this.semanticMemoryManager = semanticMemoryManager;
        this.executionHistory = [];
        this.agentCollaboration = new Map();
        this.initializeSemanticAgents();
    }

    /**
     * Initialize all agents with semantic capabilities
     */
    initializeSemanticAgents() {
        console.log('Initializing Semantic Multi-Agent System...');

        // Reinitialize all agents as SemanticAgents
        const agentConfigs = Object.entries(this.agents);
        this.agents = {};

        agentConfigs.forEach(([name, agent]) => {
            this.agents[name] = new SemanticAgent(
                name,
                agent.capabilities,
                this.llmService,
                this.toolsManager,
                this.semanticMemoryManager
            );
        });

        console.log(`Initialized ${Object.keys(this.agents).length} semantic agents`);
    }

    /**
     * Enhanced task processing with semantic orchestration
     */
    async processComplexTask(task, context = {}) {
        try {
            console.log('Processing complex task with semantic orchestration:', task);

            // Analyze task with semantic context
            const taskAnalysis = await this.analyzeTaskWithSemanticContext(task, context);

            // Check for similar past executions
            const similarExecutions = await this.findSimilarExecutions(task);

            let result;
            if (taskAnalysis.requiresMultipleAgents) {
                result = await this.handleSemanticMultiAgentTask(task, taskAnalysis, similarExecutions);
            } else {
                result = await this.handleSemanticSingleAgentTask(task, taskAnalysis, similarExecutions);
            }

            // Store execution for future learning
            await this.storeExecutionHistory(task, taskAnalysis, result);

            // Update agent collaboration patterns
            this.updateCollaborationPatterns(taskAnalysis, result);

            return {
                ...result,
                semanticOrchestration: true,
                executionId: Date.now(),
                similarPastExecutions: similarExecutions.length
            };

        } catch (error) {
            console.error('Error in semantic complex task processing:', error);
            return {
                success: false,
                error: error.message,
                task,
                semanticOrchestration: false
            };
        }
    }

    /**
     * Analyze task with semantic context from past executions
     */
    async analyzeTaskWithSemanticContext(task, context) {
        try {
            // Get basic task analysis
            const basicAnalysis = await this.analyzeTask(task);

            // Enhance with semantic context
            const semanticContext = await this.buildOrchestrationContext(task, context);

            // Refine agent selection based on past successes
            const refinedAgentSelection = await this.refineAgentSelection(
                basicAnalysis.primaryAgents,
                task,
                semanticContext
            );

            // Predict collaboration patterns
            const collaborationPredictions = await this.predictCollaborationPatterns(
                refinedAgentSelection,
                task
            );

            return {
                ...basicAnalysis,
                semanticContext,
                refinedPrimaryAgents: refinedAgentSelection,
                collaborationPredictions,
                confidenceScore: this.calculateConfidenceScore(basicAnalysis, semanticContext)
            };

        } catch (error) {
            console.error('Error in semantic task analysis:', error);
            // Fallback to basic analysis
            return await this.analyzeTask(task);
        }
    }

    /**
     * Build orchestration context from semantic memory
     */
    async buildOrchestrationContext(task, context) {
        try {
            // Find relevant orchestration memories
            const orchestrationMemories = await this.semanticMemoryManager.retrieveMemories(
                `orchestration task: ${task}`,
                {
                    useSemanticSearch: true,
                    semanticThreshold: 0.7,
                    maxResults: 10,
                    type: 'orchestration'
                }
            );

            // Find successful agent combinations
            const agentCombinationMemories = await this.semanticMemoryManager.retrieveMemories(
                'multi-agent collaboration',
                {
                    useSemanticSearch: true,
                    semanticThreshold: 0.75,
                    maxResults: 8,
                    type: 'agent_collaboration'
                }
            );

            return {
                pastOrchestrations: orchestrationMemories.memories || [],
                successfulCombinations: agentCombinationMemories.memories || [],
                contextualPreferences: context.userPreferences || {},
                environmentalFactors: {
                    timeOfDay: new Date().getHours(),
                    complexity: this.assessTaskComplexity(task),
                    urgency: context.urgency || 'normal'
                }
            };
        } catch (error) {
            console.error('Error building orchestration context:', error);
            return {
                pastOrchestrations: [],
                successfulCombinations: [],
                contextualPreferences: {},
                environmentalFactors: {}
            };
        }
    }

    /**
     * Refine agent selection based on semantic analysis
     */
    async refineAgentSelection(initialAgents, task, semanticContext) {
        try {
            const refinedSelection = [];

            for (const agentName of initialAgents) {
                const agent = this.agents[agentName];
                if (!agent) continue;

                // Get agent's performance for similar tasks
                const agentStats = await agent.getLearningStats();
                const similarExecutions = await agent.getSimilarExecutions(task, 0.75, 5);

                // Calculate agent suitability score
                const suitabilityScore = this.calculateAgentSuitability(
                    agent,
                    task,
                    agentStats,
                    similarExecutions,
                    semanticContext
                );

                refinedSelection.push({
                    agentName,
                    suitabilityScore,
                    pastSuccessRate: agentStats.successRate || 0,
                    similarTasksCount: similarExecutions.similarExecutions?.length || 0
                });
            }

            // Sort by suitability score and return top agents
            return refinedSelection
                .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
                .slice(0, Math.min(5, refinedSelection.length));

        } catch (error) {
            console.error('Error refining agent selection:', error);
            return initialAgents.map(name => ({ agentName: name, suitabilityScore: 0.5 }));
        }
    }

    /**
     * Calculate agent suitability for a task
     */
    calculateAgentSuitability(agent, task, agentStats, similarExecutions, semanticContext) {
        let score = 0.5; // Base score

        // Success rate contribution (30%)
        if (agentStats.successRate) {
            score += (agentStats.successRate / 100) * 0.3;
        }

        // Experience with similar tasks (25%)
        const similarCount = similarExecutions.similarExecutions?.length || 0;
        if (similarCount > 0) {
            score += Math.min(similarCount / 10, 1) * 0.25;
        }

        // Recent performance (20%)
        if (semanticContext.pastOrchestrations.length > 0) {
            const recentPerformance = semanticContext.pastOrchestrations
                .filter(mem => mem.context?.primaryAgent === agent.name)
                .reduce((avg, mem) => avg + (mem.context?.success ? 1 : 0), 0);
            
            if (recentPerformance > 0) {
                score += (recentPerformance / Math.min(semanticContext.pastOrchestrations.length, 5)) * 0.2;
            }
        }

        // Capability matching (15%)
        const taskWords = task.toLowerCase().split(' ');
        const capabilityMatches = agent.capabilities.filter(cap =>
            taskWords.some(word => cap.toLowerCase().includes(word))
        ).length;
        
        if (capabilityMatches > 0) {
            score += Math.min(capabilityMatches / agent.capabilities.length, 1) * 0.15;
        }

        // Collaboration potential (10%)
        const collaborationScore = this.assessCollaborationPotential(agent.name, semanticContext);
        score += collaborationScore * 0.1;

        return Math.min(score, 1); // Cap at 1.0
    }

    /**
     * Predict collaboration patterns between agents
     */
    async predictCollaborationPatterns(agentSelection, task) {
        try {
            const predictions = [];

            for (let i = 0; i < agentSelection.length; i++) {
                for (let j = i + 1; j < agentSelection.length; j++) {
                    const agent1 = agentSelection[i].agentName;
                    const agent2 = agentSelection[j].agentName;

                    const collaborationHistory = this.agentCollaboration.get(`${agent1}-${agent2}`) ||
                                               this.agentCollaboration.get(`${agent2}-${agent1}`) ||
                                               { successes: 0, attempts: 0 };

                    const synergy = this.calculateAgentSynergy(agent1, agent2, task);
                    
                    predictions.push({
                        agents: [agent1, agent2],
                        synergyScore: synergy,
                        historicalSuccessRate: collaborationHistory.attempts > 0 
                            ? collaborationHistory.successes / collaborationHistory.attempts 
                            : 0.5,
                        recommendation: synergy > 0.7 ? 'high' : synergy > 0.5 ? 'medium' : 'low'
                    });
                }
            }

            return predictions.sort((a, b) => b.synergyScore - a.synergyScore);
        } catch (error) {
            console.error('Error predicting collaboration patterns:', error);
            return [];
        }
    }

    /**
     * Calculate synergy between two agents
     */
    calculateAgentSynergy(agent1Name, agent2Name, task) {
        const agent1 = this.agents[agent1Name];
        const agent2 = this.agents[agent2Name];

        if (!agent1 || !agent2) return 0;

        // Capability complementarity
        const sharedCaps = agent1.capabilities.filter(cap => 
            agent2.capabilities.includes(cap)
        ).length;
        const uniqueCaps = [...new Set([...agent1.capabilities, ...agent2.capabilities])].length;
        const complementarity = 1 - (sharedCaps / uniqueCaps);

        // Task relevance
        const taskWords = task.toLowerCase().split(' ');
        const combinedCaps = [...agent1.capabilities, ...agent2.capabilities];
        const taskRelevance = taskWords.filter(word => 
            combinedCaps.some(cap => cap.toLowerCase().includes(word))
        ).length / taskWords.length;

        return (complementarity * 0.6) + (taskRelevance * 0.4);
    }

    /**
     * Handle multi-agent task with semantic coordination
     */
    async handleSemanticMultiAgentTask(task, taskAnalysis, similarExecutions) {
        try {
            console.log('Executing semantic multi-agent task');

            // Select optimal agent combination
            const selectedAgents = taskAnalysis.refinedPrimaryAgents.slice(0, 3);
            const executionPlan = await this.createSemanticExecutionPlan(task, selectedAgents);

            const results = [];
            const sharedContext = {
                task,
                executionPlan,
                agentResults: [],
                similarExecutions
            };

            // Execute agents in planned sequence
            for (const step of executionPlan.steps) {
                const agent = this.agents[step.agentName];
                if (agent) {
                    console.log(`Executing step: ${step.description} with ${step.agentName}`);

                    const stepResult = await agent.executeTask(step.subtask, {
                        ...sharedContext,
                        stepContext: step.context,
                        previousResults: results
                    });

                    results.push({
                        agent: step.agentName,
                        subtask: step.subtask,
                        result: stepResult,
                        timestamp: new Date().toISOString()
                    });

                    // Update shared context for next agents
                    sharedContext.agentResults = results;
                }
            }

            // Synthesize final result
            const finalResult = await this.synthesizeSemanticResults(task, results, taskAnalysis);

            return {
                success: finalResult.success,
                result: finalResult.result,
                executionType: 'semantic_multi_agent',
                agentsUsed: selectedAgents.map(a => a.agentName),
                executionPlan,
                agentResults: results,
                synthesisReasoning: finalResult.reasoning
            };

        } catch (error) {
            console.error('Error in semantic multi-agent execution:', error);
            return {
                success: false,
                error: error.message,
                executionType: 'semantic_multi_agent_failed'
            };
        }
    }

    /**
     * Create semantic execution plan for multi-agent task
     */
    async createSemanticExecutionPlan(task, selectedAgents) {
        try {
            const plan = {
                task,
                strategy: 'semantic_coordination',
                steps: [],
                estimatedDuration: 'variable',
                riskLevel: 'low'
            };

            // Create execution steps based on agent capabilities and task analysis
            const subtasks = await this.decomposeTask(task);
            
            for (let i = 0; i < Math.min(subtasks.length, selectedAgents.length); i++) {
                const subtask = subtasks[i];
                const agent = selectedAgents[i];

                plan.steps.push({
                    stepNumber: i + 1,
                    agentName: agent.agentName,
                    subtask: subtask,
                    description: `${agent.agentName} handles: ${subtask}`,
                    context: {
                        suitabilityScore: agent.suitabilityScore,
                        dependencies: i > 0 ? [i] : [],
                        parallelizable: i === 0 ? true : false
                    }
                });
            }

            return plan;
        } catch (error) {
            console.error('Error creating semantic execution plan:', error);
            return {
                task,
                strategy: 'fallback',
                steps: [{
                    stepNumber: 1,
                    agentName: selectedAgents[0]?.agentName || 'general',
                    subtask: task,
                    description: 'Fallback execution',
                    context: {}
                }]
            };
        }
    }

    /**
     * Synthesize results from multiple agents using semantic understanding
     */
    async synthesizeSemanticResults(task, agentResults, taskAnalysis) {
        try {
            // Build synthesis prompt with semantic context
            const synthesisPrompt = this.buildSynthesisPrompt(task, agentResults, taskAnalysis);
            
            // Use LLM to synthesize results
            const synthesis = await this.llmService.generateResponse(synthesisPrompt);

            return {
                success: true,
                result: synthesis,
                reasoning: 'Semantic synthesis of multi-agent results',
                agentContributions: agentResults.length,
                confidenceScore: taskAnalysis.confidenceScore || 0.8
            };

        } catch (error) {
            console.error('Error synthesizing semantic results:', error);
            
            // Fallback synthesis
            const combinedResults = agentResults
                .map(r => r.result?.result || 'No result')
                .join('\n\n');
            
            return {
                success: true,
                result: combinedResults,
                reasoning: 'Simple concatenation fallback'
            };
        }
    }

    /**
     * Build synthesis prompt for LLM
     */
    buildSynthesisPrompt(task, agentResults, taskAnalysis) {
        let prompt = `Task: ${task}\n\n`;
        
        prompt += 'Agent Results to Synthesize:\n';
        agentResults.forEach((result, index) => {
            prompt += `${index + 1}. ${result.agent}: ${result.result?.result || 'No result'}\n`;
            if (result.result?.reasoning) {
                prompt += `   Reasoning: ${result.result.reasoning}\n`;
            }
        });
        
        prompt += '\nTask Analysis Context:\n';
        prompt += `Confidence Score: ${taskAnalysis.confidenceScore || 'Unknown'}\n`;
        prompt += `Primary Focus: ${taskAnalysis.primaryCategory || 'General'}\n`;
        
        if (taskAnalysis.semanticContext?.pastOrchestrations?.length > 0) {
            prompt += 'Similar Past Executions: Found relevant patterns\n';
        }
        
        prompt += '\nPlease synthesize these agent results into a comprehensive, coherent response that addresses the original task. ';
        prompt += 'Consider the strengths of each agent\'s contribution and create a unified solution.';
        
        return prompt;
    }

    /**
     * Store execution history for learning
     */
    async storeExecutionHistory(task, taskAnalysis, result) {
        try {
            const executionRecord = {
                task,
                success: result.success,
                executionType: result.executionType,
                agentsUsed: result.agentsUsed || [],
                confidenceScore: taskAnalysis.confidenceScore,
                timestamp: new Date().toISOString(),
                reasoning: result.synthesisReasoning || result.reasoning
            };

            await this.semanticMemoryManager.storeMemory(
                'orchestration',
                JSON.stringify(executionRecord),
                {
                    taskCategory: taskAnalysis.primaryCategory,
                    complexity: taskAnalysis.complexity,
                    success: result.success,
                    agentCount: result.agentsUsed?.length || 1
                }
            );

            this.executionHistory.push(executionRecord);
            
            // Maintain history size
            if (this.executionHistory.length > 100) {
                this.executionHistory.shift();
            }

        } catch (error) {
            console.error('Error storing execution history:', error);
        }
    }

    /**
     * Update collaboration patterns between agents
     */
    updateCollaborationPatterns(taskAnalysis, result) {
        try {
            if (result.agentsUsed && result.agentsUsed.length > 1) {
                for (let i = 0; i < result.agentsUsed.length; i++) {
                    for (let j = i + 1; j < result.agentsUsed.length; j++) {
                        const agent1 = result.agentsUsed[i];
                        const agent2 = result.agentsUsed[j];
                        const key = `${agent1}-${agent2}`;
                        
                        const current = this.agentCollaboration.get(key) || { successes: 0, attempts: 0 };
                        current.attempts++;
                        if (result.success) {
                            current.successes++;
                        }
                        
                        this.agentCollaboration.set(key, current);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating collaboration patterns:', error);
        }
    }

    /**
     * Find similar past executions
     */
    async findSimilarExecutions(task) {
        try {
            const results = await this.semanticMemoryManager.retrieveMemories(
                task,
                {
                    useSemanticSearch: true,
                    semanticThreshold: 0.75,
                    maxResults: 5,
                    type: 'orchestration'
                }
            );

            return results.memories || [];
        } catch (error) {
            console.error('Error finding similar executions:', error);
            return [];
        }
    }

    /**
     * Calculate confidence score for task analysis
     */
    calculateConfidenceScore(basicAnalysis, semanticContext) {
        let score = 0.5; // Base confidence

        // Past execution success
        if (semanticContext.pastOrchestrations.length > 0) {
            const successRate = semanticContext.pastOrchestrations
                .filter(mem => mem.context?.success)
                .length / semanticContext.pastOrchestrations.length;
            score += successRate * 0.3;
        }

        // Agent capability matching
        if (basicAnalysis.primaryAgents && basicAnalysis.primaryAgents.length > 0) {
            score += 0.2;
        }

        // Task clarity
        if (basicAnalysis.complexity && basicAnalysis.complexity !== 'high') {
            score += 0.2;
        }

        // Historical success patterns
        if (semanticContext.successfulCombinations.length > 0) {
            score += 0.1;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Assess collaboration potential for an agent
     */
    assessCollaborationPotential(agentName, semanticContext) {
        const collaborationRecord = Array.from(this.agentCollaboration.entries())
            .filter(([key]) => key.includes(agentName))
            .reduce((total, [, record]) => total + (record.successes / Math.max(record.attempts, 1)), 0);
        
        return Math.min(collaborationRecord / 5, 1); // Normalize to 0-1
    }

    /**
     * Get orchestrator statistics with semantic enhancements
     */
    async getSemanticStats() {
        const basicStats = await super.getStats();
        
        const collaborationStats = {};
        for (const [key, record] of this.agentCollaboration) {
            collaborationStats[key] = {
                successRate: record.attempts > 0 ? (record.successes / record.attempts) : 0,
                totalAttempts: record.attempts
            };
        }

        return {
            ...basicStats,
            semanticEnhancements: {
                executionHistorySize: this.executionHistory.length,
                collaborationPatterns: Object.keys(collaborationStats).length,
                memoryIntegration: true,
                vectorSearchEnabled: true
            },
            collaborationStats,
            agentLearningEnabled: true
        };
    }
}

module.exports = SemanticMultiAgentOrchestrator;