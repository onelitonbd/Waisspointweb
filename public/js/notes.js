// Notes functionality with Gemini2 AI integration
import { auth, db } from './firebase-config.js';
import { Gemini2Notes } from './gemini2-notes.js';
import { markdownRenderer } from './markdown-renderer.js';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class NotesManager {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.gemini2 = new Gemini2Notes();
        this.initEventListeners();
    }

    initEventListeners() {
        // Notes section click from sidebar is handled by SidebarManager
        // This class focuses on note generation and display
    }

    // Generate notes from study session using Gemini2
    async generateNotesFromSession(sessionTitle, messages) {
        if (!auth.currentUser || !messages || messages.length === 0) return;

        try {
            // Show notes indicator
            this.showNotesIndicator();
            
            // Use Gemini2 to generate notes
            const result = await this.gemini2.generateFromConversation(sessionTitle, messages);
            
            if (result.success) {
                console.log('Notes generated successfully:', result.title);
            } else {
                console.error('Notes generation failed:', result.error);
            }
            
            // Hide notes indicator
            this.hideNotesIndicator();
            
        } catch (error) {
            console.error('Error generating notes:', error);
            this.hideNotesIndicator();
        }
    }

    showNotesIndicator() {
        const indicator = document.getElementById('notes-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    hideNotesIndicator() {
        const indicator = document.getElementById('notes-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    // Direct note generation method
    async generateDirectNotes(content, title = null) {
        try {
            this.showNotesIndicator();
            
            const result = await this.gemini2.generateNotes(content, title);
            
            this.hideNotesIndicator();
            
            return result;
        } catch (error) {
            console.error('Error generating direct notes:', error);
            this.hideNotesIndicator();
            return { success: false, error: error.message };
        }
    }

    displayNote(noteData) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        // Add note header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message ai-message';
        headerDiv.innerHTML = `
            <div class="message-bubble" style="background: #f7fafc; border: 1px solid #e2e8f0; color: #4a5568;">
                <div class="message-content" style="font-weight: 500;">
                    <i data-lucide="file-text" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>${noteData.title}
                    <div style="font-size: 12px; color: #718096; margin-top: 5px;">
                        Created: ${this.formatDate(noteData.createdAt)}
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(headerDiv);
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Add note content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message ai-message';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.style.cssText = 'background: white; border: 1px solid #e2e8f0;';
        
        const noteContentDiv = document.createElement('div');
        noteContentDiv.className = 'message-content note-content';
        
        // Render markdown content
        markdownRenderer.renderToElement(noteContentDiv, noteData.content);
        
        bubbleDiv.appendChild(noteContentDiv);
        contentDiv.appendChild(bubbleDiv);
        messagesContainer.appendChild(contentDiv);
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        messagesContainer.scrollTop = 0;
    }



    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

export { NotesManager };