// Sidebar functionality with Firebase integration
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    deleteDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class SidebarManager {
    constructor() {
        this.isOpen = false;
        this.sections = {
            'study-sessions': { collapsed: true, data: [] },
            'notes': { collapsed: true, data: [] },
            'exams': { collapsed: true, data: [] }
        };
        this.activeItem = null;
        this.unsubscribes = [];
        this.contextMenuTarget = null;
        this.modalTarget = null;
        this.longPressTimer = null;
        
        this.initEventListeners();
        this.initFirebaseListeners();
        
        // Initialize sections as collapsed
        this.initCollapsedSections();
        
        // Initialize context menu after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initContextMenu();
            });
        } else {
            this.initContextMenu();
        }
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

        // Generate exam button (will be added dynamically)
        this.addGenerateExamButton();

        // Profile button
        document.getElementById('profile-btn').addEventListener('click', () => {
            this.showProfile();
        });

        // Logout button
        document.getElementById('sidebar-logout-btn').addEventListener('click', () => {
            this.logout();
        });
    }

    initCollapsedSections() {
        // Set all sections to collapsed state on initialization
        Object.keys(this.sections).forEach(sectionName => {
            const header = document.getElementById(`${sectionName}-header`);
            const content = document.getElementById(`${sectionName}-content`);
            
            if (header && content) {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
                content.style.maxHeight = '0';
            }
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

        // Listen to study sessions for notes
        const notesUnsubscribe = onSnapshot(studySessionsQuery, (snapshot) => {
            // Filter study sessions that have notes
            this.sections['notes'].data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(session => session.sessionNotes && session.sessionNotes.length > 0)
                .map(session => ({
                    ...session,
                    title: `${session.title} - Notes`
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
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        sidebar.classList.remove('hidden');
        setTimeout(() => {
            sidebar.classList.add('open');
        }, 10);
        overlay.classList.remove('hidden');
    }

    closeSidebar() {
        this.isOpen = false;
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        sidebar.classList.remove('open');
        overlay.classList.add('hidden');
        
        setTimeout(() => {
            if (!this.isOpen) {
                sidebar.classList.add('hidden');
            }
        }, 300);
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
            item.addEventListener('click', (e) => {
                if (!this.contextMenuTarget) {
                    this.loadItem(item.dataset.type, item.dataset.id);
                }
            });
            
            // Add context menu listeners
            this.addContextMenuListeners(item);
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
            let collectionName = type.replace('-', '_');
            
            // If it's notes, actually load from study_sessions
            if (type === 'notes') {
                collectionName = 'study_sessions';
            }
            
            const docRef = doc(db, 'users', userId, collectionName, id);
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

    async displayItem(type, data) {
        if (type === 'notes') {
            // Handle notes display - check if it's a study session with notes
            try {
                const { NotesManager } = await import('./notes.js');
                const notesManager = new NotesManager();
                notesManager.displaySessionNotes(data);
            } catch (error) {
                console.error('Error loading notes:', error);
                this.fallbackDisplay(type, data);
            }
        } else if (type === 'exams') {
            // Handle exam display
            try {
                const { ExamsManager } = await import('./exams.js');
                if (!window.examsManager) {
                    window.examsManager = new ExamsManager();
                }
                window.examsManager.displayExam(data, this.activeItem.id);
            } catch (error) {
                console.error('Error loading exam:', error);
                this.fallbackDisplay(type, data);
            }
        } else if (type === 'study-sessions') {
            // Check if user wants to see notes or chat history
            if (data.sessionNotes && data.sessionNotes.length > 0) {
                // Show option or default to chat history
                if (window.chatManager) {
                    window.chatManager.loadSession(data, this.activeItem.id, type.replace('-', '_'));
                } else {
                    this.fallbackDisplay(type, data);
                }
            } else {
                // No notes, show chat history
                if (window.chatManager) {
                    window.chatManager.loadSession(data, this.activeItem.id, type.replace('-', '_'));
                } else {
                    this.fallbackDisplay(type, data);
                }
            }
        } else if (window.chatManager) {
            // Use chat manager for sessions
            window.chatManager.loadSession(data, this.activeItem.id, type.replace('-', '_'));
        } else {
            this.fallbackDisplay(type, data);
        }
    }

    fallbackDisplay(type, data) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';

        const headerMessages = {
            'study-sessions': `<i data-lucide="book" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Study Session: ${data.title || 'Untitled Session'}`,
            'notes': `<i data-lucide="file-text" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Notes: ${data.title || 'Untitled Notes'}`,
            'exams': `<i data-lucide="clipboard-list" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Exam: ${data.title || 'Untitled Exam'}`
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
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
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
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
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
                        <strong><i data-lucide="user" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Profile Information</strong><br><br>
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
    addGenerateExamButton() {
        // Add generate exam button after notes section
        const notesSection = document.querySelector('[data-module="notes"]')?.closest('.sidebar-section');
        if (notesSection) {
            const examButton = document.createElement('button');
            examButton.className = 'sidebar-item generate-exam-btn';
            examButton.innerHTML = `
                <span class="sidebar-icon"><i data-lucide="target"></i></span>
                Generate New Exam
            `;
            examButton.addEventListener('click', () => {
                this.generateNewExam();
            });
            
            notesSection.insertAdjacentElement('afterend', examButton);
        }
    }

    async generateNewExam() {
        try {
            const { ExamsManager } = await import('./exams.js');
            if (!window.examsManager) {
                window.examsManager = new ExamsManager();
            }
            
            // Show loading message
            this.addSystemMessage('<i data-lucide="target" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Generating new exam from your notes...');
            
            const result = await window.examsManager.generateExamFromNotes();
            
            if (result.success) {
                this.addSystemMessage('<i data-lucide="check-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>New exam generated successfully! Check the Exams section.');
            } else {
                this.addSystemMessage('❌ Error generating exam. Make sure you have notes available.');
            }
            
            this.closeSidebar();
        } catch (error) {
            console.error('Error generating exam:', error);
            this.addSystemMessage('❌ Error generating exam. Make sure you have notes available.');
        }
    }

    initContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        const modalOverlay = document.getElementById('modal-overlay');
        const modalInput = document.getElementById('modal-input');
        const modalTitle = document.getElementById('modal-title');
        const modalConfirm = document.getElementById('modal-confirm');
        const modalCancel = document.getElementById('modal-cancel');
        const renameItem = document.getElementById('rename-item');
        const deleteItem = document.getElementById('delete-item');

        if (!contextMenu || !modalOverlay || !renameItem || !deleteItem) {
            console.error('Context menu elements not found');
            return;
        }

        // Hide context menu on outside click
        document.addEventListener('click', (e) => {
            if (contextMenu && !contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Rename item
        renameItem.addEventListener('click', () => {
            this.showRenameModal();
        });

        // Delete item
        deleteItem.addEventListener('click', () => {
            this.showDeleteModal();
        });

        // Modal actions
        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                this.hideModal();
            });
        }

        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.hideModal();
                }
            });
        }

        if (modalConfirm) {
            modalConfirm.addEventListener('click', () => {
                this.handleModalConfirm();
            });
        }

        if (modalInput) {
            modalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleModalConfirm();
                }
            });
        }
    }

    addContextMenuListeners(item) {
        // Add context menu to study sessions, notes, and exams
        const itemType = item.dataset.type;
        if (itemType !== 'study-sessions' && itemType !== 'exams' && itemType !== 'notes') {
            return;
        }
        
        let longPressTimer;
        let startX, startY;
        const longPressDuration = 500; // 500ms

        // Mouse events
        item.addEventListener('mousedown', (e) => {
            if (e.button === 2) return; // Ignore right click
            
            startX = e.clientX;
            startY = e.clientY;
            
            longPressTimer = setTimeout(() => {
                this.showContextMenu(e, item);
            }, longPressDuration);
        });

        item.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });

        item.addEventListener('mousemove', (e) => {
            const moveThreshold = 10;
            if (Math.abs(e.clientX - startX) > moveThreshold || 
                Math.abs(e.clientY - startY) > moveThreshold) {
                clearTimeout(longPressTimer);
            }
        });

        item.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });

        // Touch events
        item.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            
            longPressTimer = setTimeout(() => {
                this.showContextMenu(e, item);
            }, longPressDuration);
        });

        item.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });

        item.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const moveThreshold = 10;
            if (Math.abs(touch.clientX - startX) > moveThreshold || 
                Math.abs(touch.clientY - startY) > moveThreshold) {
                clearTimeout(longPressTimer);
            }
        });

        // Right click context menu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, item);
        });
    }

    showContextMenu(e, item) {
        e.preventDefault();
        e.stopPropagation();
        
        this.contextMenuTarget = {
            element: item,
            type: item.dataset.type,
            id: item.dataset.id,
            title: item.querySelector('.section-item-title').textContent
        };

        const contextMenu = document.getElementById('context-menu');
        const rect = item.getBoundingClientRect();
        
        // Position context menu
        let x = e.clientX || rect.right;
        let y = e.clientY || rect.top;
        
        // Adjust position to keep menu in viewport
        const menuWidth = 150;
        const menuHeight = 80;
        
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }
        
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }
        
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.style.display = 'block';
        
        // Add visual feedback
        item.style.background = '#e2e8f0';
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.display = 'none';
        
        if (this.contextMenuTarget) {
            this.contextMenuTarget.element.style.background = '';
            this.contextMenuTarget = null;
        }
    }

    showRenameModal() {
        if (!this.contextMenuTarget) return;
        
        this.modalTarget = { ...this.contextMenuTarget };
        
        const modalOverlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const modalConfirm = document.getElementById('modal-confirm');
        
        modalTitle.textContent = 'Rename Item';
        modalInput.value = this.modalTarget.title;
        modalConfirm.textContent = 'Save';
        modalConfirm.className = 'modal-btn confirm';
        
        modalOverlay.style.display = 'flex';
        modalInput.focus();
        modalInput.select();
        
        this.hideContextMenu();
    }

    showDeleteModal() {
        if (!this.contextMenuTarget) return;
        
        this.modalTarget = { ...this.contextMenuTarget };
        
        const modalOverlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const modalConfirm = document.getElementById('modal-confirm');
        
        modalTitle.textContent = 'Delete Item';
        modalInput.value = `Are you sure you want to delete "${this.modalTarget.title}"?`;
        modalInput.disabled = true;
        modalConfirm.textContent = 'Delete';
        modalConfirm.className = 'modal-btn delete';
        
        modalOverlay.style.display = 'flex';
        
        this.hideContextMenu();
    }

    hideModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalInput = document.getElementById('modal-input');
        
        modalOverlay.style.display = 'none';
        modalInput.disabled = false;
        modalInput.value = '';
        this.modalTarget = null;
    }

    async handleModalConfirm() {
        if (!this.modalTarget) {
            console.error('No modal target');
            return;
        }
        
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        
        try {
            if (modalTitle?.textContent === 'Rename Item') {
                await this.renameItem(modalInput?.value.trim());
            } else if (modalTitle?.textContent === 'Delete Item') {
                await this.deleteItem();
            }
            
            this.hideModal();
        } catch (error) {
            console.error('Error handling modal action:', error);
            alert('An error occurred. Please try again.');
        }
    }

    async renameItem(newTitle) {
        if (!newTitle || !this.modalTarget) return;
        
        const { type, id } = this.modalTarget;
        const userId = auth.currentUser.uid;
        
        // Notes are stored within study sessions
        const collectionName = type === 'notes' ? 'study_sessions' : type.replace('-', '_');
        
        const docRef = doc(db, 'users', userId, collectionName, id);
        await updateDoc(docRef, {
            title: newTitle,
            updatedAt: new Date()
        });
    }

    async deleteItem() {
        if (!this.modalTarget) {
            console.error('No modal target for deletion');
            return;
        }
        
        const { type, id } = this.modalTarget;
        const userId = auth.currentUser.uid;
        
        if (type === 'notes') {
            // For notes, clear the sessionNotes array instead of deleting the document
            const docRef = doc(db, 'users', userId, 'study_sessions', id);
            await updateDoc(docRef, {
                sessionNotes: [],
                updatedAt: new Date()
            });
        } else {
            // For other types, delete the document
            const collectionName = type.replace('-', '_');
            const docRef = doc(db, 'users', userId, collectionName, id);
            await deleteDoc(docRef);
        }
        
        // Clear active item if it was the deleted one
        if (this.activeItem && this.activeItem.type === type && this.activeItem.id === id) {
            this.activeItem = null;
            document.querySelectorAll('.section-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Show default message
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
    }

    cleanup() {
        this.unsubscribes.forEach(unsubscribe => unsubscribe());
        this.unsubscribes = [];
    }
}