// Main Application Module
import { auth, db } from './firebase-config.js';
import { authManager } from './auth.js';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class StudyApp {
    constructor() {
        this.currentModule = 'study-session';
        this.sidebarOpen = false;
        this.messages = [];
    }

    init() {
        this.renderMainApp();
        this.initEventListeners();
        this.loadModule('study-session');
    }

    renderMainApp() {
        const mainApp = document.getElementById('main-app');
        mainApp.innerHTML = `
            <div class="main-container">
                <div class="sidebar" id="sidebar">
                    <div class="sidebar-header">
                        <h2>Study Agent</h2>
                    </div>
                    <ul class="sidebar-menu">
                        <li data-module="study-session" class="active">📚 Study Session</li>
                        <li data-module="notes">📝 Notes</li>
                        <li data-module="exam">📋 Exam</li>
                        <li data-module="profile">👤 Profile</li>
                        <li data-module="logout">🚪 Logout</li>
                    </ul>
                </div>
                
                <div class="main-content">
                    <div class="top-bar">
                        <button class="menu-btn" id="menu-btn">☰</button>
                        <h3 id="module-title">Study Session</h3>
                        <div></div>
                    </div>
                    
                    <div class="chat-area" id="chat-area">
                        <div class="message ai">
                            <div class="message-content">
                                Hello! I'm your AI study tutor. How can I help you learn today?
                            </div>
                        </div>
                    </div>
                    
                    <div class="chat-input-area">
                        <div class="chat-input-container">
                            <input type="text" class="chat-input" id="chat-input" placeholder="Type your message...">
                            <button class="send-btn" id="send-btn">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initEventListeners() {
        // Menu toggle
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Sidebar menu items
        document.querySelectorAll('.sidebar-menu li').forEach(item => {
            item.addEventListener('click', () => {
                const module = item.dataset.module;
                if (module === 'logout') {
                    authManager.logout();
                } else {
                    this.loadModule(module);
                }
            });
        });

        // Chat input
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuBtn = document.getElementById('menu-btn');
            
            if (this.sidebarOpen && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                this.toggleSidebar();
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        this.sidebarOpen = !this.sidebarOpen;
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
        } else {
            sidebar.classList.remove('open');
        }
    }

    loadModule(module) {
        this.currentModule = module;
        
        // Update active menu item
        document.querySelectorAll('.sidebar-menu li').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-module="${module}"]`).classList.add('active');
        
        // Update title
        const titles = {
            'study-session': 'Study Session',
            'notes': 'Notes',
            'exam': 'Exam',
            'profile': 'Profile'
        };
        document.getElementById('module-title').textContent = titles[module];
        
        // Clear chat and show module-specific content
        this.clearChat();
        this.showModuleWelcome(module);
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            this.toggleSidebar();
        }
    }

    clearChat() {
        const chatArea = document.getElementById('chat-area');
        chatArea.innerHTML = '';
    }

    showModuleWelcome(module) {
        const welcomeMessages = {
            'study-session': 'Hello! I\'m your AI study tutor. What subject would you like to study today?',
            'notes': 'I\'ll help you take and organize your study notes. What topic are you working on?',
            'exam': 'Ready to test your knowledge? I can create exams based on your notes. What subject?',
            'profile': 'Here you can view your study progress and manage your account settings.'
        };
        
        this.addMessage('ai', welcomeMessages[module]);
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addMessage('user', message);
        input.value = '';
        
        // Add loading indicator
        const loadingId = this.addMessage('ai', '<div class="loading"></div>');
        
        try {
            // Save message to Firestore
            await this.saveMessage('user', message);
            
            // Simulate AI response (replace with actual AI integration)
            const aiResponse = await this.getAIResponse(message);
            
            // Remove loading and add AI response
            document.getElementById(loadingId).remove();
            this.addMessage('ai', aiResponse);
            
            // Save AI response
            await this.saveMessage('ai', aiResponse);
            
        } catch (error) {
            document.getElementById(loadingId).remove();
            this.addMessage('ai', 'Sorry, I encountered an error. Please try again.');
        }
    }

    addMessage(sender, content) {
        const chatArea = document.getElementById('chat-area');
        const messageId = 'msg-' + Date.now();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.id = messageId;
        messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
        
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;
        
        return messageId;
    }

    async saveMessage(sender, content) {
        if (!auth.currentUser) return;
        
        const collectionName = `${this.currentModule.replace('-', '_')}s`;
        
        await addDoc(collection(db, collectionName), {
            userId: auth.currentUser.uid,
            sender: sender,
            content: content,
            timestamp: new Date(),
            module: this.currentModule
        });
    }

    async getAIResponse(message) {
        // Placeholder for AI integration
        // This will be replaced with actual Gemini API calls
        const responses = {
            'study-session': `Great question about "${message}". Let me help you understand this concept better. Here's what you need to know...`,
            'notes': `I've noted down: "${message}". This is important for your studies. Would you like me to elaborate on any part?`,
            'exam': `Based on your question about "${message}", here's a practice question: What are the key concepts related to this topic?`
        };
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return responses[this.currentModule] || `I understand you're asking about "${message}". Let me help you with that.`;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.studyApp = new StudyApp();
});