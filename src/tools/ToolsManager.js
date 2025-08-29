const axios = require('axios');

class ToolsManager {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.tools = new Map();
        this.registerBuiltinTools();
    }

    registerBuiltinTools() {
        // Memory & Task Management Tools
        this.registerTool({
            name: 'add_task',
            description: 'Add a new task or todo item',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'The task title' },
                    description: { type: 'string', description: 'Detailed description' },
                    priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
                    due_date: { type: 'string', description: 'Due date in ISO format (optional)' }
                },
                required: ['title']
            },
            execute: async (params) => {
                const taskId = this.memoryManager.addTask(
                    params.title,
                    params.description || '',
                    params.priority || 'medium',
                    params.due_date ? new Date(params.due_date) : null
                );
                return { success: true, task_id: taskId, message: `Task "${params.title}" added successfully` };
            }
        });

        this.registerTool({
            name: 'get_tasks',
            description: 'Get tasks by status',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Task status to filter by' }
                }
            },
            execute: async (params) => {
                const tasks = this.memoryManager.getTasksByStatus(params.status || 'pending');
                return { success: true, tasks, count: tasks.length };
            }
        });

        this.registerTool({
            name: 'update_task',
            description: 'Update task status',
            parameters: {
                type: 'object',
                properties: {
                    task_id: { type: 'number', description: 'The task ID to update' },
                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'New status' }
                },
                required: ['task_id', 'status']
            },
            execute: async (params) => {
                this.memoryManager.updateTask(params.task_id, params.status);
                return { success: true, message: `Task ${params.task_id} updated to ${params.status}` };
            }
        });

        // Knowledge & Notes Tools
        this.registerTool({
            name: 'add_note',
            description: 'Add a knowledge note or information',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Note title' },
                    content: { type: 'string', description: 'Note content' },
                    tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' }
                },
                required: ['title', 'content']
            },
            execute: async (params) => {
                const noteId = this.memoryManager.addKnowledge(
                    params.title,
                    params.content,
                    params.tags || [],
                    'manual'
                );
                return { success: true, note_id: noteId, message: `Note "${params.title}" saved` };
            }
        });

        this.registerTool({
            name: 'search_memory',
            description: 'Search through knowledge, notes, and memory',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    limit: { type: 'number', description: 'Maximum results to return', default: 10 }
                },
                required: ['query']
            },
            execute: async (params) => {
                const results = this.memoryManager.searchMemory(params.query, params.limit || 10);
                return { success: true, results, count: results.length };
            }
        });

        // Entity Management Tools
        this.registerTool({
            name: 'remember_person',
            description: 'Remember information about a person',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Person name' },
                    description: { type: 'string', description: 'Information about the person' },
                    relationship: { type: 'string', description: 'Relationship to user' }
                },
                required: ['name', 'description']
            },
            execute: async (params) => {
                const entityId = this.memoryManager.addEntity(
                    params.name,
                    'person',
                    params.description,
                    { relationship: params.relationship }
                );
                return { success: true, entity_id: entityId, message: `Remembered ${params.name}` };
            }
        });

        // Web Search Tool
        this.registerTool({
            name: 'web_search',
            description: 'Search the web for current information',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    num_results: { type: 'number', description: 'Number of results', default: 5 }
                },
                required: ['query']
            },
            execute: async (params) => {
                try {
                    // Simple DuckDuckGo search implementation
                    const response = await axios.get('https://api.duckduckgo.com/', {
                        params: {
                            q: params.query,
                            format: 'json',
                            no_html: '1',
                            skip_disambig: '1'
                        }
                    });
                    
                    const results = response.data.RelatedTopics?.slice(0, params.num_results || 5) || [];
                    const searchResults = results.map(topic => ({
                        title: topic.Text || 'No title',
                        url: topic.FirstURL || '',
                        snippet: topic.Text || ''
                    }));

                    // Store search in knowledge base
                    this.memoryManager.addKnowledge(
                        `Web Search: ${params.query}`,
                        `Search results: ${JSON.stringify(searchResults, null, 2)}`,
                        ['web_search', 'external'],
                        'web_search'
                    );

                    return { 
                        success: true, 
                        results: searchResults,
                        query: params.query,
                        count: searchResults.length
                    };
                } catch (error) {
                    return { 
                        success: false, 
                        error: 'Web search failed',
                        details: error.message 
                    };
                }
            }
        });

        // Preference Management
        this.registerTool({
            name: 'set_preference',
            description: 'Set a user preference or setting',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'Preference key' },
                    value: { type: 'string', description: 'Preference value' },
                    type: { type: 'string', enum: ['string', 'number', 'boolean', 'json'], default: 'string' }
                },
                required: ['key', 'value']
            },
            execute: async (params) => {
                this.memoryManager.setUserPreference(params.key, params.value, params.type || 'string');
                return { success: true, message: `Preference ${params.key} set to ${params.value}` };
            }
        });

        this.registerTool({
            name: 'get_preference',
            description: 'Get a user preference or setting',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'Preference key' }
                },
                required: ['key']
            },
            execute: async (params) => {
                const value = this.memoryManager.getUserPreference(params.key);
                return { success: true, key: params.key, value, exists: value !== null };
            }
        });

        console.log(`✅ Registered ${this.tools.size} built-in tools`);
    }

    registerTool(toolDefinition) {
        if (!toolDefinition.name || !toolDefinition.execute) {
            throw new Error('Tool must have name and execute function');
        }
        
        this.tools.set(toolDefinition.name, {
            ...toolDefinition,
            registered_at: new Date().toISOString()
        });
    }

    getToolDefinitions() {
        const definitions = [];
        for (const [name, tool] of this.tools) {
            definitions.push({
                name,
                description: tool.description,
                parameters: tool.parameters
            });
        }
        return definitions;
    }

    async executeTool(toolName, parameters) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool "${toolName}" not found`);
        }

        try {
            console.log(`🔧 Executing tool: ${toolName}`, parameters);
            const result = await tool.execute(parameters);
            console.log(`✅ Tool ${toolName} completed:`, result);
            return result;
        } catch (error) {
            console.error(`❌ Tool ${toolName} failed:`, error);
            throw error;
        }
    }

    getAvailableTools() {
        return Array.from(this.tools.keys());
    }

    getToolInfo(toolName) {
        const tool = this.tools.get(toolName);
        if (!tool) return null;
        
        return {
            name: toolName,
            description: tool.description,
            parameters: tool.parameters,
            registered_at: tool.registered_at
        };
    }
}

module.exports = ToolsManager;
