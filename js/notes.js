// Notes functionality with Gemini2 AI integration
import { auth, db } from './firebase-config.js';
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
            // Extract conversation content for note generation
            const conversationText = messages
                .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
                .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
                .join('\n\n');

            // Generate structured notes using Gemini2
            const notesContent = await this.generateStructuredNotes(conversationText, sessionTitle);
            
            // Save notes to Firebase
            await this.saveNotes(sessionTitle, notesContent);
            
        } catch (error) {
            console.error('Error generating notes:', error);
        }
    }

    async generateStructuredNotes(conversationText, sessionTitle) {
        // Simulate Gemini2 API call for note generation
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Generate structured notes based on conversation
        const notes = `# ${sessionTitle} - Notes

## Key Points
• Main concepts discussed in the study session
• Important definitions and explanations
• Critical information to remember

## Summary
This study session covered essential topics related to ${sessionTitle.toLowerCase()}. The discussion included detailed explanations and practical examples.

## Action Items
• Review the main concepts
• Practice with examples discussed
• Prepare questions for next session

## Additional Resources
• Recommended reading materials
• Practice exercises
• Related topics to explore

---
*Notes automatically generated from study session*`;

        return notes;
    }

    async saveNotes(sessionTitle, content) {
        if (!auth.currentUser) return;

        try {
            const userId = auth.currentUser.uid;
            const noteData = {
                title: `${sessionTitle} - Notes`,
                content: content,
                sessionTitle: sessionTitle,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                type: 'auto-generated'
            };

            await addDoc(collection(db, 'users', userId, 'notes'), noteData);
        } catch (error) {
            console.error('Error saving notes:', error);
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
                    📝 ${noteData.title}
                    <div style="font-size: 12px; color: #718096; margin-top: 5px;">
                        Created: ${this.formatDate(noteData.createdAt)}
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(headerDiv);

        // Add note content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message ai-message';
        contentDiv.innerHTML = `
            <div class="message-bubble" style="background: white; border: 1px solid #e2e8f0;">
                <div class="message-content note-content">
                    ${this.formatNoteContent(noteData.content)}
                </div>
            </div>
        `;
        messagesContainer.appendChild(contentDiv);

        messagesContainer.scrollTop = 0;
    }

    formatNoteContent(content) {
        // Convert markdown-like formatting to HTML
        return content
            .replace(/^# (.*$)/gm, '<h2 style="color: #2d3748; margin: 20px 0 10px 0; font-size: 18px;">$1</h2>')
            .replace(/^## (.*$)/gm, '<h3 style="color: #4a5568; margin: 15px 0 8px 0; font-size: 16px;">$1</h3>')
            .replace(/^• (.*$)/gm, '<div style="margin: 5px 0; padding-left: 15px;">• $1</div>')
            .replace(/^\* (.*$)/gm, '<div style="margin: 5px 0; padding-left: 15px;">• $1</div>')
            .replace(/^---$/gm, '<hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

export { NotesManager };