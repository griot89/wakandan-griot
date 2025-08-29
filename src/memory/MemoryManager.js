const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createHash } = require('crypto');

class MemoryManager {
    constructor(options = {}) {
        this.dbPath = options.dbPath || path.join(__dirname, '../../g_brain/memory.db');
        this.ensureDirectoryExists(path.dirname(this.dbPath));
        
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        
        this.initializeTables();
        this.prepareStatements();
    }
    
    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    initializeTables() {
        // Core message table for conversation history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT DEFAULT 'main',
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                metadata TEXT, -- JSON blob for additional data
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                embedding_hash TEXT -- For future vector search
            )
        `);
        
        // Entities table for people, places, concepts G remembers
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL, -- person, place, concept, project, etc.
                description TEXT,
                metadata TEXT, -- JSON blob
                importance_score REAL DEFAULT 1.0,
                last_mentioned DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // User preferences and settings
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                type TEXT DEFAULT 'string', -- string, number, boolean, json
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tasks and todos
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled
                priority TEXT DEFAULT 'medium', -- low, medium, high
                due_date DATETIME,
                completed_at DATETIME,
                metadata TEXT, -- JSON blob
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Knowledge snippets and notes
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT, -- comma-separated or JSON array
                source TEXT, -- conversation, manual, web, etc.
                relevance_score REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes for better performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
            CREATE INDEX IF NOT EXISTS idx_entities_importance ON entities(importance_score DESC);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge(tags);
        `);
    }
    
    prepareStatements() {
        // Message operations
        this.insertMessage = this.db.prepare(`
            INSERT INTO messages (conversation_id, role, content, metadata)
            VALUES (?, ?, ?, ?)
        `);
        
        this.getRecentMessages = this.db.prepare(`
            SELECT * FROM messages 
            WHERE conversation_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        
        // Entity operations
        this.insertEntity = this.db.prepare(`
            INSERT INTO entities (name, type, description, metadata, importance_score)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        this.updateEntityMention = this.db.prepare(`
            UPDATE entities 
            SET last_mentioned = CURRENT_TIMESTAMP, importance_score = importance_score + 0.1
            WHERE id = ?
        `);
        
        this.findEntities = this.db.prepare(`
            SELECT * FROM entities 
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY importance_score DESC, last_mentioned DESC
            LIMIT ?
        `);
        
        // Preference operations
        this.setPreference = this.db.prepare(`
            INSERT OR REPLACE INTO preferences (key, value, type, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        this.getPreference = this.db.prepare(`
            SELECT value, type FROM preferences WHERE key = ?
        `);
        
        // Task operations
        this.insertTask = this.db.prepare(`
            INSERT INTO tasks (title, description, status, priority, due_date, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        this.updateTaskStatus = this.db.prepare(`
            UPDATE tasks 
            SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        this.getTasks = this.db.prepare(`
            SELECT * FROM tasks 
            WHERE status = ? 
            ORDER BY 
                CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                created_at DESC
        `);
        
        // Knowledge operations
        this.insertKnowledge = this.db.prepare(`
            INSERT INTO knowledge (title, content, tags, source, relevance_score)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        this.searchKnowledge = this.db.prepare(`
            SELECT * FROM knowledge 
            WHERE content LIKE ? OR title LIKE ? OR tags LIKE ?
            ORDER BY relevance_score DESC
            LIMIT ?
        `);
    }
    
    // === MESSAGE OPERATIONS ===
    
    addMessage(role, content, conversationId = 'main', metadata = null) {
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        const result = this.insertMessage.run(conversationId, role, content, metadataJson);
        return result.lastInsertRowid;
    }
    
    getConversationHistory(conversationId = 'main', limit = 50) {
        const messages = this.getRecentMessages.all(conversationId, limit);
        return messages.reverse().map(msg => ({
            ...msg,
            metadata: msg.metadata ? JSON.parse(msg.metadata) : null
        }));
    }
    
    // === ENTITY OPERATIONS ===
    
    addEntity(name, type, description = '', metadata = {}, importance = 1.0) {
        const metadataJson = JSON.stringify(metadata);
        const result = this.insertEntity.run(name, type, description, metadataJson, importance);
        return result.lastInsertRowid;
    }
    
    mentionEntity(entityId) {
        this.updateEntityMention.run(entityId);
    }
    
    searchEntities(query, limit = 10) {
        const searchTerm = `%${query}%`;
        const entities = this.findEntities.all(searchTerm, searchTerm, limit);
        return entities.map(entity => ({
            ...entity,
            metadata: entity.metadata ? JSON.parse(entity.metadata) : {}
        }));
    }
    
    // === PREFERENCE OPERATIONS ===
    
    setUserPreference(key, value, type = 'string') {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        this.setPreference.run(key, valueStr, type);
    }
    
    getUserPreference(key, defaultValue = null) {
        const row = this.getPreference.get(key);
        if (!row) return defaultValue;
        
        try {
            switch (row.type) {
                case 'number': return parseFloat(row.value);
                case 'boolean': return row.value === 'true';
                case 'json': return JSON.parse(row.value);
                default: return row.value;
            }
        } catch (e) {
            return row.value;
        }
    }
    
    // === TASK OPERATIONS ===
    
    addTask(title, description = '', priority = 'medium', dueDate = null, metadata = {}) {
        const dueDateStr = dueDate ? dueDate.toISOString() : null;
        const metadataJson = JSON.stringify(metadata);
        const result = this.insertTask.run(title, description, 'pending', priority, dueDateStr, metadataJson);
        return result.lastInsertRowid;
    }
    
    updateTask(taskId, status) {
        this.updateTaskStatus.run(status, status, taskId);
    }
    
    getTasksByStatus(status = 'pending') {
        const tasks = this.getTasks.all(status);
        return tasks.map(task => ({
            ...task,
            metadata: task.metadata ? JSON.parse(task.metadata) : {},
            due_date: task.due_date ? new Date(task.due_date) : null,
            completed_at: task.completed_at ? new Date(task.completed_at) : null
        }));
    }
    
    // === KNOWLEDGE OPERATIONS ===
    
    addKnowledge(title, content, tags = [], source = 'manual', relevance = 1.0) {
        const tagsStr = Array.isArray(tags) ? tags.join(',') : tags;
        const result = this.insertKnowledge.run(title, content, tagsStr, source, relevance);
        return result.lastInsertRowid;
    }
    
    searchMemory(query, limit = 20) {
        const searchTerm = `%${query}%`;
        const knowledge = this.searchKnowledge.all(searchTerm, searchTerm, searchTerm, limit);
        return knowledge.map(item => ({
            ...item,
            tags: item.tags ? item.tags.split(',') : []
        }));
    }
    
    // === BRAIN EXPORT/IMPORT ===
    
    exportBrain() {
        const tables = ['messages', 'entities', 'preferences', 'tasks', 'knowledge'];
        const exportData = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            data: {}
        };
        
        for (const table of tables) {
            const stmt = this.db.prepare(`SELECT * FROM ${table}`);
            exportData.data[table] = stmt.all();
        }
        
        return exportData;
    }
    
    importBrain(importData, overwrite = false) {
        if (overwrite) {
            // Clear existing data
            this.db.exec('DELETE FROM messages');
            this.db.exec('DELETE FROM entities');
            this.db.exec('DELETE FROM preferences');
            this.db.exec('DELETE FROM tasks');
            this.db.exec('DELETE FROM knowledge');
        }
        
        const transaction = this.db.transaction((data) => {
            for (const [table, rows] of Object.entries(data.data)) {
                if (rows && rows.length > 0) {
                    const columns = Object.keys(rows[0]).filter(col => col !== 'id');
                    const placeholders = columns.map(() => '?').join(', ');
                    const stmt = this.db.prepare(
                        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
                    );
                    
                    for (const row of rows) {
                        const values = columns.map(col => row[col]);
                        stmt.run(...values);
                    }
                }
            }
        });
        
        transaction(importData);
    }
    
    // === UTILITY METHODS ===
    
    getStats() {
        const stats = {};
        const tables = ['messages', 'entities', 'preferences', 'tasks', 'knowledge'];
        
        for (const table of tables) {
            const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = stmt.get().count;
        }
        
        stats.database_size = fs.statSync(this.dbPath).size;
        return stats;
    }
    
    close() {
        this.db.close();
    }
}

module.exports = MemoryManager;
