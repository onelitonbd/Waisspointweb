// Chat functionality with Gemini API integration
import { auth } from './firebase-config.js';
import { geminiAPI } from './gemini-api.js';

class ChatManager {
    constructor() {
        this.isTyping = false;
        this.initEventListeners();
        this.initInputValidation();
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

        // Sidebar controls
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.openSidebar();
        });

        document.getElementById('close-sidebar').addEventListener('click', () => {
            this.closeSidebar();
        });

        document.getElementById('sidebar-overlay').addEventListener('click', () => {
            this.closeSidebar();
        });

        // Sidebar menu items
        document.getElementById('new-chat-btn').addEventListener('click', () => {
            this.newChat();
        });

        document.getElementById('sidebar-logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Other sidebar items (placeholder for future implementation)
        document.getElementById('history-btn').addEventListener('click', () => {
            this.showNotImplemented('Chat History');
        });

        document.getElementById('notes-btn').addEventListener('click', () => {
            this.showNotImplemented('Notes');
        });

        document.getElementById('exam-btn').addEventListener('click', () => {
            this.showNotImplemented('Exam Prep');
        });
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
        chatInput.value = '';
        this.updateSendButton();

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Get AI response from Gemini
            const aiResponse = await this.getGeminiResponse(message);
            
            // Remove typing indicator and add AI response
            this.hideTypingIndicator();
            this.addMessage('ai', aiResponse);
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.hideTypingIndicator();
            this.addMessage('ai', 'Sorry, I encountered an error. Please try again.');
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
        contentDiv.textContent = content;
        
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

    openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.remove('hidden');
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }

    newChat() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="message ai-message">
                <div class="message-bubble">
                    <div class="message-content">
                        Hello! I'm your AI study assistant. I can help you with studying, taking notes, and preparing for exams. What would you like to work on today?
                    </div>
                </div>
            </div>
        `;
        this.closeSidebar();
    }

    showNotImplemented(feature) {
        this.addMessage('ai', `${feature} feature will be implemented in the next update. For now, you can continue chatting with me about your studies!`);
        this.closeSidebar();
    }

    async logout() {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}

// Initialize chat manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatManager = new ChatManager();
});