const express = require('express');
const router = express.Router();

function createVectorRoutes(semanticMemoryManager) {
    // Semantic search endpoint
    router.post('/search/semantic', async (req, res) => {
        try {
            const { 
                query, 
                threshold = 0.7, 
                maxResults = 10, 
                type = null,
                conversationHistory = [],
                userPreferences = {}
            } = req.body;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query is required'
                });
            }

            const results = await semanticMemoryManager.retrieveMemories(query, {
                useSemanticSearch: true,
                semanticThreshold: threshold,
                maxResults,
                type
            });

            res.json(results);
        } catch (error) {
            console.error('Error in semantic search:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Contextual search endpoint
    router.post('/search/contextual', async (req, res) => {
        try {
            const { 
                query, 
                conversationHistory = [],
                userPreferences = {}
            } = req.body;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query is required'
                });
            }

            const results = await semanticMemoryManager.contextualSearch(
                query, 
                conversationHistory, 
                userPreferences
            );

            res.json(results);
        } catch (error) {
            console.error('Error in contextual search:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Find related memories endpoint
    router.get('/related/:memoryId', async (req, res) => {
        try {
            const { memoryId } = req.params;
            const { threshold = 0.8, limit = 5 } = req.query;

            const results = await semanticMemoryManager.findRelatedMemories(
                memoryId, 
                parseFloat(threshold), 
                parseInt(limit)
            );

            res.json(results);
        } catch (error) {
            console.error('Error finding related memories:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Memory clusters endpoint
    router.get('/clusters', async (req, res) => {
        try {
            const { threshold = 0.8 } = req.query;

            const results = await semanticMemoryManager.getMemoryClusters(
                parseFloat(threshold)
            );

            res.json(results);
        } catch (error) {
            console.error('Error getting memory clusters:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Vector database statistics endpoint
    router.get('/vector/stats', async (req, res) => {
        try {
            const stats = await semanticMemoryManager.getEnhancedStats();
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Error getting vector stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Direct vector search endpoint
    router.post('/vector/search', async (req, res) => {
        try {
            const { 
                query, 
                threshold = 0.7, 
                limit = 10 
            } = req.body;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query is required'
                });
            }

            const results = await semanticMemoryManager.vectorService.searchSimilar(
                query, 
                parseInt(limit), 
                parseFloat(threshold)
            );

            res.json(results);
        } catch (error) {
            console.error('Error in vector search:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Add document to vector database endpoint
    router.post('/vector/add', async (req, res) => {
        try {
            const { id, content, metadata = {} } = req.body;

            if (!id || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'ID and content are required'
                });
            }

            const result = await semanticMemoryManager.vectorService.addDocument(
                id, 
                content, 
                metadata
            );

            res.json(result);
        } catch (error) {
            console.error('Error adding document to vector database:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Batch add documents endpoint
    router.post('/vector/batch-add', async (req, res) => {
        try {
            const { documents } = req.body;

            if (!documents || !Array.isArray(documents)) {
                return res.status(400).json({
                    success: false,
                    error: 'Documents array is required'
                });
            }

            const result = await semanticMemoryManager.vectorService.batchAddDocuments(documents);
            res.json(result);
        } catch (error) {
            console.error('Error batch adding documents:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Remove document from vector database endpoint
    router.delete('/vector/:id', async (req, res) => {
        try {
            const { id } = req.params;

            const result = await semanticMemoryManager.vectorService.removeDocument(id);
            res.json(result);
        } catch (error) {
            console.error('Error removing document from vector database:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Clear vector database endpoint (admin only)
    router.delete('/vector/clear', async (req, res) => {
        try {
            const { confirm } = req.body;

            if (confirm !== 'YES_CLEAR_ALL_VECTORS') {
                return res.status(400).json({
                    success: false,
                    error: 'Confirmation required: send {"confirm": "YES_CLEAR_ALL_VECTORS"}'
                });
            }

            const result = await semanticMemoryManager.vectorService.clearDatabase();
            res.json(result);
        } catch (error) {
            console.error('Error clearing vector database:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Generate embedding for text endpoint
    router.post('/vector/embed', async (req, res) => {
        try {
            const { text } = req.body;

            if (!text) {
                return res.status(400).json({
                    success: false,
                    error: 'Text is required'
                });
            }

            const embedding = await semanticMemoryManager.vectorService.generateEmbedding(text);
            
            res.json({
                success: true,
                text,
                embedding,
                dimension: embedding.length
            });
        } catch (error) {
            console.error('Error generating embedding:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Similarity calculation endpoint
    router.post('/vector/similarity', async (req, res) => {
        try {
            const { text1, text2 } = req.body;

            if (!text1 || !text2) {
                return res.status(400).json({
                    success: false,
                    error: 'Both text1 and text2 are required'
                });
            }

            const [embedding1, embedding2] = await Promise.all([
                semanticMemoryManager.vectorService.generateEmbedding(text1),
                semanticMemoryManager.vectorService.generateEmbedding(text2)
            ]);

            const similarity = semanticMemoryManager.vectorService.cosineSimilarity(
                embedding1, 
                embedding2
            );

            res.json({
                success: true,
                text1,
                text2,
                similarity,
                similarityPercentage: Math.round(similarity * 100)
            });
        } catch (error) {
            console.error('Error calculating similarity:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    return router;
}

module.exports = createVectorRoutes;