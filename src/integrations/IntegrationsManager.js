/**
 * Integrations Manager for G Assistant
 * Centralizes management of all external service integrations
 */

const OAuthManager = require('./OAuthManager');
const GoogleIntegration = require('./GoogleIntegration');
const GitHubIntegration = require('./GitHubIntegration');
const NotionIntegration = require('./NotionIntegration');

class IntegrationsManager {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        
        // Initialize OAuth manager
        this.oauthManager = new OAuthManager(memoryManager);
        
        // Initialize service integrations
        this.google = new GoogleIntegration(this.oauthManager);
        this.github = new GitHubIntegration(this.oauthManager);
        this.notion = new NotionIntegration(this.oauthManager);
        
        // Track integration usage
        this.usage = {
            google: { requests: 0, lastUsed: null },
            github: { requests: 0, lastUsed: null },
            notion: { requests: 0, lastUsed: null }
        };
        
        console.log('🔗 Integrations Manager initialized');
    }

    /**
     * Get overall integration status
     */
    getStatus() {
        return {
            oauth: this.oauthManager.getStatus(),
            services: {
                google: this.google.getStatus(),
                github: this.github.getStatus(),
                notion: this.notion.getStatus()
            },
            usage: this.usage,
            total_connected: this.getTotalConnectedServices(),
            available_actions: this.getAvailableActions()
        };
    }

    getTotalConnectedServices() {
        const statuses = [
            this.google.getStatus().connected,
            this.github.getStatus().connected,
            this.notion.getStatus().connected
        ];
        return statuses.filter(Boolean).length;
    }

    getAvailableActions() {
        const actions = [];
        
        if (this.google.getStatus().connected) {
            actions.push(
                'send_email', 'get_emails', 'create_calendar_event', 'get_calendar_events',
                'get_drive_files', 'create_drive_folder', 'get_document_content'
            );
        }
        
        if (this.github.getStatus().connected) {
            actions.push(
                'get_repositories', 'get_issues', 'create_issue', 'get_pull_requests',
                'get_notifications', 'search_repositories'
            );
        }
        
        if (this.notion.getStatus().connected) {
            actions.push(
                'get_databases', 'query_database', 'create_page', 'get_page',
                'search_content', 'add_text_to_page'
            );
        }
        
        return actions;
    }

    /**
     * Execute integration action with usage tracking
     */
    async executeAction(service, action, parameters = {}) {
        if (!['google', 'github', 'notion'].includes(service)) {
            throw new Error(`Unknown service: ${service}`);
        }
        
        // Track usage
        this.usage[service].requests++;
        this.usage[service].lastUsed = new Date().toISOString();
        
        try {
            const integration = this[service];
            
            // Execute the action
            let result;
            switch (service) {
                case 'google':
                    result = await this.executeGoogleAction(integration, action, parameters);
                    break;
                case 'github':
                    result = await this.executeGitHubAction(integration, action, parameters);
                    break;
                case 'notion':
                    result = await this.executeNotionAction(integration, action, parameters);
                    break;
                default:
                    throw new Error(`Service ${service} not implemented`);
            }
            
            // Log successful action
            this.memoryManager.addMessage('system', 
                `Integration action completed: ${service}.${action}`, 
                'integration_log'
            );
            
            return {
                success: true,
                service: service,
                action: action,
                result: result,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Integration error (${service}.${action}):`, error);
            
            // Log error
            this.memoryManager.addMessage('system', 
                `Integration error: ${service}.${action} - ${error.message}`, 
                'integration_error'
            );
            
            return {
                success: false,
                service: service,
                action: action,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async executeGoogleAction(google, action, params) {
        switch (action) {
            case 'send_email':
                return await google.sendEmail(params);
            case 'get_emails':
                return await google.getEmails(params);
            case 'create_calendar_event':
                return await google.createCalendarEvent(params);
            case 'get_calendar_events':
                return await google.getCalendarEvents(params);
            case 'get_drive_files':
                return await google.getDriveFiles(params);
            case 'create_drive_folder':
                return await google.createDriveFolder(params.name, params.parentId);
            case 'get_document_content':
                return await google.getDocumentContent(params.documentId);
            case 'test_services':
                return await google.testServices();
            default:
                throw new Error(`Unknown Google action: ${action}`);
        }
    }

    async executeGitHubAction(github, action, params) {
        switch (action) {
            case 'get_repositories':
                return await github.getRepositories(params);
            case 'get_repository_details':
                return await github.getRepositoryDetails(params.owner, params.repo);
            case 'get_issues':
                return await github.getIssues(params);
            case 'create_issue':
                return await github.createIssue(params.owner, params.repo, params.issueData);
            case 'get_pull_requests':
                return await github.getPullRequests(params.owner, params.repo, params);
            case 'get_notifications':
                return await github.getNotifications(params);
            case 'mark_notification_read':
                return await github.markNotificationAsRead(params.notificationId);
            case 'get_user_profile':
                return await github.getUserProfile();
            case 'search_repositories':
                return await github.searchRepositories(params.query, params);
            case 'test_connection':
                return await github.testConnection();
            default:
                throw new Error(`Unknown GitHub action: ${action}`);
        }
    }

    async executeNotionAction(notion, action, params) {
        switch (action) {
            case 'get_databases':
                return await notion.getDatabases();
            case 'query_database':
                return await notion.queryDatabase(params.databaseId, params);
            case 'create_database_page':
                return await notion.createDatabasePage(params.databaseId, params.pageData);
            case 'get_page':
                return await notion.getPage(params.pageId);
            case 'update_page':
                return await notion.updatePage(params.pageId, params.updates);
            case 'create_page':
                return await notion.createPage(params.pageData);
            case 'create_simple_page':
                return await notion.createSimplePage(params.title, params.content, params.parentId);
            case 'get_page_blocks':
                return await notion.getPageBlocks(params.pageId);
            case 'add_text_to_page':
                return await notion.addTextToPage(params.pageId, params.text);
            case 'search_content':
                return await notion.searchContent(params.query, params);
            case 'get_users':
                return await notion.getUsers();
            case 'test_connection':
                return await notion.testConnection();
            default:
                throw new Error(`Unknown Notion action: ${action}`);
        }
    }

    /**
     * Get comprehensive integration capabilities
     */
    getCapabilities() {
        const capabilities = {
            oauth_providers: [],
            actions_by_service: {},
            total_actions: 0
        };
        
        // Check Google capabilities
        const googleStatus = this.google.getStatus();
        if (googleStatus.connected) {
            capabilities.oauth_providers.push('google');
            capabilities.actions_by_service.google = [
                'send_email', 'get_emails', 'create_calendar_event', 'get_calendar_events',
                'get_drive_files', 'create_drive_folder', 'get_document_content'
            ];
        }
        
        // Check GitHub capabilities
        const githubStatus = this.github.getStatus();
        if (githubStatus.connected) {
            capabilities.oauth_providers.push('github');
            capabilities.actions_by_service.github = [
                'get_repositories', 'get_repository_details', 'get_issues', 'create_issue',
                'get_pull_requests', 'get_notifications', 'search_repositories'
            ];
        }
        
        // Check Notion capabilities
        const notionStatus = this.notion.getStatus();
        if (notionStatus.connected) {
            capabilities.oauth_providers.push('notion');
            capabilities.actions_by_service.notion = [
                'get_databases', 'query_database', 'create_page', 'get_page',
                'search_content', 'add_text_to_page'
            ];
        }
        
        // Calculate total actions
        capabilities.total_actions = Object.values(capabilities.actions_by_service)
            .reduce((sum, actions) => sum + actions.length, 0);
        
        return capabilities;
    }

    /**
     * Test all connected integrations
     */
    async testAllConnections() {
        const results = {};
        
        // Test Google
        if (this.google.getStatus().connected) {
            try {
                results.google = await this.google.testServices();
            } catch (error) {
                results.google = { success: false, error: error.message };
            }
        }
        
        // Test GitHub
        if (this.github.getStatus().connected) {
            try {
                results.github = await this.github.testConnection();
            } catch (error) {
                results.github = { success: false, error: error.message };
            }
        }
        
        // Test Notion
        if (this.notion.getStatus().connected) {
            try {
                results.notion = await this.notion.testConnection();
            } catch (error) {
                results.notion = { success: false, error: error.message };
            }
        }
        
        return results;
    }

    /**
     * Disconnect a specific service
     */
    disconnectService(service) {
        if (!['google', 'github', 'notion'].includes(service)) {
            throw new Error(`Unknown service: ${service}`);
        }
        
        const success = this.oauthManager.disconnectAccount(service);
        
        if (success) {
            // Reset service clients
            if (service === 'google') this.google.services = {};
            if (service === 'github') this.github.octokit = null;
            if (service === 'notion') this.notion.notion = null;
            
            // Reset usage tracking
            this.usage[service] = { requests: 0, lastUsed: null };
            
            this.memoryManager.addMessage('system', `${service} integration disconnected`);
        }
        
        return success;
    }

    /**
     * Get usage statistics
     */
    getUsageStats() {
        const totalRequests = Object.values(this.usage).reduce((sum, stat) => sum + stat.requests, 0);
        const activeServices = Object.entries(this.usage)
            .filter(([_, stat]) => stat.requests > 0)
            .map(([service, _]) => service);
        
        return {
            total_requests: totalRequests,
            requests_by_service: this.usage,
            active_services: activeServices,
            most_used_service: this.getMostUsedService()
        };
    }

    getMostUsedService() {
        let maxRequests = 0;
        let mostUsed = null;
        
        for (const [service, stat] of Object.entries(this.usage)) {
            if (stat.requests > maxRequests) {
                maxRequests = stat.requests;
                mostUsed = service;
            }
        }
        
        return mostUsed;
    }

    /**
     * Get OAuth URLs for frontend
     */
    getOAuthUrls() {
        return this.oauthManager.getOAuthUrls();
    }

    /**
     * Handle OAuth callbacks
     */
    async handleOAuthCallback(provider, code, state = null) {
        switch (provider) {
            case 'notion':
                return await this.oauthManager.handleNotionAuth(code, state);
            default:
                throw new Error(`OAuth callback not implemented for ${provider}`);
        }
    }

    /**
     * Get Passport instance for Express integration
     */
    getPassport() {
        return this.oauthManager.passport;
    }
}

module.exports = IntegrationsManager;