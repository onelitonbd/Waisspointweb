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
    serverTimestamp,
    doc,
    getDoc,
    updateDoc 
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

    // Add note to existing session
    async addNoteToSession(sessionId, recentMessages) {
        if (!auth.currentUser || !sessionId || !recentMessages || recentMessages.length === 0) return;

        try {
            this.showNotesIndicator();
            
            // Generate note content for recent messages
            const conversationText = recentMessages
                .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
                .join('\n\n');
            
            const result = await this.gemini2.generateSessionNote(conversationText);
            
            if (result.success) {
                await this.saveNoteToSession(sessionId, result.noteTitle, result.noteContent);
            }
            
            this.hideNotesIndicator();
            
        } catch (error) {
            console.error('Error adding note to session:', error);
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

    displaySessionNotes(sessionData) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        // Add notes header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message ai-message';
        headerDiv.innerHTML = `
            <div class="notes-header">
                <h2><i data-lucide="file-text"></i>${sessionData.title} - Notes</h2>
                <div class="notes-info">
                    ${sessionData.sessionNotes?.length || 0} notes • Created: ${this.formatDate(sessionData.createdAt)}
                </div>
            </div>
        `;
        messagesContainer.appendChild(headerDiv);

        // Add notes container
        const notesContainer = document.createElement('div');
        notesContainer.className = 'message ai-message';
        notesContainer.innerHTML = `
            <div class="message-bubble" style="background: transparent; border: none; width: 100%;">
                <div class="notes-container" id="notes-container"></div>
            </div>
        `;
        messagesContainer.appendChild(notesContainer);

        const container = document.getElementById('notes-container');
        
        if (!sessionData.sessionNotes || sessionData.sessionNotes.length === 0) {
            container.innerHTML = `
                <div class="empty-notes">
                    <i data-lucide="file-text"></i>
                    <p>No notes available for this session yet.</p>
                </div>
            `;
        } else {
            sessionData.sessionNotes.forEach((note, index) => {
                this.addNoteSection(container, note, index);
            });
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        messagesContainer.scrollTop = 0;
    }



    addNoteSection(container, note, index) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'note-section';
        sectionDiv.innerHTML = `
            <div class="note-section-header collapsed" data-index="${index}">
                <h3 class="note-section-title">${note.title}</h3>
                <span class="note-section-arrow"><i data-lucide="chevron-down"></i></span>
            </div>
            <div class="note-section-content collapsed" data-index="${index}">
                <div class="note-content"></div>
            </div>
        `;
        
        container.appendChild(sectionDiv);
        
        // Add click handler for expand/collapse
        const header = sectionDiv.querySelector('.note-section-header');
        const content = sectionDiv.querySelector('.note-section-content');
        const noteContentDiv = sectionDiv.querySelector('.note-content');
        
        // Render markdown content
        markdownRenderer.renderToElement(noteContentDiv, note.content);
        
        header.addEventListener('click', () => {
            const isCollapsed = header.classList.contains('collapsed');
            
            if (isCollapsed) {
                header.classList.remove('collapsed');
                content.classList.remove('collapsed');
            } else {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
            }
        });
    }

    async saveNoteToSession(sessionId, noteTitle, noteContent) {
        if (!auth.currentUser) return;

        try {
            const userId = auth.currentUser.uid;
            const sessionRef = doc(db, 'users', userId, 'study_sessions', sessionId);
            const sessionDoc = await getDoc(sessionRef);
            
            if (sessionDoc.exists()) {
                const sessionData = sessionDoc.data();
                const existingNotes = sessionData.sessionNotes || [];
                
                const newNote = {
                    title: noteTitle,
                    content: noteContent,
                    createdAt: new Date(),
                    index: existingNotes.length
                };
                
                existingNotes.push(newNote);
                
                await updateDoc(sessionRef, {
                    sessionNotes: existingNotes,
                    updatedAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error saving note to session:', error);
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

export { NotesManager };