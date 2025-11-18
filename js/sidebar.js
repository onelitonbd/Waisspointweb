// Sidebar functionality with Firebase integration
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    doc,
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class SidebarManager {
    constructor() {
        this.isOpen = false;
        this.sections = {
            'study-sessions': { collapsed: false, data: [] },
            'notes': { collapsed: false, data: [] },
            'exams': { collapsed: false, data: [] }
        };
        this.activeItem = null;
        this.unsubscribes = [];
        
        this.initEventListeners();
        this.initFirebaseListeners();
    }

    initEventListeners() {
        // Sidebar toggle
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.openSidebar();
        });

        document.getElementById('close-sidebar').addEventListener('click', () => {
            this.closeSidebar();
        });

        document.getElementById('sidebar-overlay').addEventListener('click', () => {
            this.closeSidebar();
        });

        // Section headers (collapsible)
        document.getElementById('study-sessions-header').addEventListener('click', () => {
            this.toggleSection('study-sessions');
        });

        document.getElementById('notes-header').addEventListener('click', () => {
            this.toggleSection('notes');
        });

        document.getElementById('exams-header').addEventListener('click', () => {
            this.toggleSection('exams');
        });

        // New chat button
        document.getElementById('new-chat-btn').addEventListener('click', () => {
            this.newChat();
        });

        // Profile button
        document.getElementById('profile-btn').addEventListener('click', () => {
            this.showProfile();
        });

        // Logout button
        document.getElementById('sidebar-logout-btn').addEventListener('click', () => {
            this.logout();
        });
    }

    initFirebaseListeners() {
        if (!auth.currentUser) return;

        const userId = auth.currentUser.uid;

        // Listen to study sessions
        const studySessionsQuery = query(
            collection(db, 'users', userId, 'study_sessions'),
            orderBy('createdAt', 'desc')
        );
        
        const studyUnsubscribe = onSnapshot(studySessionsQuery, (snapshot) => {
            this.sections['study-sessions'].data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.updateSectionList('study-sessions');
        });

        // Listen to notes
        const notesQuery = query(
            collection(db, 'users', userId, 'notes'),
            orderBy('createdAt', 'desc')
        );
        
        const notesUnsubscribe = onSnapshot(notesQuery, (snapshot) => {
            this.sections['notes'].data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.updateSectionList('notes');
        });

        // Listen to exams
        const examsQuery = query(
            collection(db, 'users', userId, 'exams'),
            orderBy('createdAt', 'desc')
        );
        
        const examsUnsubscribe = onSnapshot(examsQuery, (snapshot) => {
            this.sections['exams'].data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.updateSectionList('exams');
        });

        this.unsubscribes = [studyUnsubscribe, notesUnsubscribe, examsUnsubscribe];
    }

    openSidebar() {
        this.isOpen = true;
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.remove('hidden');
    }

    closeSidebar() {
        this.isOpen = false;
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }

    toggleSection(sectionName) {
        const section = this.sections[sectionName];
        section.collapsed = !section.collapsed;
        
        const header = document.getElementById(`${sectionName}-header`);
        const content = document.getElementById(`${sectionName}-content`);
        
        if (section.collapsed) {
            header.classList.add('collapsed');
            content.classList.add('collapsed');
            content.style.maxHeight = '0';
        } else {
            header.classList.remove('collapsed');
            content.classList.remove('collapsed');
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    }

    updateSectionList(sectionName) {
        const listElement = document.getElementById(`${sectionName}-list`);
        const data = this.sections[sectionName].data;
        
        if (data.length === 0) {
            listElement.innerHTML = `<div class="empty-state">No ${sectionName.replace('-', ' ')} yet</div>`;
            return;
        }

        listElement.innerHTML = data.map(item => `
            <div class="section-item" data-type="${sectionName}" data-id="${item.id}">
                <div class="section-item-title">${this.truncateTitle(item.title || 'Untitled')}</div>
                <div class="section-item-date">${this.formatDate(item.createdAt)}</div>
            </div>
        `).join('');

        // Add click listeners to items
        listElement.querySelectorAll('.section-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadItem(item.dataset.type, item.dataset.id);
            });
        });

        // Update section content height if not collapsed
        if (!this.sections[sectionName].collapsed) {
            const content = document.getElementById(`${sectionName}-content`);
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    }

    truncateTitle(title, maxLength = 30) {
        return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString();
    }

    async loadItem(type, id) {
        try {
            // Remove active class from all items
            document.querySelectorAll('.section-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked item
            const clickedItem = document.querySelector(`[data-type="${type}"][data-id="${id}"]`);
            if (clickedItem) {
                clickedItem.classList.add('active');
                this.activeItem = { type, id };
            }

            // Load the item data
            const userId = auth.currentUser.uid;
            const docRef = doc(db, 'users', userId, type, id);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                this.displayItem(type, data);
            } else {
                console.error('Document not found');
            }

            this.closeSidebar();
        } catch (error) {
            console.error('Error loading item:', error);
        }
    }

    displayItem(type, data) {
        // Use chat manager to load the session if available
        if (window.chatManager) {
            window.chatManager.loadSession(data, this.activeItem.id, type.replace('-', '_'));
        } else {
            // Fallback if chat manager not available
            const messagesContainer = document.getElementById('chat-messages');
            messagesContainer.innerHTML = '';

            const headerMessages = {
                'study-sessions': `📚 Study Session: ${data.title || 'Untitled Session'}`,
                'notes': `📝 Notes: ${data.title || 'Untitled Notes'}`,
                'exams': `📋 Exam: ${data.title || 'Untitled Exam'}`
            };

            this.addSystemMessage(headerMessages[type]);

            if (data.messages && Array.isArray(data.messages)) {
                data.messages.forEach(message => {
                    this.addMessage(message.sender, message.content);
                });
            } else if (data.content) {
                this.addMessage('ai', data.content);
            }

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    addSystemMessage(content) {
        const messagesContainer = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.innerHTML = `
            <div class="message-bubble" style="background: #f7fafc; border: 1px solid #e2e8f0; color: #4a5568;">
                <div class="message-content" style="font-weight: 500;">${content}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
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
    }

    newChat() {
        // Clear active item
        this.activeItem = null;
        document.querySelectorAll('.section-item').forEach(item => {
            item.classList.remove('active');
        });

        // Use chat manager to start new session if available
        if (window.chatManager) {
            window.chatManager.startNewSession('study_sessions');
        } else {
            // Fallback if chat manager not available
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
        }

        this.closeSidebar();
    }

    showProfile() {
        const user = auth.currentUser;
        if (!user) return;

        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="message ai-message">
                <div class="message-bubble" style="background: #f7fafc; border: 1px solid #e2e8f0;">
                    <div class="message-content">
                        <strong>👤 Profile Information</strong><br><br>
                        <strong>Name:</strong> ${user.displayName || 'Not set'}<br>
                        <strong>Email:</strong> ${user.email}<br>
                        <strong>Account created:</strong> ${new Date(user.metadata.creationTime).toLocaleDateString()}<br><br>
                        Profile management features will be available in the next update.
                    </div>
                </div>
            </div>
        `;

        this.closeSidebar();
    }

    async logout() {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        try {
            // Unsubscribe from Firebase listeners
            this.unsubscribes.forEach(unsubscribe => unsubscribe());
            this.unsubscribes = [];
            
            await signOut(auth);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    // Clean up listeners when user logs out
    cleanup() {
        this.unsubscribes.forEach(unsubscribe => unsubscribe());
        this.unsubscribes = [];
    }
}