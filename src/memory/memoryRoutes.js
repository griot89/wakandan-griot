const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

function createMemoryRoutes(memoryManager) {
    const router = express.Router();

    // Get memory statistics
    router.get('/stats', (req, res) => {
        try {
            const stats = memoryManager.getStats();
            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get conversation history
    router.get('/conversations/:id?', (req, res) => {
        try {
            const conversationId = req.params.id || 'main';
            const limit = parseInt(req.query.limit) || 50;
            
            const messages = memoryManager.getConversationHistory(conversationId, limit);
            res.json({
                success: true,
                conversation_id: conversationId,
                messages: messages
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Search entities
    router.get('/entities/search', (req, res) => {
        try {
            const query = req.query.q;
            const limit = parseInt(req.query.limit) || 10;
            
            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query parameter "q" is required'
                });
            }
            
            const entities = memoryManager.searchEntities(query, limit);
            res.json({
                success: true,
                query: query,
                entities: entities
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Add entity
    router.post('/entities', (req, res) => {
        try {
            const { name, type, description, metadata, importance } = req.body;
            
            if (!name || !type) {
                return res.status(400).json({
                    success: false,
                    error: 'Name and type are required'
                });
            }
            
            const entityId = memoryManager.addEntity(
                name, 
                type, 
                description || '', 
                metadata || {}, 
                importance || 1.0
            );
            
            res.json({
                success: true,
                entity_id: entityId,
                message: `Entity "${name}" added successfully`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get tasks by status
    router.get('/tasks', (req, res) => {
        try {
            const status = req.query.status || 'pending';
            const tasks = memoryManager.getTasksByStatus(status);
            
            res.json({
                success: true,
                status: status,
                tasks: tasks
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Add task
    router.post('/tasks', (req, res) => {
        try {
            const { title, description, priority, due_date, metadata } = req.body;
            
            if (!title) {
                return res.status(400).json({
                    success: false,
                    error: 'Title is required'
                });
            }
            
            const dueDate = due_date ? new Date(due_date) : null;
            const taskId = memoryManager.addTask(
                title,
                description || '',
                priority || 'medium',
                dueDate,
                metadata || {}
            );
            
            res.json({
                success: true,
                task_id: taskId,
                message: `Task "${title}" added successfully`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Update task status
    router.put('/tasks/:id/status', (req, res) => {
        try {
            const taskId = parseInt(req.params.id);
            const { status } = req.body;
            
            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }
            
            memoryManager.updateTask(taskId, status);
            
            res.json({
                success: true,
                message: `Task ${taskId} status updated to ${status}`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Search knowledge/memory
    router.get('/knowledge/search', (req, res) => {
        try {
            const query = req.query.q;
            const limit = parseInt(req.query.limit) || 20;
            
            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query parameter "q" is required'
                });
            }
            
            const results = memoryManager.searchMemory(query, limit);
            res.json({
                success: true,
                query: query,
                results: results
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Add knowledge
    router.post('/knowledge', (req, res) => {
        try {
            const { title, content, tags, source, relevance } = req.body;
            
            if (!title || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'Title and content are required'
                });
            }
            
            const knowledgeId = memoryManager.addKnowledge(
                title,
                content,
                tags || [],
                source || 'manual',
                relevance || 1.0
            );
            
            res.json({
                success: true,
                knowledge_id: knowledgeId,
                message: `Knowledge "${title}" added successfully`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Get user preferences
    router.get('/preferences/:key?', (req, res) => {
        try {
            const key = req.params.key;
            
            if (key) {
                const value = memoryManager.getUserPreference(key);
                res.json({
                    success: true,
                    key: key,
                    value: value
                });
            } else {
                // Get all preferences - need to implement this
                res.json({
                    success: true,
                    message: 'Bulk preference retrieval not yet implemented'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Set user preference
    router.post('/preferences', (req, res) => {
        try {
            const { key, value, type } = req.body;
            
            if (!key || value === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Key and value are required'
                });
            }
            
            memoryManager.setUserPreference(key, value, type || 'string');
            
            res.json({
                success: true,
                message: `Preference "${key}" set successfully`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Export brain as JSON
    router.get('/brain/export', (req, res) => {
        try {
            const brainData = memoryManager.exportBrain();
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="g_brain_export.json"');
            res.json(brainData);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Export brain as tarball
    router.get('/brain/export/tarball', async (req, res) => {
        try {
            const brainData = memoryManager.exportBrain();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `g_brain_${timestamp}.tar.gz`;
            
            res.setHeader('Content-Type', 'application/gzip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            const archive = archiver('tar', {
                gzip: true,
                gzipOptions: {
                    level: 9,
                    memLevel: 9
                }
            });
            
            archive.on('error', (err) => {
                console.error('Archive error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: err.message });
                }
            });
            
            // Pipe archive to response
            archive.pipe(res);
            
            // Add brain data as JSON
            archive.append(JSON.stringify(brainData, null, 2), { name: 'brain_data.json' });
            
            // Add database file if it exists
            const dbPath = path.join(__dirname, '../../g_brain/memory.db');
            if (fs.existsSync(dbPath)) {
                archive.file(dbPath, { name: 'memory.db' });
            }
            
            // Add metadata
            const metadata = {
                export_type: 'g_brain_tarball',
                version: '1.0',
                exported_at: new Date().toISOString(),
                stats: memoryManager.getStats()
            };
            archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
            
            // Finalize archive
            await archive.finalize();
            
        } catch (error) {
            console.error('Brain export error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    });

    // Import brain data
    router.post('/brain/import', (req, res) => {
        try {
            const { data, overwrite } = req.body;
            
            if (!data) {
                return res.status(400).json({
                    success: false,
                    error: 'Brain data is required'
                });
            }
            
            memoryManager.importBrain(data, overwrite || false);
            
            res.json({
                success: true,
                message: 'Brain data imported successfully',
                overwrite: overwrite || false
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createMemoryRoutes;
