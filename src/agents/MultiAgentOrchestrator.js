/**
 * Multi-Agent Orchestrator for G Assistant
 * Manages multiple specialized agents and coordinates complex tasks
 */

const CodeAgent = require('./CodeAgent');
const ResearchAgent = require('./ResearchAgent');
const PlanningAgent = require('./PlanningAgent');

class MultiAgentOrchestrator {
    constructor(aiOrchestrator = null, toolsManager = null) {
        this.aiOrchestrator = aiOrchestrator;
        this.toolsManager = toolsManager;
        
        // Initialize agents
        this.agents = new Map();
        this.taskQueue = [];
        this.activeTaskExecutions = new Map();
        this.taskHistory = [];
        
        // Orchestrator configuration
        this.config = {
            maxConcurrentTasks: 10,
            taskTimeout: 300000, // 5 minutes
            agentSelectionStrategy: 'capability_based', // capability_based, round_robin, performance_based
            coordinationEnabled: true,
            fallbackToGeneralAI: true
        };
        
        // Performance tracking
        this.metrics = {
            tasksProcessed: 0,
            successfulTasks: 0,
            averageExecutionTime: 0,
            agentUtilization: new Map(),
            startTime: new Date().toISOString()
        };
        
        this.initializeAgents();
        console.log('🤖 Multi-Agent Orchestrator initialized');
    }

    initializeAgents() {
        // Initialize specialized agents
        this.agents.set('code', new CodeAgent(this.aiOrchestrator));
        this.agents.set('research', new ResearchAgent(this.aiOrchestrator, this.toolsManager?.tools?.get('web_search')));
        this.agents.set('planning', new PlanningAgent(this.aiOrchestrator));
        
        // Initialize agent utilization tracking
        for (const [name, agent] of this.agents) {
            this.metrics.agentUtilization.set(name, {
                tasksAssigned: 0,
                tasksCompleted: 0,
                totalExecutionTime: 0,
                successRate: 100
            });
        }
        
        console.log(`✅ Initialized ${this.agents.size} specialized agents: ${Array.from(this.agents.keys()).join(', ')}`);
    }

    /**
     * Main entry point for processing complex tasks
     */
    async processComplexTask(task) {
        const taskId = task.id || this.generateTaskId();
        const startTime = Date.now();
        
        try {
            console.log(`🚀 Processing complex task: ${task.type} (ID: ${taskId})`);
            
            // Analyze task complexity and requirements
            const taskAnalysis = await this.analyzeTask(task);
            
            // Determine if task requires multiple agents
            if (taskAnalysis.requiresMultipleAgents) {
                return await this.handleMultiAgentTask(task, taskAnalysis);
            } else {
                return await this.handleSingleAgentTask(task, taskAnalysis);
            }
            
        } catch (error) {
            console.error(`❌ Complex task failed: ${error.message}`);
            
            // Record failure
            this.recordTaskCompletion(taskId, task.type, Date.now() - startTime, false, null, error.message);
            
            // Fallback to general AI if enabled
            if (this.config.fallbackToGeneralAI && this.aiOrchestrator) {
                console.log('🔄 Falling back to general AI...');
                return await this.fallbackToGeneralAI(task);
            }
            
            throw error;
        }
    }

    /**
     * Analyze task to determine agent requirements and complexity
     */
    async analyzeTask(task) {
        const analysisPrompt = `Analyze the following task to determine agent requirements:

Task Type: ${task.type}
Description: ${task.description || 'N/A'}
Parameters: ${JSON.stringify(task.parameters || {})}

Please determine:
1. Primary agent type needed (code, research, planning, or general)
2. Whether multiple agents are required (yes/no)
3. Task complexity level (low, medium, high)
4. Estimated execution time
5. Required capabilities
6. Dependencies on external resources
7. Risk level (low, medium, high)
8. Coordination requirements if multi-agent

Respond in JSON format.`;

        try {
            const analysis = await this.aiOrchestrator.processQuery(analysisPrompt, {
                system: 'You are a task analysis expert. Analyze tasks to determine optimal agent assignment and coordination requirements. Always respond with valid JSON.',
                source: 'multi-agent-orchestrator'
            });

            // Parse AI response and extract analysis
            const analysisData = this.parseTaskAnalysis(analysis.content);
            
            return {
                primaryAgent: analysisData.primaryAgent || this.determinePrimaryAgent(task),
                requiresMultipleAgents: analysisData.requiresMultipleAgents || false,
                complexity: analysisData.complexity || 'medium',
                estimatedTime: analysisData.estimatedTime || 30000,
                requiredCapabilities: analysisData.requiredCapabilities || [task.type],
                riskLevel: analysisData.riskLevel || 'medium',
                coordinationRequired: analysisData.coordinationRequired || false
            };
            
        } catch (error) {
            console.warn('Task analysis failed, using fallback analysis:', error.message);
            return this.fallbackTaskAnalysis(task);
        }
    }

    /**
     * Handle task that requires a single agent
     */
    async handleSingleAgentTask(task, analysis) {
        const agent = this.selectAgent(analysis.primaryAgent, analysis.requiredCapabilities);
        
        if (!agent) {
            throw new Error(`No suitable agent found for task type: ${task.type}`);
        }
        
        const taskId = task.id || this.generateTaskId();
        this.activeTaskExecutions.set(taskId, {
            agent: agent.name,
            startTime: Date.now(),
            status: 'executing'
        });
        
        try {
            const result = await agent.handleTask(task);
            
            // Record successful completion
            const executionTime = Date.now() - this.activeTaskExecutions.get(taskId).startTime;
            this.recordTaskCompletion(taskId, task.type, executionTime, result.success, result);
            this.updateAgentMetrics(agent.name, executionTime, result.success);
            
            return {
                ...result,
                orchestration: {
                    strategy: 'single-agent',
                    agent_used: agent.name,
                    task_analysis: analysis
                }
            };
            
        } finally {
            this.activeTaskExecutions.delete(taskId);
        }
    }

    /**
     * Handle task that requires multiple agents working together
     */
    async handleMultiAgentTask(task, analysis) {
        const taskId = task.id || this.generateTaskId();
        console.log(`🔗 Handling multi-agent task: ${taskId}`);
        
        // Break down the task into sub-tasks for different agents
        const subTasks = await this.decomposeTask(task, analysis);
        
        // Execute sub-tasks with appropriate coordination
        const results = [];
        const startTime = Date.now();
        
        try {
            if (analysis.coordinationRequired) {
                // Sequential execution with coordination
                for (const subTask of subTasks) {
                    const agent = this.selectAgent(subTask.agentType, subTask.capabilities);
                    if (agent) {
                        const result = await agent.handleTask(subTask);
                        results.push({
                            subTask: subTask,
                            result: result,
                            agent: agent.name
                        });
                        
                        // Update subsequent tasks based on results if needed
                        this.updateSubsequentTasks(subTasks, result);
                    }
                }
            } else {
                // Parallel execution
                const promises = subTasks.map(async (subTask) => {
                    const agent = this.selectAgent(subTask.agentType, subTask.capabilities);
                    if (agent) {
                        const result = await agent.handleTask(subTask);
                        return {
                            subTask: subTask,
                            result: result,
                            agent: agent.name
                        };
                    }
                    return null;
                });
                
                const parallelResults = await Promise.allSettled(promises);
                results.push(...parallelResults.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value));
            }
            
            // Synthesize results from multiple agents
            const synthesizedResult = await this.synthesizeResults(task, results);
            
            const executionTime = Date.now() - startTime;
            this.recordTaskCompletion(taskId, task.type, executionTime, true, synthesizedResult);
            
            return {
                success: true,
                result: synthesizedResult,
                orchestration: {
                    strategy: 'multi-agent',
                    agents_used: results.map(r => r.agent),
                    sub_tasks_count: subTasks.length,
                    coordination_type: analysis.coordinationRequired ? 'sequential' : 'parallel',
                    task_analysis: analysis
                }
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.recordTaskCompletion(taskId, task.type, executionTime, false, null, error.message);
            throw error;
        }
    }

    /**
     * Decompose complex task into sub-tasks for different agents
     */
    async decomposeTask(task, analysis) {
        const decompositionPrompt = `Break down the following complex task into sub-tasks for specialized agents:

Main Task: ${task.type}
Description: ${task.description || 'N/A'}
Parameters: ${JSON.stringify(task.parameters || {})}
Analysis: ${JSON.stringify(analysis)}

Available Agents:
- CodeAgent: ${this.agents.get('code').capabilities.join(', ')}
- ResearchAgent: ${this.agents.get('research').capabilities.join(', ')}
- PlanningAgent: ${this.agents.get('planning').capabilities.join(', ')}

Please create sub-tasks that can be handled by these agents. For each sub-task provide:
1. Agent type (code, research, planning)
2. Task type from agent's capabilities
3. Description
4. Parameters
5. Priority (high, medium, low)
6. Dependencies on other sub-tasks

Respond with a JSON array of sub-tasks.`;

        try {
            const decomposition = await this.aiOrchestrator.processQuery(decompositionPrompt, {
                system: 'You are an expert at task decomposition for multi-agent systems. Create clear, executable sub-tasks that leverage each agent\'s strengths.',
                source: 'multi-agent-decomposition'
            });

            const subTasks = this.parseSubTasks(decomposition.content);
            return subTasks.length > 0 ? subTasks : this.createFallbackSubTasks(task);
            
        } catch (error) {
            console.warn('Task decomposition failed, using fallback:', error.message);
            return this.createFallbackSubTasks(task);
        }
    }

    /**
     * Synthesize results from multiple agents into a coherent response
     */
    async synthesizeResults(originalTask, agentResults) {
        const synthesisPrompt = `Synthesize the following results from multiple specialized agents into a coherent response for the original task:

Original Task: ${originalTask.type}
Description: ${originalTask.description || 'N/A'}

Agent Results:
${agentResults.map(ar => 
    `${ar.agent} (${ar.subTask.type}): ${JSON.stringify(ar.result, null, 2)}`
).join('\n\n')}

Please provide:
1. Integrated summary of all findings
2. Key insights and conclusions
3. Recommendations based on combined analysis
4. Identification of any conflicts or inconsistencies
5. Overall assessment and next steps
6. Quality evaluation of the combined results`;

        try {
            const synthesis = await this.aiOrchestrator.processQuery(synthesisPrompt, {
                system: 'You are an expert at synthesizing information from multiple sources. Create comprehensive, coherent responses that integrate diverse perspectives and findings.',
                source: 'multi-agent-synthesis'
            });

            return {
                synthesized_response: synthesis.content,
                agent_contributions: agentResults.length,
                integration_quality: 0.9,
                individual_results: agentResults,
                synthesis_timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.warn('Result synthesis failed, returning raw results:', error.message);
            return {
                raw_results: agentResults,
                synthesis_error: error.message,
                fallback_used: true
            };
        }
    }

    /**
     * Select the best agent for a task based on capabilities and performance
     */
    selectAgent(preferredType, requiredCapabilities = []) {
        // First try to get preferred agent if it can handle the capabilities
        if (preferredType && this.agents.has(preferredType)) {
            const preferredAgent = this.agents.get(preferredType);
            if (requiredCapabilities.every(cap => preferredAgent.canHandle(cap))) {
                return preferredAgent;
            }
        }
        
        // Find agents that can handle all required capabilities
        const capableAgents = Array.from(this.agents.values()).filter(agent => 
            requiredCapabilities.every(cap => agent.canHandle(cap))
        );
        
        if (capableAgents.length === 0) {
            return null;
        }
        
        // Select based on strategy
        switch (this.config.agentSelectionStrategy) {
            case 'performance_based':
                return this.selectByPerformance(capableAgents);
            case 'round_robin':
                return this.selectRoundRobin(capableAgents);
            case 'capability_based':
            default:
                return this.selectByCapability(capableAgents, requiredCapabilities);
        }
    }

    selectByPerformance(agents) {
        // Select agent with best performance metrics
        return agents.reduce((best, current) => 
            current.performance.successRate > best.performance.successRate ? current : best
        );
    }

    selectRoundRobin(agents) {
        // Simple round-robin selection
        if (!this.lastSelectedIndex) this.lastSelectedIndex = new Map();
        
        const agentNames = agents.map(a => a.name);
        const key = agentNames.join(',');
        const lastIndex = this.lastSelectedIndex.get(key) || 0;
        const nextIndex = (lastIndex + 1) % agents.length;
        
        this.lastSelectedIndex.set(key, nextIndex);
        return agents[nextIndex];
    }

    selectByCapability(agents, requiredCapabilities) {
        // Select agent with most specific capabilities match
        return agents.reduce((best, current) => {
            const currentMatch = requiredCapabilities.filter(cap => current.capabilities.includes(cap)).length;
            const bestMatch = requiredCapabilities.filter(cap => best.capabilities.includes(cap)).length;
            return currentMatch > bestMatch ? current : best;
        });
    }

    /**
     * Fallback to general AI when agents cannot handle the task
     */
    async fallbackToGeneralAI(task) {
        console.log('🔄 Using general AI fallback');
        
        const prompt = `Handle the following task using general AI capabilities:

Task Type: ${task.type}
Description: ${task.description || 'N/A'}
Parameters: ${JSON.stringify(task.parameters || {})}

Please provide a comprehensive response addressing the task requirements.`;

        const response = await this.aiOrchestrator.processQuery(prompt, {
            system: 'You are a general AI assistant. Handle this task to the best of your abilities, providing helpful and accurate information.',
            source: 'multi-agent-fallback'
        });

        return {
            success: true,
            result: response.content,
            orchestration: {
                strategy: 'general-ai-fallback',
                reason: 'No suitable specialized agent available'
            }
        };
    }

    // Utility methods
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    determinePrimaryAgent(task) {
        // Simple heuristics for agent selection
        const taskType = task.type.toLowerCase();
        
        if (taskType.includes('code') || taskType.includes('develop') || taskType.includes('debug')) {
            return 'code';
        }
        if (taskType.includes('research') || taskType.includes('analyze') || taskType.includes('fact')) {
            return 'research';
        }
        if (taskType.includes('plan') || taskType.includes('coordinate') || taskType.includes('timeline')) {
            return 'planning';
        }
        
        return 'research'; // Default to research agent
    }

    parseTaskAnalysis(content) {
        try {
            // Try to parse as JSON
            return JSON.parse(content);
        } catch {
            // Fallback parsing
            return {
                primaryAgent: this.extractValue(content, 'primary agent', 'research'),
                requiresMultipleAgents: content.toLowerCase().includes('multiple') || content.toLowerCase().includes('yes'),
                complexity: this.extractValue(content, 'complexity', 'medium'),
                riskLevel: this.extractValue(content, 'risk', 'medium')
            };
        }
    }

    extractValue(text, key, defaultValue) {
        const regex = new RegExp(`${key}[:\s]+([^,\n]+)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim().toLowerCase() : defaultValue;
    }

    parseSubTasks(content) {
        try {
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            // Fallback: create simple sub-tasks
            return [];
        }
    }

    createFallbackSubTasks(task) {
        // Create simple sub-tasks based on task type
        return [{
            id: `${task.id || 'fallback'}_1`,
            type: task.type,
            agentType: this.determinePrimaryAgent(task),
            description: task.description || `Execute ${task.type} task`,
            parameters: task.parameters || {},
            capabilities: [task.type],
            priority: 'medium'
        }];
    }

    fallbackTaskAnalysis(task) {
        return {
            primaryAgent: this.determinePrimaryAgent(task),
            requiresMultipleAgents: false,
            complexity: 'medium',
            estimatedTime: 30000,
            requiredCapabilities: [task.type],
            riskLevel: 'medium',
            coordinationRequired: false
        };
    }

    updateSubsequentTasks(subTasks, completedResult) {
        // In a more sophisticated implementation, this would update
        // parameters of dependent tasks based on completed results
        console.log('📝 Updating subsequent tasks based on completed result');
    }

    recordTaskCompletion(taskId, taskType, executionTime, success, result = null, error = null) {
        const record = {
            id: taskId,
            type: taskType,
            executionTime: executionTime,
            success: success,
            result: result,
            error: error,
            timestamp: new Date().toISOString()
        };
        
        this.taskHistory.push(record);
        
        // Update metrics
        this.metrics.tasksProcessed++;
        if (success) this.metrics.successfulTasks++;
        this.updateAverageExecutionTime(executionTime);
        
        // Keep only last 1000 task records
        if (this.taskHistory.length > 1000) {
            this.taskHistory = this.taskHistory.slice(-1000);
        }
    }

    updateAgentMetrics(agentName, executionTime, success) {
        const metrics = this.metrics.agentUtilization.get(agentName);
        if (metrics) {
            metrics.tasksAssigned++;
            if (success) {
                metrics.tasksCompleted++;
            }
            metrics.totalExecutionTime += executionTime;
            metrics.successRate = (metrics.tasksCompleted / metrics.tasksAssigned) * 100;
        }
    }

    updateAverageExecutionTime(newTime) {
        const currentAvg = this.metrics.averageExecutionTime;
        const count = this.metrics.tasksProcessed;
        this.metrics.averageExecutionTime = (currentAvg * (count - 1) + newTime) / count;
    }

    /**
     * Get orchestrator status and metrics
     */
    getStatus() {
        return {
            agents: Array.from(this.agents.entries()).map(([name, agent]) => ({
                name: name,
                status: agent.getStatus()
            })),
            activeTaskExecutions: this.activeTaskExecutions.size,
            queuedTasks: this.taskQueue.length,
            metrics: this.metrics,
            configuration: this.config,
            uptime: Date.now() - new Date(this.metrics.startTime).getTime()
        };
    }

    /**
     * Get available capabilities across all agents
     */
    getCapabilities() {
        const capabilities = new Set();
        for (const agent of this.agents.values()) {
            agent.capabilities.forEach(cap => capabilities.add(cap));
        }
        return Array.from(capabilities);
    }

    /**
     * Shutdown orchestrator gracefully
     */
    async shutdown() {
        console.log('🛑 Shutting down Multi-Agent Orchestrator...');
        
        // Shutdown all agents
        const shutdownPromises = Array.from(this.agents.values()).map(agent => agent.shutdown());
        await Promise.allSettled(shutdownPromises);
        
        // Clear active executions
        this.activeTaskExecutions.clear();
        this.taskQueue.length = 0;
        
        console.log('✅ Multi-Agent Orchestrator shut down successfully');
    }
}

module.exports = MultiAgentOrchestrator;