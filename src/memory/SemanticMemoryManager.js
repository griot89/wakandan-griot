const MemoryManager = require('./MemoryManager');
const VectorService = require('../services/VectorService');

class SemanticMemoryManager extends MemoryManager {
    constructor() {
        super();
        this.vectorService = new VectorService();
        this.semanticSearchEnabled = true;
        this.embeddingCache = new Map();
        this.initialize();
    }

    async initialize() {
        console.log('Initializing Semantic Memory Manager...');
        
        // Migrate existing memories to vector database if not already done
        await this.migrateExistingMemories();
        
        console.log('Semantic Memory Manager initialized with vector search capabilities');
    }

    /**
     * Enhanced memory storage with automatic vector indexing
     */
    async storeMemory(type, content, context = {}) {
        try {
            // Store in traditional memory system using addMessage
            const messageId = this.addMessage(type, content, context.conversationId || 'main', context);
            
            if (messageId) {
                // Add to vector database for semantic search
                const vectorId = `memory_${messageId}`;
                const vectorContent = this.createVectorContent(type, content, context);
                
                await this.vectorService.addDocument(vectorId, vectorContent, {
                    memoryId: messageId,
                    type,
                    context,
                    category: 'memory'
                });
                
                return {
                    success: true,
                    memoryId: messageId,
                    vectorIndexed: true,
                    semanticSearchEnabled: true
                };
            }
            
            return { success: false, error: 'Failed to store message' };
        } catch (error) {
            console.error('Error storing semantic memory:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enhanced memory retrieval with semantic search
     */
    async retrieveMemories(query, options = {}) {
        try {
            const {
                useSemanticSearch = true,
                combinedSearch = true,
                semanticThreshold = 0.7,
                maxResults = 10,
                type = null
            } = options;

            let results = [];

            // Traditional keyword search
            const traditionalResults = {
                memories: this.searchMemory(query, maxResults) || [],
                success: true
            };

            if (useSemanticSearch && this.semanticSearchEnabled) {
                // Semantic vector search
                const semanticResults = await this.vectorService.searchSimilar(
                    query, 
                    maxResults, 
                    semanticThreshold
                );

                if (semanticResults.success) {
                    // Combine and deduplicate results
                    const combinedResults = await this.combineSearchResults(
                        traditionalResults.memories,
                        semanticResults.results,
                        query
                    );

                    return {
                        success: true,
                        query,
                        memories: combinedResults,
                        searchMethod: 'semantic_enhanced',
                        semanticMatches: semanticResults.results.length,
                        traditionalMatches: traditionalResults.memories?.length || 0
                    };
                }
            }

            // Fallback to traditional search
            return {
                ...traditionalResults,
                searchMethod: 'traditional',
                semanticSearchAvailable: this.semanticSearchEnabled
            };

        } catch (error) {
            console.error('Error retrieving semantic memories:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Find semantically related memories
     */
    async findRelatedMemories(memoryId, threshold = 0.8, limit = 5) {
        try {
            const memory = await this.getMemoryById(memoryId);
            if (!memory) {
                return {
                    success: false,
                    error: 'Memory not found'
                };
            }

            const vectorId = `memory_${memoryId}`;
            const searchContent = this.createVectorContent(
                memory.type, 
                memory.content, 
                memory.context || {}
            );

            const similarResults = await this.vectorService.searchSimilar(
                searchContent, 
                limit + 1, // +1 to exclude the original memory
                threshold
            );

            if (similarResults.success) {
                // Filter out the original memory
                const relatedMemories = similarResults.results.filter(
                    result => result.metadata.memoryId !== memoryId
                );

                return {
                    success: true,
                    originalMemory: memory,
                    relatedMemories,
                    relationshipType: 'semantic_similarity'
                };
            }

            return similarResults;
        } catch (error) {
            console.error('Error finding related memories:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get memory clusters for knowledge organization
     */
    async getMemoryClusters(threshold = 0.8) {
        try {
            const clusters = await this.vectorService.getSemanticClusters(threshold);
            
            if (clusters.success) {
                // Enrich clusters with memory details
                const enrichedClusters = await Promise.all(
                    clusters.clusters.map(async cluster => {
                        const memories = await Promise.all(
                            cluster.documents.map(async doc => {
                                if (doc.metadata.memoryId) {
                                    return await this.getMemoryById(doc.metadata.memoryId);
                                }
                                return null;
                            })
                        );
                        
                        return {
                            ...cluster,
                            memories: memories.filter(m => m !== null),
                            theme: await this.identifyClusterTheme(cluster)
                        };
                    })
                );

                return {
                    success: true,
                    clusters: enrichedClusters,
                    totalClusters: enrichedClusters.length
                };
            }

            return clusters;
        } catch (error) {
            console.error('Error getting memory clusters:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enhanced memory search with context awareness
     */
    async contextualSearch(query, conversationHistory = [], userPreferences = {}) {
        try {
            // Build enhanced query with context
            const contextualQuery = this.buildContextualQuery(
                query, 
                conversationHistory, 
                userPreferences
            );

            // Perform semantic search with enhanced query
            const results = await this.retrieveMemories(contextualQuery, {
                useSemanticSearch: true,
                semanticThreshold: 0.65, // Lower threshold for contextual search
                maxResults: 15
            });

            if (results.success) {
                // Re-rank results based on context relevance
                const contextualResults = await this.rankByContextualRelevance(
                    results.memories,
                    query,
                    conversationHistory,
                    userPreferences
                );

                return {
                    ...results,
                    memories: contextualResults,
                    searchMethod: 'contextual_semantic',
                    contextEnhanced: true
                };
            }

            return results;
        } catch (error) {
            console.error('Error in contextual search:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create optimized content for vector storage
     */
    createVectorContent(type, content, context) {
        let vectorContent = `Type: ${type}\nContent: ${content}`;
        
        if (context && Object.keys(context).length > 0) {
            const contextString = Object.entries(context)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            vectorContent += `\nContext: ${contextString}`;
        }
        
        return vectorContent;
    }

    /**
     * Combine traditional and semantic search results
     */
    async combineSearchResults(traditionalResults, semanticResults, query) {
        const combined = new Map();
        const scoreWeights = { traditional: 0.4, semantic: 0.6 };

        // Add traditional results
        traditionalResults.forEach((memory, index) => {
            const score = (traditionalResults.length - index) / traditionalResults.length;
            combined.set(memory.id, {
                ...memory,
                relevanceScore: score * scoreWeights.traditional,
                searchType: 'traditional'
            });
        });

        // Add semantic results
        semanticResults.forEach(result => {
            const memoryId = result.metadata.memoryId;
            if (combined.has(memoryId)) {
                // Boost score for memories found by both methods
                const existing = combined.get(memoryId);
                existing.relevanceScore += result.similarity * scoreWeights.semantic * 1.2;
                existing.searchType = 'combined';
                existing.semanticSimilarity = result.similarity;
            } else {
                combined.set(memoryId, {
                    id: memoryId,
                    relevanceScore: result.similarity * scoreWeights.semantic,
                    searchType: 'semantic',
                    semanticSimilarity: result.similarity,
                    content: result.content,
                    metadata: result.metadata
                });
            }
        });

        // Sort by relevance score and return top results
        return Array.from(combined.values())
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 10);
    }

    /**
     * Build contextual query with conversation history
     */
    buildContextualQuery(query, conversationHistory, userPreferences) {
        let contextualQuery = query;
        
        // Add recent conversation context
        if (conversationHistory.length > 0) {
            const recentContext = conversationHistory
                .slice(-3) // Last 3 exchanges
                .map(msg => msg.content)
                .join(' ');
            contextualQuery += ` Context: ${recentContext}`;
        }
        
        // Add user preferences
        if (userPreferences && Object.keys(userPreferences).length > 0) {
            const prefString = Object.entries(userPreferences)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            contextualQuery += ` User preferences: ${prefString}`;
        }
        
        return contextualQuery;
    }

    /**
     * Rank results by contextual relevance
     */
    async rankByContextualRelevance(memories, query, conversationHistory, userPreferences) {
        // Simple contextual ranking based on recency and user interaction patterns
        return memories.map(memory => {
            let contextualScore = memory.relevanceScore || 0;
            
            // Boost recent memories
            const daysSinceCreation = (Date.now() - new Date(memory.timestamp)) / (1000 * 60 * 60 * 24);
            const recencyBoost = Math.max(0, 1 - daysSinceCreation / 30); // Boost for memories < 30 days old
            contextualScore += recencyBoost * 0.1;
            
            // Boost memories matching user preferences
            if (userPreferences && memory.context) {
                const prefMatches = Object.keys(userPreferences).filter(
                    pref => memory.context[pref] === userPreferences[pref]
                ).length;
                contextualScore += prefMatches * 0.05;
            }
            
            return {
                ...memory,
                contextualScore
            };
        }).sort((a, b) => b.contextualScore - a.contextualScore);
    }

    /**
     * Identify theme for memory clusters
     */
    async identifyClusterTheme(cluster) {
        try {
            const contents = cluster.documents.map(doc => doc.content).join(' ');
            const words = contents.toLowerCase().split(/\s+/);
            const wordFreq = {};
            
            words.forEach(word => {
                if (word.length > 3) { // Filter short words
                    wordFreq[word] = (wordFreq[word] || 0) + 1;
                }
            });
            
            // Get top 3 most frequent words as theme
            const topWords = Object.entries(wordFreq)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([word]) => word);
            
            return topWords.join(', ');
        } catch (error) {
            return 'Unknown theme';
        }
    }

    /**
     * Migrate existing memories to vector database
     */
    async migrateExistingMemories() {
        try {
            const allMemories = this.getConversationHistory('main', 1000);
            let migrated = 0;
            
            if (allMemories && allMemories.length > 0) {
                console.log(`Migrating ${allMemories.length} existing memories to vector database...`);
                
                for (const memory of allMemories) {
                    const vectorId = `memory_${memory.id}`;
                    const vectorContent = this.createVectorContent(
                        memory.type, 
                        memory.content, 
                        memory.context || {}
                    );
                    
                    const result = await this.vectorService.addDocument(vectorId, vectorContent, {
                        memoryId: memory.id,
                        type: memory.type,
                        context: memory.context,
                        category: 'memory'
                    });
                    
                    if (result.success) {
                        migrated++;
                    }
                }
                
                console.log(`Successfully migrated ${migrated} memories to vector database`);
            }
        } catch (error) {
            console.error('Error migrating memories:', error);
        }
    }

    /**
     * Get enhanced statistics including vector search capabilities
     */
    async getEnhancedStats() {
        const basicStats = await super.getStats();
        const vectorStats = this.vectorService.getDatabaseStats();
        
        return {
            ...basicStats,
            vectorSearch: {
                enabled: this.semanticSearchEnabled,
                totalVectors: vectorStats.totalDocuments,
                embeddingDimension: vectorStats.embeddingDimension,
                averageContentLength: vectorStats.averageContentLength
            },
            capabilities: {
                semanticSearch: true,
                contextualSearch: true,
                memoryClustering: true,
                relatedMemoryDiscovery: true
            }
        };
    }
}

module.exports = SemanticMemoryManager;