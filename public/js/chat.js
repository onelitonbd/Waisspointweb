// Chat functionality with Gemini API integration
import { auth, db } from './firebase-config.js';
import { geminiAPI } from './gemini-api.js';
import { Gemini1Teacher } from './gemini1-teacher.js';
import { Gemini2Notes } from './gemini2-notes.js';
import { Gemini3Exam } from './gemini3-exam.js';
import { markdownRenderer } from './markdown-renderer.js';
import { ErrorHandler } from './error-handler.js';
import { DataValidator } from './data-validator.js';
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
        this.teacher = null;
        this.initTeacher();
        this.initEventListeners();
        this.initInputValidation();
        this.initNotesManager();
    }

    initTeacher() {
        switch (this.currentSessionType) {
            case 'study_sessions':
                this.teacher = new Gemini1Teacher();
                break;
            case 'notes':
                this.teacher = new Gemini2Notes();
                break;
            case 'exams':
                this.teacher = new Gemini3Exam();
                break;
            default:
                this.teacher = new Gemini1Teacher();
        }
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

        if (!ErrorHandler.validateString(message, 1, 'Chat message validation') || this.isTyping) {
            return;
        }

        // Sanitize input
        const sanitizedMessage = ErrorHandler.sanitizeInput(message);

        // Add user message
        this.addMessage('user', sanitizedMessage);
        this.messages.push({ sender: 'user', content: sanitizedMessage, timestamp: new Date() });
        chatInput.value = '';
        this.updateSendButton();

        // Show typing indicator
        this.showTypingIndicator();

        const result = await ErrorHandler.withErrorHandling(async () => {
            // Add user message to teacher history
            if (this.teacher && typeof this.teacher.addToHistory === 'function') {
                this.teacher.addToHistory('user', sanitizedMessage);
            }
            
            // Get teacher response
            const teacherResult = await this.teacher.processMessage(sanitizedMessage);
            
            if (!teacherResult || !teacherResult.response) {
                throw new Error('Invalid teacher response');
            }
            
            // Remove typing indicator and add AI response
            this.hideTypingIndicator();
            this.addMessage('ai', teacherResult.response);
            this.messages.push({ sender: 'ai', content: teacherResult.response, timestamp: new Date() });
            
            // Add AI response to teacher history
            if (this.teacher && typeof this.teacher.addToHistory === 'function') {
                this.teacher.addToHistory('ai', teacherResult.response);
            }
            
            // Handle special actions
            if (teacherResult.action === 'generate_notes') {
                await this.handleNotesGeneration(teacherResult.content);
            } else if (teacherResult.action === 'generate_exam') {
                await this.handleExamGeneration(teacherResult.content);
            }
            
            // Save to Firebase
            const saveResult = await this.saveSession();
            if (!saveResult) {
                ErrorHandler.logError('Chat', new Error('Failed to save session'));
            }
            
            // Auto-generate notes after every 2 user messages
            if (this.messages.length >= 4) {
                const userMessages = this.messages.filter(msg => msg.sender === 'user');
                if (userMessages.length >= 2 && userMessages.length % 2 === 0) {
                    await this.autoGenerateNotes();
                }
            }
            
            return { success: true };
        }, 'Send message', false);

        if (!result.success) {
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
        if (!auth.currentUser) {
            console.error('User not authenticated');
            return false;
        }

        try {
            const userId = auth.currentUser.uid;
            
            const rawSessionData = {
                title: this.generateSessionTitle(),
                messages: this.messages || [],
                type: this.currentSessionType || 'study_sessions'
            };

            // Validate and sanitize session data
            const safeSessionData = DataValidator.createSafeFirestoreData(rawSessionData, 'session');
            
            // Add timestamps
            safeSessionData.createdAt = serverTimestamp();
            safeSessionData.updatedAt = serverTimestamp();

            if (this.currentSessionId) {
                // Update existing session
                const sessionRef = doc(db, 'users', userId, this.currentSessionType, this.currentSessionId);
                await updateDoc(sessionRef, {
                    messages: safeSessionData.messages,
                    title: safeSessionData.title,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Create new session
                const sessionRef = await addDoc(
                    collection(db, 'users', userId, this.currentSessionType),
                    safeSessionData
                );
                this.currentSessionId = sessionRef.id;
            }
            
            return true;
        } catch (error) {
            const userMessage = ErrorHandler.handleFirebaseError(error, 'Save session');
            ErrorHandler.logError('Chat', error, { sessionType: this.currentSessionType, sessionId: this.currentSessionId });
            return false;
        }
    }

    generateSessionTitle() {
        // Generate title from first user message or use default
        const firstUserMessage = this.messages.find(msg => msg.sender === 'user');
        if (firstUserMessage) {
            const title = firstUserMessage.content.substring(0, 50);
            return title.length < firstUserMessage.content.length ? title + '...' : title;
        }
        
        // Default titles based on session type
        const defaultTitles = {
            'study_sessions': `Study Session - ${new Date().toLocaleDateString()}`,
            'exams': `Exam Prep - ${new Date().toLocaleDateString()}`,
            'notes': `Notes - ${new Date().toLocaleDateString()}`
        };
        
        return defaultTitles[this.currentSessionType] || `Session - ${new Date().toLocaleDateString()}`;
    }

    async autoGenerateNotes() {
        if (!this.currentSessionId || !this.notesManager) {
            return;
        }

        try {
            // Show notes indicator
            const notesIndicator = document.getElementById('notes-indicator');
            if (notesIndicator) {
                notesIndicator.classList.remove('hidden');
            }
            
            // Get recent messages for note generation
            const recentMessages = this.messages.slice(-4); // Last 4 messages
            
            // Use notes manager to add note to current session
            await this.notesManager.addNoteToSession(this.currentSessionId, recentMessages);
            
            // Hide notes indicator after a delay
            setTimeout(() => {
                if (notesIndicator) {
                    notesIndicator.classList.add('hidden');
                }
            }, 2000);
            
        } catch (error) {
            console.error('Error auto-generating notes:', error);
            const notesIndicator = document.getElementById('notes-indicator');
            if (notesIndicator) {
                notesIndicator.classList.add('hidden');
            }
        }
    }

    async handleNotesGeneration(content) {
        try {
            const gemini2Notes = new Gemini2Notes();
            const sessionTitle = this.generateSessionTitle();
            const result = await gemini2Notes.generateNotes(content, sessionTitle);
            
            if (result.success) {
                this.addMessage('ai', `✅ Notes created successfully! Check the Notes section in the sidebar to view "${result.title}".`);
            } else {
                this.addMessage('ai', '❌ Failed to create notes. Please try again.');
            }
        } catch (error) {
            console.error('Error generating notes with Gemini2:', error);
            this.addMessage('ai', '❌ Failed to create notes. Please try again.');
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
        
        // Initialize the appropriate teacher for this session type
        this.initTeacher();
        if (this.teacher && typeof this.teacher.clearHistory === 'function') {
            this.teacher.clearHistory();
        }
        
        const messagesContainer = document.getElementById('chat-messages');
        
        // Different welcome messages based on session type
        const welcomeMessages = {
            'study_sessions': `
                <div class="message ai-message">
                    <div class="message-bubble">
                        <div class="message-content">
                            Hello! I'm your personal teacher and I'm excited to help you learn! 🎓 Whether you want to explore a new topic, solve problems, or dive deep into any subject, I'm here to guide you step by step. What would you like to learn about today?
                        </div>
                    </div>
                </div>
            `,
            'notes': `
                <div class="message ai-message">
                    <div class="message-bubble">
                        <div class="message-content">
                            📝 Hello! I'm your notes assistant. I can help you organize, summarize, and create comprehensive study notes from your learning sessions. What topic would you like to create notes for?
                        </div>
                    </div>
                </div>
            `,
            'exams': `
                <div class="message ai-message">
                    <div class="message-bubble">
                        <div class="message-content">
                            📋 Welcome to Exam Mode! I'm your exam preparation assistant. I can help you:
                            <br><br>
                            • Create practice tests from your study materials
                            • Generate questions on specific topics
                            • Review and explain exam concepts
                            • Provide study strategies for better performance
                            <br><br>
                            What subject or topic would you like to prepare for today?
                        </div>
                    </div>
                </div>
            `
        };
        
        messagesContainer.innerHTML = welcomeMessages[type] || welcomeMessages['study_sessions'];
    }

    loadSession(sessionData, sessionId, sessionType) {
        if (!sessionData || !sessionId || !sessionType) {
            console.error('Invalid session data provided');
            return;
        }
        
        this.currentSessionId = sessionId;
        this.currentSessionType = sessionType;
        this.messages = Array.isArray(sessionData.messages) ? sessionData.messages.filter(msg => 
            msg && typeof msg === 'object' && msg.sender && msg.content
        ) : [];
        
        // Initialize the appropriate teacher for this session type
        this.initTeacher();
        
        // Load conversation into teacher history
        if (this.teacher) {
            if (typeof this.teacher.clearHistory === 'function') {
                this.teacher.clearHistory();
            }
            if (typeof this.teacher.addToHistory === 'function') {
                this.messages.forEach(msg => {
                    this.teacher.addToHistory(msg.sender, msg.content);
                });
            }
        }
        
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.error('Messages container not found');
            return;
        }
        
        messagesContainer.innerHTML = '';
        
        // Add session header
        const headerMessages = {
            'study_sessions': `<i data-lucide="book" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Study Session: ${sessionData.title || 'Untitled Session'}`,
            'notes': `<i data-lucide="file-text" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Notes: ${sessionData.title || 'Untitled Notes'}`,
            'exams': `<i data-lucide="clipboard-list" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Exam: ${sessionData.title || 'Untitled Exam'}`
        };
        
        this.addSystemMessage(headerMessages[sessionType] || `Session: ${sessionData.title || 'Untitled'}`);
        
        // Load messages
        if (this.messages && this.messages.length > 0) {
            this.messages.forEach(message => {
                if (message.sender && message.content) {
                    this.addMessage(message.sender, message.content);
                }
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