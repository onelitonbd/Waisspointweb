// Chat functionality with Gemini API integration
import { auth, db } from './firebase-config.js';
import { geminiAPI } from './gemini-api.js';
import { Gemini1Teacher } from './gemini1-teacher.js';
import { markdownRenderer } from './markdown-renderer.js';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class ChatManager {
    constructor() {
        this.isTyping = false;
        this.currentSessionId = null;
        this.currentSessionType = 'study_sessions';
        this.messages = [];
        this.notesManager = null;
        this.teacher = new Gemini1Teacher();
        this.initEventListeners();
        this.initInputValidation();
        this.initNotesManager();
    }

    async initNotesManager() {
        try {
            const { NotesManager } = await import('./notes.js');
            this.notesManager = new NotesManager();
        } catch (error) {
            console.error('Error loading notes manager:', error);
        }
    }

    initEventListeners() {
        // Send message
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Note: Sidebar controls are now handled by SidebarManager
    }

    initInputValidation() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');

        chatInput.addEventListener('input', () => {
            const message = chatInput.value.trim();
            sendBtn.disabled = !message || this.isTyping;
        });
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();

        if (!message || this.isTyping) return;

        // Add user message
        this.addMessage('user', message);
        this.messages.push({ sender: 'user', content: message, timestamp: new Date() });
        chatInput.value = '';
        this.updateSendButton();

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Add user message to teacher history
            this.teacher.addToHistory('user', message);
            
            // Get teacher response
            const teacherResult = await this.teacher.processMessage(message);
            
            // Remove typing indicator and add AI response
            this.hideTypingIndicator();
            this.addMessage('ai', teacherResult.response);
            this.messages.push({ sender: 'ai', content: teacherResult.response, timestamp: new Date() });
            
            // Add AI response to teacher history
            this.teacher.addToHistory('ai', teacherResult.response);
            
            // Handle special actions
            if (teacherResult.action === 'generate_notes') {
                await this.handleNotesGeneration(teacherResult.content);
            } else if (teacherResult.action === 'generate_exam') {
                await this.handleExamGeneration(teacherResult.content);
            }
            
            // Save to Firebase
            await this.saveSession();
            
            // Generate notes if this is a study session and we have enough content
            if (this.currentSessionType === 'study_sessions' && this.messages.length >= 4 && this.messages.length % 4 === 0 && this.notesManager) {
                const recentMessages = this.messages.slice(-4);
                await this.notesManager.addNoteToSession(this.currentSessionId, recentMessages);
            }
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.hideTypingIndicator();
            const errorMessage = 'Sorry, I encountered an error. Please try again.';
            this.addMessage('ai', errorMessage);
            this.messages.push({ sender: 'ai', content: errorMessage, timestamp: new Date() });
        }
    }

    addMessage(sender, content) {
        const messagesContainer = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Render markdown for AI messages, plain text for user messages
        if (sender === 'ai') {
            markdownRenderer.renderToElement(contentDiv, content);
        } else {
            contentDiv.textContent = content;
        }
        
        bubbleDiv.appendChild(contentDiv);
        messageDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(messageDiv);
        
        // Auto-scroll to bottom
        this.scrollToBottom();
    }

    showTypingIndicator() {
        this.isTyping = true;
        this.updateSendButton();

        const messagesContainer = document.getElementById('chat-messages');
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message';
        typingDiv.id = 'typing-indicator';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'typing-indicator';
        indicatorDiv.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        
        bubbleDiv.appendChild(indicatorDiv);
        typingDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(typingDiv);
        
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        this.updateSendButton();
        
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    updateSendButton() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const message = chatInput.value.trim();
        
        sendBtn.disabled = !message || this.isTyping;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async getGeminiResponse(message) {
        try {
            // Add realistic delay for better UX
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
            
            // Get response from Gemini API
            const response = await geminiAPI.generateResponse(message);
            return response;
        } catch (error) {
            console.error('Error getting Gemini response:', error);
            return 'I apologize, but I\'m having trouble processing your request right now. Please try again.';
        }
    }

    async saveSession() {
        if (!auth.currentUser || this.messages.length === 0) return;

        try {
            const userId = auth.currentUser.uid;
            const sessionData = {
                title: this.generateSessionTitle(),
                messages: this.messages,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                type: this.currentSessionType
            };

            if (this.currentSessionId) {
                // Update existing session
                const sessionRef = doc(db, 'users', userId, this.currentSessionType, this.currentSessionId);
                await updateDoc(sessionRef, {
                    messages: this.messages,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Create new session
                const sessionRef = await addDoc(
                    collection(db, 'users', userId, this.currentSessionType),
                    sessionData
                );
                this.currentSessionId = sessionRef.id;
            }
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    generateSessionTitle() {
        // Generate title from first user message or use default
        const firstUserMessage = this.messages.find(msg => msg.sender === 'user');
        if (firstUserMessage) {
            const title = firstUserMessage.content.substring(0, 50);
            return title.length < firstUserMessage.content.length ? title + '...' : title;
        }
        return `Study Session - ${new Date().toLocaleDateString()}`;
    }

    async handleNotesGeneration(content) {
        if (this.notesManager) {
            const sessionTitle = this.generateSessionTitle();
            const result = await this.notesManager.generateDirectNotes(content, sessionTitle);
            
            if (result.success) {
                this.addMessage('ai', `✅ Notes created successfully! Check the Notes section in the sidebar to view "${result.title}".`);
            } else {
                this.addMessage('ai', '❌ Failed to create notes. Please try again.');
            }
        }
    }

    async handleExamGeneration(content) {
        try {
            const { ExamsManager } = await import('./exams.js');
            if (!window.examsManager) {
                window.examsManager = new ExamsManager();
            }
            
            const result = await window.examsManager.generateExamFromNotes();
            
            if (result.success) {
                this.addMessage('ai', `📋 Exam created successfully! Check the Exams section in the sidebar to take "${result.examData.title}".`);
            } else {
                this.addMessage('ai', '❌ Failed to create exam. Make sure you have notes available.');
            }
        } catch (error) {
            console.error('Error generating exam:', error);
            this.addMessage('ai', '❌ Error generating exam. Please try again.');
        }
    }

    startNewSession(type = 'study_sessions') {
        this.currentSessionId = null;
        this.currentSessionType = type;
        this.messages = [];
        this.teacher.clearHistory();
        
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="message ai-message">
                <div class="message-bubble">
                    <div class="message-content">
                        Hello! I'm your personal teacher and I'm excited to help you learn! 🎓 Whether you want to explore a new topic, solve problems, or dive deep into any subject, I'm here to guide you step by step. What would you like to learn about today?
                    </div>
                </div>
            </div>
        `;
    }

    loadSession(sessionData, sessionId, sessionType) {
        this.currentSessionId = sessionId;
        this.currentSessionType = sessionType;
        this.messages = sessionData.messages || [];
        
        // Load conversation into teacher history
        this.teacher.clearHistory();
        this.messages.forEach(msg => {
            this.teacher.addToHistory(msg.sender, msg.content);
        });
        
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';
        
        // Add session header
        const headerMessages = {
            'study_sessions': `<i data-lucide="book" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Study Session: ${sessionData.title || 'Untitled Session'}`,
            'notes': `<i data-lucide="file-text" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Notes: ${sessionData.title || 'Untitled Notes'}`,
            'exams': `<i data-lucide="clipboard-list" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Exam: ${sessionData.title || 'Untitled Exam'}`
        };
        
        this.addSystemMessage(headerMessages[sessionType]);
        
        // Load messages
        if (this.messages && this.messages.length > 0) {
            this.messages.forEach(message => {
                this.addMessage(message.sender, message.content);
            });
        }
        
        this.scrollToBottom();
    }

    addSystemMessage(content) {
        const messagesContainer = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.style.cssText = 'background: #f7fafc; border: 1px solid #e2e8f0; color: #4a5568;';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.fontWeight = '500';
        
        // Render markdown for system messages
        markdownRenderer.renderToElement(contentDiv, content);
        
        bubbleDiv.appendChild(contentDiv);
        messageDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(messageDiv);
    }
}

// Initialize chat manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatManager = new ChatManager();
});

export { ChatManager };