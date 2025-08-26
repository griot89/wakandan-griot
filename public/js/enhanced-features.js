// Enhanced Features for G Assistant
class GAssistantEnhanced {
    constructor() {
        this.notifications = [];
        this.shortcuts = new Map();
        this.themes = ['dark', 'light', 'auto'];
        this.currentTheme = 'dark';
        this.connectionRetries = 0;
        this.maxRetries = 3;
        
        this.initializeEnhancedFeatures();
    }

    // Initialize enhanced features
    initializeEnhancedFeatures() {
        this.setupKeyboardShortcuts();
        this.setupNotificationSystem();
        this.setupThemeSystem();
        this.setupConnectionMonitoring();
        this.setupPerformanceMonitoring();
        this.setupAccessibilityFeatures();
        this.setupAdvancedVoiceFeatures();
    }

    // Keyboard Shortcuts
    setupKeyboardShortcuts() {
        const shortcuts = {
            'ctrl+/': () => this.focusInput(),
            'ctrl+k': () => this.clearChat(),
            'ctrl+shift+s': () => this.toggleSettings(),
            'ctrl+m': () => this.toggleSidebar(),
            'ctrl+shift+v': () => this.toggleVoice(),
            'escape': () => this.closeModals(),
            'ctrl+1': () => this.switchToQuickAction(0),
            'ctrl+2': () => this.switchToQuickAction(1),
            'ctrl+3': () => this.switchToQuickAction(2),
            'ctrl+shift+r': () => this.reconnectWebSocket()
        };

        document.addEventListener('keydown', (e) => {
            const key = this.getShortcutKey(e);
            if (shortcuts[key]) {
                e.preventDefault();
                shortcuts[key]();
            }
        });
    }

    getShortcutKey(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        if (event.metaKey) parts.push('meta');
        parts.push(event.key.toLowerCase());
        return parts.join('+');
    }

    // Notification System
    setupNotificationSystem() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        `;
        document.body.appendChild(this.notificationContainer);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getNotificationIcon(type);
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <i class="${icon}" style="font-size: 1.25rem;"></i>
                <div>
                    <div style="font-weight: 500; margin-bottom: 0.25rem;">${this.getNotificationTitle(type)}</div>
                    <div style="font-size: 0.875rem; color: var(--text-secondary);">${message}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.25rem;">&times;</button>
            </div>
        `;

        this.notificationContainer.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'slideOutToRight 0.3s ease-out';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }

        return notification;
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getNotificationTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || titles.info;
    }

    // Theme System
    setupThemeSystem() {
        this.loadTheme();
        
        // Auto theme based on system preference
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener(() => {
                if (this.currentTheme === 'auto') {
                    this.applyTheme('auto');
                }
            });
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('g-assistant-theme') || 'dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        localStorage.setItem('g-assistant-theme', theme);
    }

    applyTheme(theme) {
        const root = document.documentElement;
        document.body.classList.add('theme-transition');
        
        if (theme === 'light') {
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f8fafc');
            root.style.setProperty('--bg-tertiary', '#f1f5f9');
            root.style.setProperty('--text-primary', '#0f172a');
            root.style.setProperty('--text-secondary', '#475569');
        } else if (theme === 'auto') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.applyTheme(isDark ? 'dark' : 'light');
            return;
        } else {
            // Dark theme (default)
            root.style.setProperty('--bg-primary', '#0a0a0a');
            root.style.setProperty('--bg-secondary', '#111111');
            root.style.setProperty('--bg-tertiary', '#1a1a1a');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#a1a1aa');
        }

        setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 300);
    }

    // Connection Monitoring
    setupConnectionMonitoring() {
        window.addEventListener('online', () => {
            this.showNotification('Connection restored', 'success');
            this.connectionRetries = 0;
        });

        window.addEventListener('offline', () => {
            this.showNotification('Connection lost. Working in offline mode.', 'warning', 0);
        });
    }

    reconnectWebSocket() {
        if (window.socket && !window.socket.connected) {
            this.showNotification('Attempting to reconnect...', 'info');
            window.socket.connect();
        }
    }

    // Performance Monitoring
    setupPerformanceMonitoring() {
        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
                    this.showNotification('High memory usage detected', 'warning');
                }
            }, 60000); // Check every minute
        }

        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        if (entry.duration > 50) {
                            console.warn('Long task detected:', entry);
                        }
                    });
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.log('Performance observer not available');
            }
        }
    }

    // Accessibility Features
    setupAccessibilityFeatures() {
        // High contrast mode detection
        if (window.matchMedia) {
            const highContrast = window.matchMedia('(prefers-contrast: high)');
            highContrast.addListener(() => {
                if (highContrast.matches) {
                    document.body.classList.add('high-contrast');
                } else {
                    document.body.classList.remove('high-contrast');
                }
            });
        }

        // Reduced motion detection
        if (window.matchMedia) {
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            reducedMotion.addListener(() => {
                if (reducedMotion.matches) {
                    document.body.classList.add('reduced-motion');
                } else {
                    document.body.classList.remove('reduced-motion');
                }
            });
        }

        // Focus management
        this.setupFocusManagement();
    }

    setupFocusManagement() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });
    }

    // Advanced Voice Features
    setupAdvancedVoiceFeatures() {
        this.voiceCommands = new Map([
            ['clear chat', () => this.clearChat()],
            ['open settings', () => this.toggleSettings()],
            ['toggle sidebar', () => this.toggleSidebar()],
            ['switch theme', () => this.cycleTheme()],
            ['help', () => this.showHelp()],
            ['status', () => this.showStatus()]
        ]);

        // Voice command recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.setupVoiceCommands();
        }
    }

    setupVoiceCommands() {
        // This would be integrated with the main voice recognition system
        document.addEventListener('voiceCommand', (e) => {
            const command = e.detail.toLowerCase().trim();
            if (this.voiceCommands.has(command)) {
                this.voiceCommands.get(command)();
                this.showNotification(`Command executed: ${command}`, 'success');
            }
        });
    }

    // Utility Methods
    focusInput() {
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages && confirm('Clear chat history?')) {
            chatMessages.innerHTML = '';
            this.showNotification('Chat cleared', 'info');
        }
    }

    toggleSettings() {
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay) {
            const isVisible = settingsOverlay.style.display === 'flex';
            settingsOverlay.style.display = isVisible ? 'none' : 'flex';
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }

    closeModals() {
        const settingsOverlay = document.getElementById('settingsOverlay');
        if (settingsOverlay && settingsOverlay.style.display === 'flex') {
            settingsOverlay.style.display = 'none';
        }

        if (window.isRecording) {
            window.toggleVoiceRecording?.();
        }
    }

    switchToQuickAction(index) {
        const quickActions = document.querySelectorAll('.quick-action');
        if (quickActions[index]) {
            quickActions[index].click();
        }
    }

    cycleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        this.setTheme(this.themes[nextIndex]);
        this.showNotification(`Theme changed to ${this.themes[nextIndex]}`, 'info');
    }

    showHelp() {
        const helpMessage = `
        <strong>Keyboard Shortcuts:</strong><br>
        • Ctrl+/ - Focus input<br>
        • Ctrl+K - Clear chat<br>
        • Ctrl+Shift+S - Settings<br>
        • Ctrl+M - Toggle sidebar<br>
        • Ctrl+Shift+V - Voice input<br>
        • Ctrl+1,2,3 - Quick actions<br><br>
        <strong>Voice Commands:</strong><br>
        • "Clear chat"<br>
        • "Open settings"<br>
        • "Switch theme"<br>
        • "Help"
        `;
        this.showNotification(helpMessage, 'info', 10000);
    }

    showStatus() {
        fetch('/api/health')
            .then(response => response.json())
            .then(data => {
                const status = data.status === 'healthy' ? 'All systems operational' : 'System issues detected';
                this.showNotification(status, data.status === 'healthy' ? 'success' : 'warning');
            })
            .catch(() => {
                this.showNotification('Unable to check system status', 'error');
            });
    }

    // Export user data
    exportData() {
        const data = {
            settings: JSON.parse(localStorage.getItem('g-assistant-settings') || '{}'),
            memories: JSON.parse(localStorage.getItem('g-assistant-memories') || '[]'),
            theme: this.currentTheme,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `g-assistant-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('Data exported successfully', 'success');
    }

    // Import user data
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.settings) {
                    localStorage.setItem('g-assistant-settings', JSON.stringify(data.settings));
                }
                
                if (data.memories) {
                    localStorage.setItem('g-assistant-memories', JSON.stringify(data.memories));
                }
                
                if (data.theme) {
                    this.setTheme(data.theme);
                }

                this.showNotification('Data imported successfully. Refresh to apply changes.', 'success');
            } catch (error) {
                this.showNotification('Error importing data: Invalid file format', 'error');
            }
        };
        reader.readAsText(file);
    }
}

// Initialize enhanced features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gAssistantEnhanced = new GAssistantEnhanced();
});

// CSS for animations not in main stylesheet
const enhancedStyles = `
    @keyframes slideOutToRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .keyboard-navigation button:focus,
    .keyboard-navigation input:focus,
    .keyboard-navigation textarea:focus {
        outline: 2px solid var(--primary-blue) !important;
        outline-offset: 2px !important;
    }

    .high-contrast {
        filter: contrast(150%) brightness(120%);
    }

    .reduced-motion * {
        animation-duration: 0.001s !important;
        transition-duration: 0.001s !important;
    }
`;

// Inject enhanced styles
const styleSheet = document.createElement('style');
styleSheet.textContent = enhancedStyles;
document.head.appendChild(styleSheet);