/**
 * Google Services Integration for G Assistant
 * Handles Gmail, Calendar, Drive, and other Google services
 */

const { google } = require('googleapis');

class GoogleIntegration {
    constructor(oauthManager) {
        this.oauthManager = oauthManager;
        this.services = {
            gmail: null,
            calendar: null,
            drive: null,
            docs: null
        };
    }

    async getAuthenticatedClient() {
        const user = await this.oauthManager.getValidatedUser('google');
        if (!user) {
            throw new Error('Google account not connected');
        }

        const oauth2Client = new google.auth.OAuth2(
            this.oauthManager.config.google.clientID,
            this.oauthManager.config.google.clientSecret,
            this.oauthManager.config.google.callbackURL
        );

        oauth2Client.setCredentials({
            access_token: user.tokens.access_token,
            refresh_token: user.tokens.refresh_token
        });

        return oauth2Client;
    }

    async initializeServices() {
        try {
            const auth = await this.getAuthenticatedClient();
            
            this.services.gmail = google.gmail({ version: 'v1', auth });
            this.services.calendar = google.calendar({ version: 'v3', auth });
            this.services.drive = google.drive({ version: 'v3', auth });
            this.services.docs = google.docs({ version: 'v1', auth });
            
            console.log('✅ Google services initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Google services:', error.message);
            return false;
        }
    }

    // Gmail Operations
    async getEmails(options = {}) {
        if (!this.services.gmail) {
            await this.initializeServices();
        }

        const {
            query = '',
            maxResults = 10,
            labelIds = [],
            includeSpamTrash = false
        } = options;

        try {
            const response = await this.services.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: maxResults,
                labelIds: labelIds,
                includeSpamTrash: includeSpamTrash
            });

            const messages = response.data.messages || [];
            const emailDetails = [];

            // Get detailed information for each message
            for (const message of messages.slice(0, Math.min(maxResults, 10))) {
                try {
                    const detail = await this.services.gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                        format: 'full'
                    });

                    const headers = detail.data.payload.headers;
                    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

                    emailDetails.push({
                        id: message.id,
                        threadId: detail.data.threadId,
                        subject: getHeader('Subject'),
                        from: getHeader('From'),
                        to: getHeader('To'),
                        date: getHeader('Date'),
                        snippet: detail.data.snippet,
                        labelIds: detail.data.labelIds,
                        internalDate: detail.data.internalDate,
                        unread: !detail.data.labelIds.includes('UNREAD') ? false : true
                    });
                } catch (error) {
                    console.warn(`Failed to get details for message ${message.id}:`, error.message);
                }
            }

            return {
                success: true,
                emails: emailDetails,
                totalCount: response.data.resultSizeEstimate || emailDetails.length
            };

        } catch (error) {
            console.error('Gmail API error:', error);
            return {
                success: false,
                error: error.message,
                emails: []
            };
        }
    }

    async sendEmail(emailData) {
        if (!this.services.gmail) {
            await this.initializeServices();
        }

        const { to, subject, body, attachments = [] } = emailData;

        try {
            // Create email content
            const email = [
                `To: ${to}`,
                `Subject: ${subject}`,
                '',
                body
            ].join('\n');

            // Encode the email
            const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

            const response = await this.services.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedEmail
                }
            });

            return {
                success: true,
                messageId: response.data.id,
                threadId: response.data.threadId
            };

        } catch (error) {
            console.error('Gmail send error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Calendar Operations
    async getCalendarEvents(options = {}) {
        if (!this.services.calendar) {
            await this.initializeServices();
        }

        const {
            timeMin = new Date().toISOString(),
            timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
            maxResults = 10,
            singleEvents = true,
            orderBy = 'startTime'
        } = options;

        try {
            const response = await this.services.calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin,
                timeMax: timeMax,
                maxResults: maxResults,
                singleEvents: singleEvents,
                orderBy: orderBy
            });

            const events = response.data.items.map(event => ({
                id: event.id,
                summary: event.summary,
                description: event.description,
                start: event.start.dateTime || event.start.date,
                end: event.end.dateTime || event.end.date,
                location: event.location,
                attendees: event.attendees || [],
                status: event.status,
                htmlLink: event.htmlLink,
                created: event.created,
                updated: event.updated
            }));

            return {
                success: true,
                events: events,
                totalCount: events.length
            };

        } catch (error) {
            console.error('Calendar API error:', error);
            return {
                success: false,
                error: error.message,
                events: []
            };
        }
    }

    async createCalendarEvent(eventData) {
        if (!this.services.calendar) {
            await this.initializeServices();
        }

        const {
            summary,
            description = '',
            start,
            end,
            location = '',
            attendees = []
        } = eventData;

        try {
            const event = {
                summary: summary,
                description: description,
                start: {
                    dateTime: start,
                    timeZone: 'UTC'
                },
                end: {
                    dateTime: end,
                    timeZone: 'UTC'
                },
                location: location,
                attendees: attendees.map(email => ({ email }))
            };

            const response = await this.services.calendar.events.insert({
                calendarId: 'primary',
                requestBody: event
            });

            return {
                success: true,
                eventId: response.data.id,
                htmlLink: response.data.htmlLink,
                event: response.data
            };

        } catch (error) {
            console.error('Calendar create error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Drive Operations
    async getDriveFiles(options = {}) {
        if (!this.services.drive) {
            await this.initializeServices();
        }

        const {
            query = '',
            maxResults = 10,
            orderBy = 'modifiedTime desc',
            fields = 'files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)'
        } = options;

        try {
            const response = await this.services.drive.files.list({
                q: query,
                pageSize: maxResults,
                orderBy: orderBy,
                fields: fields
            });

            const files = response.data.files.map(file => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size ? parseInt(file.size) : null,
                modifiedTime: file.modifiedTime,
                webViewLink: file.webViewLink,
                thumbnailLink: file.thumbnailLink,
                type: this.getMimeTypeCategory(file.mimeType)
            }));

            return {
                success: true,
                files: files,
                totalCount: files.length
            };

        } catch (error) {
            console.error('Drive API error:', error);
            return {
                success: false,
                error: error.message,
                files: []
            };
        }
    }

    async createDriveFolder(folderName, parentFolderId = null) {
        if (!this.services.drive) {
            await this.initializeServices();
        }

        try {
            const folderMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentFolderId ? [parentFolderId] : undefined
            };

            const response = await this.services.drive.files.create({
                requestBody: folderMetadata,
                fields: 'id,name,webViewLink'
            });

            return {
                success: true,
                folderId: response.data.id,
                name: response.data.name,
                webViewLink: response.data.webViewLink
            };

        } catch (error) {
            console.error('Drive folder create error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Docs Operations
    async getDocumentContent(documentId) {
        if (!this.services.docs) {
            await this.initializeServices();
        }

        try {
            const response = await this.services.docs.documents.get({
                documentId: documentId
            });

            const doc = response.data;
            let text = '';

            // Extract text content from document structure
            if (doc.body && doc.body.content) {
                for (const element of doc.body.content) {
                    if (element.paragraph && element.paragraph.elements) {
                        for (const paragraphElement of element.paragraph.elements) {
                            if (paragraphElement.textRun) {
                                text += paragraphElement.textRun.content;
                            }
                        }
                    }
                }
            }

            return {
                success: true,
                document: {
                    id: doc.documentId,
                    title: doc.title,
                    text: text,
                    revisionId: doc.revisionId,
                    createdTime: doc.createdTime,
                    modifiedTime: doc.modifiedTime
                }
            };

        } catch (error) {
            console.error('Docs API error:', error);
            return {
                success: false,
                error: error.message,
                document: null
            };
        }
    }

    // Helper Methods
    getMimeTypeCategory(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.includes('document') || mimeType.includes('text')) return 'document';
        if (mimeType.includes('spreadsheet')) return 'spreadsheet';
        if (mimeType.includes('presentation')) return 'presentation';
        if (mimeType.includes('pdf')) return 'pdf';
        if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
        return 'file';
    }

    // Get integration status
    getStatus() {
        const user = this.oauthManager.getAccountByProvider('google');
        
        return {
            connected: !!user,
            user: user ? {
                name: user.profile.displayName,
                email: user.profile.emails[0].value,
                picture: user.profile.photos[0].value
            } : null,
            services_available: {
                gmail: !!this.services.gmail,
                calendar: !!this.services.calendar,
                drive: !!this.services.drive,
                docs: !!this.services.docs
            },
            token_expires: user ? user.tokens.expires_at : null
        };
    }

    // Comprehensive service test
    async testServices() {
        const results = {
            gmail: false,
            calendar: false,
            drive: false,
            docs: false
        };

        try {
            await this.initializeServices();
            
            // Test Gmail
            try {
                await this.services.gmail.users.getProfile({ userId: 'me' });
                results.gmail = true;
            } catch (error) {
                console.warn('Gmail test failed:', error.message);
            }

            // Test Calendar
            try {
                await this.services.calendar.calendarList.list();
                results.calendar = true;
            } catch (error) {
                console.warn('Calendar test failed:', error.message);
            }

            // Test Drive
            try {
                await this.services.drive.about.get({ fields: 'user' });
                results.drive = true;
            } catch (error) {
                console.warn('Drive test failed:', error.message);
            }

            // Docs service is available if Drive is available
            results.docs = results.drive;

        } catch (error) {
            console.error('Service test failed:', error.message);
        }

        return results;
    }
}

module.exports = GoogleIntegration;