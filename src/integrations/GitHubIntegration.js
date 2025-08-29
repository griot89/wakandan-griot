/**
 * GitHub Integration for G Assistant
 * Handles repositories, issues, pull requests, and other GitHub operations
 */

const { Octokit } = require('@octokit/rest');

class GitHubIntegration {
    constructor(oauthManager) {
        this.oauthManager = oauthManager;
        this.octokit = null;
    }

    async getAuthenticatedClient() {
        const user = await this.oauthManager.getValidatedUser('github');
        if (!user) {
            throw new Error('GitHub account not connected');
        }

        if (!this.octokit) {
            this.octokit = new Octokit({
                auth: user.tokens.access_token,
                userAgent: 'G-Assistant/1.0.0'
            });
            console.log('✅ GitHub client initialized');
        }

        return this.octokit;
    }

    // Repository Operations
    async getRepositories(options = {}) {
        const octokit = await this.getAuthenticatedClient();
        
        const {
            type = 'owner', // owner, collaborator, organization_member, public, private, member
            sort = 'updated',
            direction = 'desc',
            per_page = 10,
            affiliation = 'owner,collaborator,organization_member'
        } = options;

        try {
            const response = await octokit.rest.repos.listForAuthenticatedUser({
                type: type,
                sort: sort,
                direction: direction,
                per_page: per_page,
                affiliation: affiliation
            });

            const repositories = response.data.map(repo => ({
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                description: repo.description,
                url: repo.html_url,
                clone_url: repo.clone_url,
                ssh_url: repo.ssh_url,
                language: repo.language,
                size: repo.size,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                watchers: repo.watchers_count,
                open_issues: repo.open_issues_count,
                private: repo.private,
                fork: repo.fork,
                archived: repo.archived,
                disabled: repo.disabled,
                default_branch: repo.default_branch,
                created_at: repo.created_at,
                updated_at: repo.updated_at,
                pushed_at: repo.pushed_at,
                topics: repo.topics || []
            }));

            return {
                success: true,
                repositories: repositories,
                total_count: repositories.length
            };

        } catch (error) {
            console.error('GitHub repos API error:', error);
            return {
                success: false,
                error: error.message,
                repositories: []
            };
        }
    }

    async getRepositoryDetails(owner, repo) {
        const octokit = await this.getAuthenticatedClient();

        try {
            const [repoResponse, contributorsResponse, languagesResponse] = await Promise.allSettled([
                octokit.rest.repos.get({ owner, repo }),
                octokit.rest.repos.listContributors({ owner, repo, per_page: 10 }),
                octokit.rest.repos.listLanguages({ owner, repo })
            ]);

            const repoData = repoResponse.status === 'fulfilled' ? repoResponse.value.data : null;
            const contributors = contributorsResponse.status === 'fulfilled' ? contributorsResponse.value.data : [];
            const languages = languagesResponse.status === 'fulfilled' ? languagesResponse.value.data : {};

            if (!repoData) {
                throw new Error('Repository not found or access denied');
            }

            return {
                success: true,
                repository: {
                    ...repoData,
                    contributors: contributors.map(c => ({
                        login: c.login,
                        contributions: c.contributions,
                        avatar_url: c.avatar_url,
                        html_url: c.html_url
                    })),
                    languages: languages
                }
            };

        } catch (error) {
            console.error('GitHub repo details error:', error);
            return {
                success: false,
                error: error.message,
                repository: null
            };
        }
    }

    // Issues Operations
    async getIssues(options = {}) {
        const octokit = await this.getAuthenticatedClient();
        
        const {
            filter = 'assigned', // assigned, created, mentioned, subscribed, all
            state = 'open', // open, closed, all
            labels = '',
            sort = 'updated',
            direction = 'desc',
            per_page = 10,
            since
        } = options;

        try {
            const response = await octokit.rest.issues.listForAuthenticatedUser({
                filter: filter,
                state: state,
                labels: labels,
                sort: sort,
                direction: direction,
                per_page: per_page,
                since: since
            });

            const issues = response.data.map(issue => ({
                id: issue.id,
                number: issue.number,
                title: issue.title,
                body: issue.body,
                state: issue.state,
                url: issue.html_url,
                repository: {
                    name: issue.repository?.name,
                    full_name: issue.repository?.full_name,
                    url: issue.repository?.html_url
                },
                user: {
                    login: issue.user.login,
                    avatar_url: issue.user.avatar_url
                },
                assignees: issue.assignees.map(a => ({
                    login: a.login,
                    avatar_url: a.avatar_url
                })),
                labels: issue.labels.map(l => ({
                    name: l.name,
                    color: l.color,
                    description: l.description
                })),
                milestone: issue.milestone ? {
                    title: issue.milestone.title,
                    description: issue.milestone.description,
                    state: issue.milestone.state
                } : null,
                comments: issue.comments,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                closed_at: issue.closed_at,
                is_pull_request: !!issue.pull_request
            }));

            return {
                success: true,
                issues: issues,
                total_count: issues.length
            };

        } catch (error) {
            console.error('GitHub issues API error:', error);
            return {
                success: false,
                error: error.message,
                issues: []
            };
        }
    }

    async createIssue(owner, repo, issueData) {
        const octokit = await this.getAuthenticatedClient();
        
        const { title, body = '', assignees = [], labels = [], milestone } = issueData;

        try {
            const response = await octokit.rest.issues.create({
                owner: owner,
                repo: repo,
                title: title,
                body: body,
                assignees: assignees,
                labels: labels,
                milestone: milestone
            });

            return {
                success: true,
                issue: {
                    id: response.data.id,
                    number: response.data.number,
                    title: response.data.title,
                    url: response.data.html_url,
                    state: response.data.state,
                    created_at: response.data.created_at
                }
            };

        } catch (error) {
            console.error('GitHub create issue error:', error);
            return {
                success: false,
                error: error.message,
                issue: null
            };
        }
    }

    // Pull Requests Operations
    async getPullRequests(owner, repo, options = {}) {
        const octokit = await this.getAuthenticatedClient();
        
        const {
            state = 'open', // open, closed, all
            head = '',
            base = '',
            sort = 'created',
            direction = 'desc',
            per_page = 10
        } = options;

        try {
            const response = await octokit.rest.pulls.list({
                owner: owner,
                repo: repo,
                state: state,
                head: head,
                base: base,
                sort: sort,
                direction: direction,
                per_page: per_page
            });

            const pullRequests = response.data.map(pr => ({
                id: pr.id,
                number: pr.number,
                title: pr.title,
                body: pr.body,
                state: pr.state,
                url: pr.html_url,
                user: {
                    login: pr.user.login,
                    avatar_url: pr.user.avatar_url
                },
                head: {
                    ref: pr.head.ref,
                    sha: pr.head.sha,
                    repo: pr.head.repo?.name
                },
                base: {
                    ref: pr.base.ref,
                    sha: pr.base.sha,
                    repo: pr.base.repo.name
                },
                mergeable: pr.mergeable,
                merged: pr.merged,
                draft: pr.draft,
                assignees: pr.assignees.map(a => a.login),
                reviewers: pr.requested_reviewers.map(r => r.login),
                labels: pr.labels.map(l => l.name),
                comments: pr.comments,
                review_comments: pr.review_comments,
                commits: pr.commits,
                additions: pr.additions,
                deletions: pr.deletions,
                changed_files: pr.changed_files,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                closed_at: pr.closed_at,
                merged_at: pr.merged_at
            }));

            return {
                success: true,
                pull_requests: pullRequests,
                total_count: pullRequests.length
            };

        } catch (error) {
            console.error('GitHub PRs API error:', error);
            return {
                success: false,
                error: error.message,
                pull_requests: []
            };
        }
    }

    // Notifications Operations
    async getNotifications(options = {}) {
        const octokit = await this.getAuthenticatedClient();
        
        const {
            all = false,
            participating = false,
            since,
            before,
            per_page = 20
        } = options;

        try {
            const response = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
                all: all,
                participating: participating,
                since: since,
                before: before,
                per_page: per_page
            });

            const notifications = response.data.map(notification => ({
                id: notification.id,
                unread: notification.unread,
                reason: notification.reason,
                subject: {
                    title: notification.subject.title,
                    type: notification.subject.type,
                    url: notification.subject.url
                },
                repository: {
                    name: notification.repository.name,
                    full_name: notification.repository.full_name,
                    url: notification.repository.html_url
                },
                updated_at: notification.updated_at,
                last_read_at: notification.last_read_at,
                url: notification.url
            }));

            return {
                success: true,
                notifications: notifications,
                total_count: notifications.length,
                unread_count: notifications.filter(n => n.unread).length
            };

        } catch (error) {
            console.error('GitHub notifications API error:', error);
            return {
                success: false,
                error: error.message,
                notifications: []
            };
        }
    }

    async markNotificationAsRead(notificationId) {
        const octokit = await this.getAuthenticatedClient();

        try {
            await octokit.rest.activity.markThreadAsRead({
                thread_id: notificationId
            });

            return { success: true };

        } catch (error) {
            console.error('GitHub mark notification error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // User Operations
    async getUserProfile() {
        const octokit = await this.getAuthenticatedClient();

        try {
            const response = await octokit.rest.users.getAuthenticated();
            
            const user = response.data;
            return {
                success: true,
                user: {
                    id: user.id,
                    login: user.login,
                    name: user.name,
                    email: user.email,
                    bio: user.bio,
                    company: user.company,
                    location: user.location,
                    blog: user.blog,
                    avatar_url: user.avatar_url,
                    html_url: user.html_url,
                    public_repos: user.public_repos,
                    public_gists: user.public_gists,
                    followers: user.followers,
                    following: user.following,
                    created_at: user.created_at,
                    updated_at: user.updated_at
                }
            };

        } catch (error) {
            console.error('GitHub user profile error:', error);
            return {
                success: false,
                error: error.message,
                user: null
            };
        }
    }

    // Repository File Operations
    async getRepositoryContent(owner, repo, path = '') {
        const octokit = await this.getAuthenticatedClient();

        try {
            const response = await octokit.rest.repos.getContent({
                owner: owner,
                repo: repo,
                path: path
            });

            return {
                success: true,
                content: response.data
            };

        } catch (error) {
            console.error('GitHub content error:', error);
            return {
                success: false,
                error: error.message,
                content: null
            };
        }
    }

    // Search Operations
    async searchRepositories(query, options = {}) {
        const octokit = await this.getAuthenticatedClient();
        
        const {
            sort = 'updated',
            order = 'desc',
            per_page = 10
        } = options;

        try {
            const response = await octokit.rest.search.repos({
                q: query,
                sort: sort,
                order: order,
                per_page: per_page
            });

            const repositories = response.data.items.map(repo => ({
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                description: repo.description,
                url: repo.html_url,
                language: repo.language,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                updated_at: repo.updated_at,
                score: repo.score
            }));

            return {
                success: true,
                repositories: repositories,
                total_count: response.data.total_count
            };

        } catch (error) {
            console.error('GitHub search error:', error);
            return {
                success: false,
                error: error.message,
                repositories: []
            };
        }
    }

    // Integration Status
    getStatus() {
        const user = this.oauthManager.getAccountByProvider('github');
        
        return {
            connected: !!user,
            user: user ? {
                username: user.profile.username,
                name: user.profile.displayName,
                avatar: user.profile.photos[0]?.value
            } : null,
            client_initialized: !!this.octokit,
            scopes: user ? user.profile._json.scope?.split(',') : []
        };
    }

    // Service Test
    async testConnection() {
        try {
            const octokit = await this.getAuthenticatedClient();
            const response = await octokit.rest.users.getAuthenticated();
            
            return {
                success: true,
                user: response.data.login,
                rateLimit: {
                    limit: response.headers['x-ratelimit-limit'],
                    remaining: response.headers['x-ratelimit-remaining'],
                    reset: response.headers['x-ratelimit-reset']
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = GitHubIntegration;