/**
 * OAuth Manager for G Assistant
 * Handles authentication and integration with external services
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

class OAuthManager {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.sessions = new Map();
        
        // OAuth configurations
        this.config = {
            google: {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
                scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive']
            },
            github: {
                clientID: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback',
                scope: ['user', 'repo', 'notifications']
            },
            notion: {
                // Notion uses different OAuth flow
                clientId: process.env.NOTION_CLIENT_ID,
                clientSecret: process.env.NOTION_CLIENT_SECRET,
                redirectUri: process.env.NOTION_REDIRECT_URI || '/auth/notion/callback'
            }
        };
        
        this.initializeStrategies();
        console.log('🔐 OAuth Manager initialized');
    }

    initializeStrategies() {
        // Initialize Passport
        passport.serializeUser((user, done) => {
            done(null, user.id);
        });

        passport.deserializeUser((id, done) => {
            // Retrieve user from memory or database
            const user = this.getUserFromStorage(id);
            done(null, user);
        });

        // Google OAuth Strategy
        if (this.config.google.clientID && this.config.google.clientSecret) {
            passport.use(new GoogleStrategy({
                clientID: this.config.google.clientID,
                clientSecret: this.config.google.clientSecret,
                callbackURL: this.config.google.callbackURL
            }, async (accessToken, refreshToken, profile, done) => {
                try {
                    const user = await this.handleGoogleAuth(accessToken, refreshToken, profile);
                    return done(null, user);
                } catch (error) {
                    return done(error, null);
                }
            }));
            console.log('✅ Google OAuth strategy configured');
        } else {
            console.warn('⚠️  Google OAuth not configured - missing credentials');
        }

        // GitHub OAuth Strategy
        if (this.config.github.clientID && this.config.github.clientSecret) {
            passport.use(new GitHubStrategy({
                clientID: this.config.github.clientID,
                clientSecret: this.config.github.clientSecret,
                callbackURL: this.config.github.callbackURL
            }, async (accessToken, refreshToken, profile, done) => {
                try {
                    const user = await this.handleGitHubAuth(accessToken, refreshToken, profile);
                    return done(null, user);
                } catch (error) {
                    return done(error, null);
                }
            }));
            console.log('✅ GitHub OAuth strategy configured');
        } else {
            console.warn('⚠️  GitHub OAuth not configured - missing credentials');
        }
    }

    async handleGoogleAuth(accessToken, refreshToken, profile) {
        const user = {
            id: `google_${profile.id}`,
            provider: 'google',
            profile: profile,
            tokens: {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: Date.now() + (3600 * 1000) // 1 hour
            },
            services: {
                gmail: true,
                calendar: true,
                drive: true
            },
            created_at: new Date().toISOString()
        };

        // Store user in memory
        this.storeUser(user);
        
        // Log integration
        this.memoryManager.addMessage('system', `Google account connected: ${profile.displayName} (${profile.emails[0].value})`);
        
        console.log(`👤 Google user authenticated: ${profile.displayName}`);
        return user;
    }

    async handleGitHubAuth(accessToken, refreshToken, profile) {
        const user = {
            id: `github_${profile.id}`,
            provider: 'github',
            profile: profile,
            tokens: {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: Date.now() + (3600 * 1000) // 1 hour
            },
            services: {
                repositories: true,
                issues: true,
                notifications: true
            },
            created_at: new Date().toISOString()
        };

        // Store user in memory
        this.storeUser(user);
        
        // Log integration
        this.memoryManager.addMessage('system', `GitHub account connected: ${profile.username}`);
        
        console.log(`👤 GitHub user authenticated: ${profile.username}`);
        return user;
    }

    async handleNotionAuth(code, state) {
        // Notion OAuth is done manually since they don't have passport strategy
        try {
            const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${this.config.notion.clientId}:${this.config.notion.clientSecret}`).toString('base64')}`
                },
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.config.notion.redirectUri
                })
            });

            if (!tokenResponse.ok) {
                throw new Error(`Notion OAuth failed: ${tokenResponse.statusText}`);
            }

            const tokenData = await tokenResponse.json();
            
            const user = {
                id: `notion_${tokenData.owner.user.id}`,
                provider: 'notion',
                profile: {
                    id: tokenData.owner.user.id,
                    name: tokenData.owner.user.name,
                    email: tokenData.owner.user.person?.email,
                    workspace: tokenData.workspace_name
                },
                tokens: {
                    access_token: tokenData.access_token,
                    bot_id: tokenData.bot_id,
                    workspace_id: tokenData.workspace_id,
                    expires_at: null // Notion tokens don't expire
                },
                services: {
                    databases: true,
                    pages: true,
                    blocks: true
                },
                created_at: new Date().toISOString()
            };

            // Store user in memory
            this.storeUser(user);
            
            // Log integration
            this.memoryManager.addMessage('system', `Notion workspace connected: ${tokenData.workspace_name}`);
            
            console.log(`👤 Notion user authenticated: ${tokenData.workspace_name}`);
            return user;

        } catch (error) {
            console.error('Notion OAuth error:', error);
            throw error;
        }
    }

    storeUser(user) {
        // Store in session map
        this.sessions.set(user.id, user);
        
        // Store in persistent memory
        try {
            this.memoryManager.addEntity(user.id, 'oauth_user', {
                provider: user.provider,
                profile: user.profile,
                services: user.services,
                connected_at: user.created_at
            });
        } catch (error) {
            console.warn('Failed to store OAuth user in memory:', error.message);
        }
    }

    getUserFromStorage(userId) {
        return this.sessions.get(userId);
    }

    getConnectedAccounts() {
        const accounts = [];
        for (const [id, user] of this.sessions) {
            accounts.push({
                id: id,
                provider: user.provider,
                profile: {
                    name: user.profile.displayName || user.profile.username || user.profile.name,
                    email: user.profile.emails?.[0]?.value || user.profile.email,
                    avatar: user.profile.photos?.[0]?.value || user.profile.avatar_url
                },
                services: user.services,
                connected_at: user.created_at,
                token_expires: user.tokens.expires_at
            });
        }
        return accounts;
    }

    getAccountByProvider(provider) {
        for (const [id, user] of this.sessions) {
            if (user.provider === provider) {
                return user;
            }
        }
        return null;
    }

    async refreshGoogleToken(user) {
        if (!user.tokens.refresh_token) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.config.google.clientID,
                    client_secret: this.config.google.clientSecret,
                    refresh_token: user.tokens.refresh_token,
                    grant_type: 'refresh_token'
                })
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.statusText}`);
            }

            const tokenData = await response.json();
            
            // Update user tokens
            user.tokens.access_token = tokenData.access_token;
            user.tokens.expires_at = Date.now() + (tokenData.expires_in * 1000);
            
            // Update stored user
            this.sessions.set(user.id, user);
            
            console.log('✅ Google token refreshed');
            return user;

        } catch (error) {
            console.error('Token refresh error:', error);
            throw error;
        }
    }

    async ensureValidToken(user) {
        if (user.provider === 'google' && user.tokens.expires_at && Date.now() > user.tokens.expires_at) {
            return await this.refreshGoogleToken(user);
        }
        return user;
    }

    disconnectAccount(provider) {
        const user = this.getAccountByProvider(provider);
        if (user) {
            this.sessions.delete(user.id);
            this.memoryManager.addMessage('system', `${provider} account disconnected`);
            console.log(`🔌 ${provider} account disconnected`);
            return true;
        }
        return false;
    }

    getOAuthUrls() {
        const baseUrl = process.env.BASE_URL || 'http://localhost:5050';
        
        const urls = {};
        
        if (this.config.google.clientID) {
            urls.google = `${baseUrl}/auth/google`;
        }
        
        if (this.config.github.clientID) {
            urls.github = `${baseUrl}/auth/github`;
        }
        
        if (this.config.notion.clientId) {
            const notionAuthUrl = new URL('https://api.notion.com/v1/oauth/authorize');
            notionAuthUrl.searchParams.append('client_id', this.config.notion.clientId);
            notionAuthUrl.searchParams.append('response_type', 'code');
            notionAuthUrl.searchParams.append('owner', 'user');
            notionAuthUrl.searchParams.append('redirect_uri', `${baseUrl}${this.config.notion.redirectUri}`);
            urls.notion = notionAuthUrl.toString();
        }
        
        return urls;
    }

    getStatus() {
        const connectedAccounts = this.getConnectedAccounts();
        
        return {
            configured_providers: {
                google: !!this.config.google.clientID,
                github: !!this.config.github.clientID,
                notion: !!this.config.notion.clientId
            },
            connected_accounts: connectedAccounts.length,
            accounts: connectedAccounts,
            oauth_urls: this.getOAuthUrls(),
            session_count: this.sessions.size
        };
    }

    // Security method to validate session
    isValidSession(sessionId) {
        return this.sessions.has(sessionId);
    }

    // Method to get user for API operations
    async getValidatedUser(provider) {
        const user = this.getAccountByProvider(provider);
        if (!user) {
            throw new Error(`No ${provider} account connected`);
        }
        
        return await this.ensureValidToken(user);
    }
}

module.exports = OAuthManager;