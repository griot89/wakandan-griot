/**
 * Base Agent Class for G Assistant Multi-Agent System
 * Provides common functionality for all specialized agents
 */

class BaseAgent {
    constructor(name, description, capabilities = [], aiOrchestrator = null) {
        this.name = name;
        this.description = description;
        this.capabilities = capabilities;
        this.aiOrchestrator = aiOrchestrator;
        this.isActive = false;
        this.taskHistory = [];
        this.performance = {
            tasksCompleted: 0,
            successRate: 100,
            averageExecutionTime: 0
        };
        
        // Agent-specific configuration
        this.config = {
            maxConcurrentTasks: 3,
            timeout: 30000, // 30 seconds
            retryAttempts: 2,
            priority: 'medium'
        };
        
        this.currentTasks = new Set();
        
        console.log(`🤖 Agent ${this.name} initialized with capabilities: ${capabilities.join(', ')}`);
    }

    /**
     * Check if agent can handle a specific task type
     */
    canHandle(taskType) {
        return this.capabilities.includes(taskType) || this.capabilities.includes('*');
    }

    /**
     * Get agent status and metrics
     */
    getStatus() {
        return {
            name: this.name,
            description: this.description,
            capabilities: this.capabilities,
            isActive: this.isActive,
            currentTasks: Array.from(this.currentTasks),
            performance: this.performance,
            config: this.config,
            lastActivity: this.taskHistory[this.taskHistory.length - 1]?.timestamp || null
        };
    }

    /**
     * Execute a task - to be overridden by specialized agents
     */
    async executeTask(task) {
        throw new Error(`Agent ${this.name} must implement executeTask method`);
    }

    /**
     * Wrapper for task execution with monitoring and error handling
     */
    async handleTask(task) {
        const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const startTime = Date.now();
        
        // Check if agent can handle this task
        if (!this.canHandle(task.type)) {
            throw new Error(`Agent ${this.name} cannot handle task type: ${task.type}`);
        }
        
        // Check concurrent task limits
        if (this.currentTasks.size >= this.config.maxConcurrentTasks) {
            throw new Error(`Agent ${this.name} is at maximum capacity (${this.config.maxConcurrentTasks} tasks)`);
        }
        
        this.currentTasks.add(taskId);
        this.isActive = true;
        
        try {
            console.log(`🚀 Agent ${this.name} starting task: ${task.type} (ID: ${taskId})`);
            
            // Set timeout for task execution
            const taskPromise = this.executeTask(task);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Task timeout after ${this.config.timeout}ms`)), this.config.timeout)
            );
            
            const result = await Promise.race([taskPromise, timeoutPromise]);
            const executionTime = Date.now() - startTime;
            
            // Record successful task
            this.recordTaskCompletion(taskId, task.type, executionTime, true, result);
            
            console.log(`✅ Agent ${this.name} completed task: ${task.type} in ${executionTime}ms`);
            
            return {
                success: true,
                result: result,
                agent: this.name,
                taskId: taskId,
                executionTime: executionTime,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            // Record failed task
            this.recordTaskCompletion(taskId, task.type, executionTime, false, null, error.message);
            
            console.error(`❌ Agent ${this.name} failed task: ${task.type} - ${error.message}`);
            
            return {
                success: false,
                error: error.message,
                agent: this.name,
                taskId: taskId,
                executionTime: executionTime,
                timestamp: new Date().toISOString()
            };
            
        } finally {
            this.currentTasks.delete(taskId);
            this.isActive = this.currentTasks.size > 0;
        }
    }

    /**
     * Record task completion for performance tracking
     */
    recordTaskCompletion(taskId, taskType, executionTime, success, result = null, error = null) {
        const taskRecord = {
            id: taskId,
            type: taskType,
            executionTime: executionTime,
            success: success,
            result: result,
            error: error,
            timestamp: new Date().toISOString()
        };
        
        this.taskHistory.push(taskRecord);
        
        // Keep only last 100 tasks in memory
        if (this.taskHistory.length > 100) {
            this.taskHistory = this.taskHistory.slice(-100);
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics();
    }

    /**
     * Update performance metrics based on task history
     */
    updatePerformanceMetrics() {
        if (this.taskHistory.length === 0) return;
        
        const recentTasks = this.taskHistory.slice(-50); // Last 50 tasks
        const successfulTasks = recentTasks.filter(task => task.success);
        
        this.performance.tasksCompleted = this.taskHistory.length;
        this.performance.successRate = (successfulTasks.length / recentTasks.length) * 100;
        this.performance.averageExecutionTime = recentTasks.reduce((sum, task) => sum + task.executionTime, 0) / recentTasks.length;
    }

    /**
     * Process query with AI if orchestrator is available
     */
    async queryAI(prompt, options = {}) {
        if (!this.aiOrchestrator) {
            throw new Error(`Agent ${this.name} does not have AI orchestrator configured`);
        }
        
        const systemPrompt = options.system || `You are ${this.name}, ${this.description}. Provide helpful, accurate responses within your area of expertise.`;
        
        return await this.aiOrchestrator.processQuery(prompt, {
            system: systemPrompt,
            source: `agent-${this.name.toLowerCase()}`,
            ...options
        });
    }

    /**
     * Validate task parameters - to be overridden by specialized agents
     */
    validateTaskParameters(task) {
        if (!task.type) {
            throw new Error('Task must have a type');
        }
        
        if (!this.canHandle(task.type)) {
            throw new Error(`Agent ${this.name} cannot handle task type: ${task.type}`);
        }
        
        return true;
    }

    /**
     * Get task priority based on agent's assessment
     */
    getTaskPriority(task) {
        // Default priority logic - can be overridden
        const priorityMap = {
            'urgent': 1,
            'high': 2,
            'medium': 3,
            'low': 4
        };
        
        return priorityMap[task.priority] || priorityMap[this.config.priority];
    }

    /**
     * Pause agent (stop accepting new tasks)
     */
    pause() {
        console.log(`⏸️  Agent ${this.name} paused`);
        this.config.acceptNewTasks = false;
    }

    /**
     * Resume agent
     */
    resume() {
        console.log(`▶️  Agent ${this.name} resumed`);
        this.config.acceptNewTasks = true;
    }

    /**
     * Shutdown agent gracefully
     */
    async shutdown() {
        console.log(`🛑 Agent ${this.name} shutting down...`);
        
        // Wait for current tasks to complete or timeout
        const shutdownPromise = new Promise((resolve) => {
            const checkTasks = () => {
                if (this.currentTasks.size === 0) {
                    resolve();
                } else {
                    setTimeout(checkTasks, 100);
                }
            };
            checkTasks();
        });
        
        const timeoutPromise = new Promise((resolve) => 
            setTimeout(resolve, 5000) // 5 second timeout
        );
        
        await Promise.race([shutdownPromise, timeoutPromise]);
        
        this.isActive = false;
        console.log(`✅ Agent ${this.name} shut down successfully`);
    }

    /**
     * Get agent's task history for analysis
     */
    getTaskHistory(limit = 50) {
        return this.taskHistory.slice(-limit);
    }

    /**
     * Clear task history (for memory management)
     */
    clearTaskHistory() {
        this.taskHistory = [];
        this.updatePerformanceMetrics();
    }
}

module.exports = BaseAgent;