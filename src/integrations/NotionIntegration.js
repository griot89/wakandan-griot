/**
 * Notion Integration for G Assistant
 * Handles databases, pages, blocks, and other Notion operations
 */

const { Client } = require('@notionhq/client');

class NotionIntegration {
    constructor(oauthManager) {
        this.oauthManager = oauthManager;
        this.notion = null;
    }

    async getAuthenticatedClient() {
        const user = await this.oauthManager.getValidatedUser('notion');
        if (!user) {
            throw new Error('Notion account not connected');
        }

        if (!this.notion) {
            this.notion = new Client({
                auth: user.tokens.access_token,
                notionVersion: '2022-06-28'
            });
            console.log('✅ Notion client initialized');
        }

        return this.notion;
    }

    // Database Operations
    async getDatabases() {
        const notion = await this.getAuthenticatedClient();

        try {
            const response = await notion.search({
                filter: {
                    property: 'object',
                    value: 'database'
                }
            });

            const databases = response.results.map(db => ({
                id: db.id,
                title: this.extractPlainText(db.title),
                url: db.url,
                created_time: db.created_time,
                last_edited_time: db.last_edited_time,
                properties: this.formatDatabaseProperties(db.properties),
                parent: db.parent,
                archived: db.archived
            }));

            return {
                success: true,
                databases: databases,
                total_count: databases.length
            };

        } catch (error) {
            console.error('Notion databases API error:', error);
            return {
                success: false,
                error: error.message,
                databases: []
            };
        }
    }

    async queryDatabase(databaseId, options = {}) {
        const notion = await this.getAuthenticatedClient();

        const {
            filter = {},
            sorts = [],
            page_size = 50
        } = options;

        try {
            const response = await notion.databases.query({
                database_id: databaseId,
                filter: Object.keys(filter).length > 0 ? filter : undefined,
                sorts: sorts.length > 0 ? sorts : undefined,
                page_size: page_size
            });

            const pages = response.results.map(page => ({
                id: page.id,
                url: page.url,
                created_time: page.created_time,
                last_edited_time: page.last_edited_time,
                properties: this.formatPageProperties(page.properties),
                parent: page.parent,
                archived: page.archived
            }));

            return {
                success: true,
                pages: pages,
                total_count: pages.length,
                has_more: response.has_more,
                next_cursor: response.next_cursor
            };

        } catch (error) {
            console.error('Notion database query error:', error);
            return {
                success: false,
                error: error.message,
                pages: []
            };
        }
    }

    async createDatabasePage(databaseId, pageData) {
        const notion = await this.getAuthenticatedClient();

        const { properties, children = [] } = pageData;

        try {
            const response = await notion.pages.create({
                parent: {
                    database_id: databaseId
                },
                properties: properties,
                children: children
            });

            return {
                success: true,
                page: {
                    id: response.id,
                    url: response.url,
                    created_time: response.created_time,
                    properties: this.formatPageProperties(response.properties)
                }
            };

        } catch (error) {
            console.error('Notion create page error:', error);
            return {
                success: false,
                error: error.message,
                page: null
            };
        }
    }

    // Page Operations
    async getPage(pageId) {
        const notion = await this.getAuthenticatedClient();

        try {
            const response = await notion.pages.retrieve({
                page_id: pageId
            });

            const page = {
                id: response.id,
                url: response.url,
                created_time: response.created_time,
                last_edited_time: response.last_edited_time,
                properties: this.formatPageProperties(response.properties),
                parent: response.parent,
                archived: response.archived,
                icon: response.icon,
                cover: response.cover
            };

            return {
                success: true,
                page: page
            };

        } catch (error) {
            console.error('Notion get page error:', error);
            return {
                success: false,
                error: error.message,
                page: null
            };
        }
    }

    async updatePage(pageId, updates) {
        const notion = await this.getAuthenticatedClient();

        const { properties, archived } = updates;

        try {
            const response = await notion.pages.update({
                page_id: pageId,
                properties: properties,
                archived: archived
            });

            return {
                success: true,
                page: {
                    id: response.id,
                    url: response.url,
                    last_edited_time: response.last_edited_time,
                    properties: this.formatPageProperties(response.properties)
                }
            };

        } catch (error) {
            console.error('Notion update page error:', error);
            return {
                success: false,
                error: error.message,
                page: null
            };
        }
    }

    async createPage(pageData) {
        const notion = await this.getAuthenticatedClient();

        const { 
            parent, 
            properties = {}, 
            children = [], 
            icon = null, 
            cover = null 
        } = pageData;

        try {
            const response = await notion.pages.create({
                parent: parent,
                properties: properties,
                children: children,
                icon: icon,
                cover: cover
            });

            return {
                success: true,
                page: {
                    id: response.id,
                    url: response.url,
                    created_time: response.created_time,
                    properties: this.formatPageProperties(response.properties)
                }
            };

        } catch (error) {
            console.error('Notion create page error:', error);
            return {
                success: false,
                error: error.message,
                page: null
            };
        }
    }

    // Block Operations
    async getPageBlocks(pageId) {
        const notion = await this.getAuthenticatedClient();

        try {
            const response = await notion.blocks.children.list({
                block_id: pageId
            });

            const blocks = response.results.map(block => this.formatBlock(block));

            return {
                success: true,
                blocks: blocks,
                total_count: blocks.length,
                has_more: response.has_more,
                next_cursor: response.next_cursor
            };

        } catch (error) {
            console.error('Notion get blocks error:', error);
            return {
                success: false,
                error: error.message,
                blocks: []
            };
        }
    }

    async appendBlockChildren(blockId, children) {
        const notion = await this.getAuthenticatedClient();

        try {
            const response = await notion.blocks.children.append({
                block_id: blockId,
                children: children
            });

            const blocks = response.results.map(block => this.formatBlock(block));

            return {
                success: true,
                blocks: blocks
            };

        } catch (error) {
            console.error('Notion append blocks error:', error);
            return {
                success: false,
                error: error.message,
                blocks: []
            };
        }
    }

    // Search Operations
    async searchContent(query, options = {}) {
        const notion = await this.getAuthenticatedClient();

        const {
            filter = {},
            sort = {},
            page_size = 50
        } = options;

        try {
            const response = await notion.search({
                query: query,
                filter: Object.keys(filter).length > 0 ? filter : undefined,
                sort: Object.keys(sort).length > 0 ? sort : undefined,
                page_size: page_size
            });

            const results = response.results.map(item => {
                if (item.object === 'database') {
                    return {
                        type: 'database',
                        id: item.id,
                        title: this.extractPlainText(item.title),
                        url: item.url,
                        created_time: item.created_time,
                        last_edited_time: item.last_edited_time
                    };
                } else if (item.object === 'page') {
                    return {
                        type: 'page',
                        id: item.id,
                        url: item.url,
                        created_time: item.created_time,
                        last_edited_time: item.last_edited_time,
                        properties: this.formatPageProperties(item.properties)
                    };
                }
                return item;
            });

            return {
                success: true,
                results: results,
                total_count: results.length,
                has_more: response.has_more,
                next_cursor: response.next_cursor
            };

        } catch (error) {
            console.error('Notion search error:', error);
            return {
                success: false,
                error: error.message,
                results: []
            };
        }
    }

    // User Operations
    async getUsers() {
        const notion = await this.getAuthenticatedClient();

        try {
            const response = await notion.users.list();

            const users = response.results.map(user => ({
                id: user.id,
                type: user.type,
                name: user.name,
                avatar_url: user.avatar_url,
                person: user.person,
                bot: user.bot
            }));

            return {
                success: true,
                users: users,
                total_count: users.length
            };

        } catch (error) {
            console.error('Notion users error:', error);
            return {
                success: false,
                error: error.message,
                users: []
            };
        }
    }

    // Helper Methods
    extractPlainText(richTextArray) {
        if (!richTextArray || !Array.isArray(richTextArray)) return '';
        return richTextArray.map(text => text.plain_text).join('');
    }

    formatDatabaseProperties(properties) {
        const formatted = {};
        for (const [key, value] of Object.entries(properties)) {
            formatted[key] = {
                type: value.type,
                id: value.id,
                name: value.name || key
            };
        }
        return formatted;
    }

    formatPageProperties(properties) {
        const formatted = {};
        for (const [key, value] of Object.entries(properties)) {
            formatted[key] = this.formatPropertyValue(value);
        }
        return formatted;
    }

    formatPropertyValue(property) {
        const { type } = property;
        
        switch (type) {
            case 'title':
                return {
                    type: 'title',
                    value: this.extractPlainText(property.title)
                };
            case 'rich_text':
                return {
                    type: 'rich_text',
                    value: this.extractPlainText(property.rich_text)
                };
            case 'number':
                return {
                    type: 'number',
                    value: property.number
                };
            case 'select':
                return {
                    type: 'select',
                    value: property.select ? {
                        name: property.select.name,
                        color: property.select.color
                    } : null
                };
            case 'multi_select':
                return {
                    type: 'multi_select',
                    value: property.multi_select.map(item => ({
                        name: item.name,
                        color: item.color
                    }))
                };
            case 'date':
                return {
                    type: 'date',
                    value: property.date ? {
                        start: property.date.start,
                        end: property.date.end,
                        time_zone: property.date.time_zone
                    } : null
                };
            case 'checkbox':
                return {
                    type: 'checkbox',
                    value: property.checkbox
                };
            case 'url':
                return {
                    type: 'url',
                    value: property.url
                };
            case 'email':
                return {
                    type: 'email',
                    value: property.email
                };
            case 'phone_number':
                return {
                    type: 'phone_number',
                    value: property.phone_number
                };
            case 'people':
                return {
                    type: 'people',
                    value: property.people.map(person => ({
                        id: person.id,
                        name: person.name,
                        avatar_url: person.avatar_url
                    }))
                };
            case 'files':
                return {
                    type: 'files',
                    value: property.files.map(file => ({
                        name: file.name,
                        type: file.type,
                        url: file.external ? file.external.url : file.file.url
                    }))
                };
            case 'created_time':
                return {
                    type: 'created_time',
                    value: property.created_time
                };
            case 'last_edited_time':
                return {
                    type: 'last_edited_time',
                    value: property.last_edited_time
                };
            default:
                return {
                    type: type,
                    value: property[type]
                };
        }
    }

    formatBlock(block) {
        const { type, id, created_time, last_edited_time, has_children } = block;
        
        const baseBlock = {
            id: id,
            type: type,
            created_time: created_time,
            last_edited_time: last_edited_time,
            has_children: has_children
        };

        // Add type-specific content
        if (block[type]) {
            const typeContent = block[type];
            
            switch (type) {
                case 'paragraph':
                case 'heading_1':
                case 'heading_2':
                case 'heading_3':
                case 'bulleted_list_item':
                case 'numbered_list_item':
                case 'to_do':
                case 'toggle':
                case 'quote':
                case 'callout':
                    baseBlock.text = this.extractPlainText(typeContent.rich_text || typeContent.text);
                    if (typeContent.checked !== undefined) {
                        baseBlock.checked = typeContent.checked;
                    }
                    break;
                case 'code':
                    baseBlock.text = this.extractPlainText(typeContent.rich_text);
                    baseBlock.language = typeContent.language;
                    break;
                case 'image':
                case 'video':
                case 'file':
                case 'pdf':
                    baseBlock.url = typeContent.external ? typeContent.external.url : typeContent.file.url;
                    baseBlock.caption = this.extractPlainText(typeContent.caption);
                    break;
                case 'bookmark':
                case 'link_preview':
                    baseBlock.url = typeContent.url;
                    baseBlock.caption = this.extractPlainText(typeContent.caption);
                    break;
                case 'equation':
                    baseBlock.expression = typeContent.expression;
                    break;
                case 'divider':
                    // No additional content for dividers
                    break;
                default:
                    baseBlock.content = typeContent;
                    break;
            }
        }

        return baseBlock;
    }

    // Integration Status
    getStatus() {
        const user = this.oauthManager.getAccountByProvider('notion');
        
        return {
            connected: !!user,
            user: user ? {
                name: user.profile.name,
                email: user.profile.email,
                workspace: user.profile.workspace
            } : null,
            client_initialized: !!this.notion,
            workspace_id: user ? user.tokens.workspace_id : null,
            bot_id: user ? user.tokens.bot_id : null
        };
    }

    // Service Test
    async testConnection() {
        try {
            const notion = await this.getAuthenticatedClient();
            
            // Test with a simple search
            const response = await notion.search({
                page_size: 1
            });
            
            return {
                success: true,
                workspace_accessible: true,
                results_found: response.results.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Quick helper methods for common operations
    async createSimplePage(title, content, parentPageId = null) {
        const pageData = {
            parent: parentPageId ? { page_id: parentPageId } : { type: 'page_id', page_id: 'workspace' },
            properties: {
                title: {
                    title: [{
                        text: { content: title }
                    }]
                }
            },
            children: content ? [{
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{
                        type: 'text',
                        text: { content: content }
                    }]
                }
            }] : []
        };

        return await this.createPage(pageData);
    }

    async addTextToPage(pageId, text) {
        const children = [{
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{
                    type: 'text',
                    text: { content: text }
                }]
            }
        }];

        return await this.appendBlockChildren(pageId, children);
    }
}

module.exports = NotionIntegration;