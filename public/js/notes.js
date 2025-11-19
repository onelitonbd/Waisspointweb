// Notes functionality with Gemini2 AI integration
import { auth, db } from './firebase-config.js';
import { Gemini2Notes } from './gemini2-notes.js';
import { markdownRenderer } from './markdown-renderer.js';
import { ErrorHandler } from './error-handler.js';
import { DataValidator } from './data-validator.js';
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
        if (!auth.currentUser || !sessionId || !recentMessages || recentMessages.length === 0) {
            ErrorHandler.logError('Notes', new Error('Missing required parameters for adding note to session'));
            return;
        }

        return await ErrorHandler.withErrorHandling(async () => {
            this.showNotesIndicator();
            
            // Validate messages array
            if (!ErrorHandler.validateArray(recentMessages, 'Recent messages validation')) {
                throw new Error('Invalid messages format');
            }
            
            // Generate note content for recent messages
            const conversationText = recentMessages
                .filter(msg => msg && msg.sender && msg.content)
                .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
                .join('\n\n');
            
            if (!conversationText.trim()) {
                throw new Error('No valid message content found');
            }
            
            const result = await this.gemini2.generateSessionNote(conversationText);
            
            if (result.success) {
                const saveResult = await this.saveNoteToSession(sessionId, result.noteTitle, result.noteContent);
                if (!saveResult) {
                    throw new Error('Failed to save note to session');
                }
            } else {
                throw new Error(result.error || 'Failed to generate note');
            }
            
            this.hideNotesIndicator();
            return { success: true };
        }, 'Add note to session', false).finally(() => {
            this.hideNotesIndicator();
        });
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
        if (!sessionData) {
            console.error('No session data provided');
            return;
        }

        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.error('Messages container not found');
            return;
        }
        
        messagesContainer.innerHTML = '';

        // Add notes header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message ai-message';
        headerDiv.innerHTML = `
            <div class="notes-header">
                <h2><i data-lucide="file-text"></i>${sessionData.title || 'Untitled Session'} - Notes</h2>
                <div class="notes-info">
                    ${Array.isArray(sessionData.sessionNotes) ? sessionData.sessionNotes.length : 0} notes • Created: ${this.formatDate(sessionData.createdAt)}
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
        
        if (!Array.isArray(sessionData.sessionNotes) || sessionData.sessionNotes.length === 0) {
            container.innerHTML = `
                <div class="empty-notes">
                    <i data-lucide="file-text"></i>
                    <p>No notes available for this session yet.</p>
                </div>
            `;
        } else {
            sessionData.sessionNotes.forEach((note, index) => {
                if (note && note.title && note.content) {
                    this.addNoteSection(container, note, index);
                }
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
        if (!auth.currentUser || !sessionId || !noteTitle || !noteContent) {
            console.error('Missing required parameters for saving note');
            return false;
        }

        try {
            const userId = auth.currentUser.uid;
            const sessionRef = doc(db, 'users', userId, 'study_sessions', sessionId);
            const sessionDoc = await getDoc(sessionRef);
            
            // Validate Firestore response
            const validation = DataValidator.validateFirestoreResponse(sessionDoc, ['title']);
            if (!validation.valid) {
                ErrorHandler.logError('Notes', new Error(validation.error), { sessionId });
                return false;
            }
            
            const sessionData = validation.data;
            const existingNotes = Array.isArray(sessionData.sessionNotes) ? sessionData.sessionNotes : [];
            
            const rawNoteData = {
                title: noteTitle,
                content: noteContent,
                index: existingNotes.length
            };
            
            // Validate and sanitize note data
            const safeNoteData = DataValidator.createSafeFirestoreData(rawNoteData, 'note');
            safeNoteData.createdAt = new Date(); // Use Date instead of serverTimestamp for arrays
            
            existingNotes.push(safeNoteData);
            
            await updateDoc(sessionRef, {
                sessionNotes: existingNotes,
                updatedAt: serverTimestamp()
            });
            
            return true;
        } catch (error) {
            ErrorHandler.handleFirebaseError(error, 'Save note to session');
            return false;
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

export { NotesManager };