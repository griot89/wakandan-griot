const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');

class VectorService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
        this.vectorDatabase = new Map();
        this.embeddingDimension = 768; // text-embedding-004 dimension
        this.vectorDbPath = path.join(process.cwd(), 'g_brain', 'vector_db.json');
        this.metadataPath = path.join(process.cwd(), 'g_brain', 'vector_metadata.json');
        
        this.loadVectorDatabase();
    }

    /**
     * Generate embeddings for text using Google's text-embedding-004 model
     */
    async generateEmbedding(text) {
        try {
            const result = await this.model.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Add a document to the vector database with embeddings
     */
    async addDocument(id, content, metadata = {}) {
        try {
            const embedding = await this.generateEmbedding(content);
            
            const document = {
                id,
                content,
                embedding,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    contentLength: content.length
                }
            };

            this.vectorDatabase.set(id, document);
            await this.saveVectorDatabase();
            
            return {
                success: true,
                id,
                embeddingDimension: embedding.length,
                message: 'Document added to vector database'
            };
        } catch (error) {
            console.error('Error adding document to vector database:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Search for similar documents using cosine similarity
     */
    async searchSimilar(queryText, limit = 5, threshold = 0.7) {
        try {
            if (this.vectorDatabase.size === 0) {
                return {
                    success: true,
                    results: [],
                    message: 'Vector database is empty'
                };
            }

            const queryEmbedding = await this.generateEmbedding(queryText);
            const similarities = [];

            for (const [id, document] of this.vectorDatabase) {
                const similarity = this.cosineSimilarity(queryEmbedding, document.embedding);
                
                if (similarity >= threshold) {
                    similarities.push({
                        id: document.id,
                        content: document.content,
                        metadata: document.metadata,
                        similarity
                    });
                }
            }

            // Sort by similarity (highest first) and limit results
            similarities.sort((a, b) => b.similarity - a.similarity);
            const results = similarities.slice(0, limit);

            return {
                success: true,
                query: queryText,
                results,
                totalMatches: similarities.length,
                searchTime: Date.now()
            };
        } catch (error) {
            console.error('Error searching vector database:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same dimension');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Batch add multiple documents
     */
    async batchAddDocuments(documents) {
        const results = [];
        
        for (const doc of documents) {
            const result = await this.addDocument(doc.id, doc.content, doc.metadata);
            results.push(result);
        }
        
        return {
            success: true,
            processed: results.length,
            results
        };
    }

    /**
     * Get semantic clusters of similar documents
     */
    async getSemanticClusters(threshold = 0.8) {
        try {
            const documents = Array.from(this.vectorDatabase.values());
            const clusters = [];
            const processed = new Set();

            for (let i = 0; i < documents.length; i++) {
                if (processed.has(documents[i].id)) continue;

                const cluster = [documents[i]];
                processed.add(documents[i].id);

                for (let j = i + 1; j < documents.length; j++) {
                    if (processed.has(documents[j].id)) continue;

                    const similarity = this.cosineSimilarity(
                        documents[i].embedding,
                        documents[j].embedding
                    );

                    if (similarity >= threshold) {
                        cluster.push(documents[j]);
                        processed.add(documents[j].id);
                    }
                }

                clusters.push({
                    size: cluster.length,
                    representative: cluster[0].content.substring(0, 100),
                    documents: cluster.map(doc => ({
                        id: doc.id,
                        content: doc.content.substring(0, 200),
                        metadata: doc.metadata
                    }))
                });
            }

            return {
                success: true,
                clusters: clusters.sort((a, b) => b.size - a.size),
                totalClusters: clusters.length
            };
        } catch (error) {
            console.error('Error generating semantic clusters:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Remove document from vector database
     */
    async removeDocument(id) {
        try {
            if (this.vectorDatabase.has(id)) {
                this.vectorDatabase.delete(id);
                await this.saveVectorDatabase();
                return {
                    success: true,
                    message: `Document ${id} removed from vector database`
                };
            } else {
                return {
                    success: false,
                    message: `Document ${id} not found in vector database`
                };
            }
        } catch (error) {
            console.error('Error removing document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get database statistics
     */
    getDatabaseStats() {
        const documents = Array.from(this.vectorDatabase.values());
        
        return {
            totalDocuments: documents.length,
            embeddingDimension: this.embeddingDimension,
            totalContentLength: documents.reduce((sum, doc) => sum + doc.content.length, 0),
            averageContentLength: documents.length > 0 ? 
                documents.reduce((sum, doc) => sum + doc.content.length, 0) / documents.length : 0,
            oldestDocument: documents.length > 0 ? 
                Math.min(...documents.map(doc => new Date(doc.metadata.timestamp))) : null,
            newestDocument: documents.length > 0 ? 
                Math.max(...documents.map(doc => new Date(doc.metadata.timestamp))) : null
        };
    }

    /**
     * Save vector database to file
     */
    async saveVectorDatabase() {
        try {
            const data = {
                vectors: Object.fromEntries(this.vectorDatabase),
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    version: '1.0.0',
                    embeddingModel: 'text-embedding-004',
                    embeddingDimension: this.embeddingDimension
                }
            };

            await fs.writeFile(this.vectorDbPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving vector database:', error);
        }
    }

    /**
     * Load vector database from file
     */
    async loadVectorDatabase() {
        try {
            const data = await fs.readFile(this.vectorDbPath, 'utf8');
            const parsed = JSON.parse(data);
            
            if (parsed.vectors) {
                this.vectorDatabase = new Map(Object.entries(parsed.vectors));
                console.log(`Loaded ${this.vectorDatabase.size} vectors from database`);
            }
        } catch (error) {
            console.log('Vector database not found or empty, starting fresh');
            this.vectorDatabase = new Map();
        }
    }

    /**
     * Clear the entire vector database
     */
    async clearDatabase() {
        try {
            this.vectorDatabase.clear();
            await this.saveVectorDatabase();
            return {
                success: true,
                message: 'Vector database cleared'
            };
        } catch (error) {
            console.error('Error clearing database:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = VectorService;