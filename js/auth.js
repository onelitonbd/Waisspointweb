// Authentication Module
import { auth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initAuthListener();
        this.initEventListeners();
    }

    initAuthListener() {
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            if (user) {
                this.showChatPage();
            } else {
                this.showLoginPage();
            }
        });
    }

    initEventListeners() {
        // Page switching
        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignupPage();
        });
        
        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginPage();
        });

        // Form submissions
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('signup-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Real-time validation
        document.getElementById('signup-confirm-password').addEventListener('input', () => {
            this.validatePasswordMatch();
        });
    }

    showLoginPage() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('signup-page').classList.add('hidden');
        document.getElementById('chat-page').classList.add('hidden');
        this.clearErrors();
    }

    showSignupPage() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('signup-page').classList.remove('hidden');
        document.getElementById('chat-page').classList.add('hidden');
        this.clearErrors();
    }

    showChatPage() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('signup-page').classList.add('hidden');
        document.getElementById('chat-page').classList.remove('hidden');
    }

    clearErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => el.textContent = '');
        
        const inputElements = document.querySelectorAll('input');
        inputElements.forEach(el => el.classList.remove('error'));
    }

    showError(fieldId, message) {
        const errorElement = document.getElementById(fieldId + '-error');
        const inputElement = document.getElementById(fieldId);
        
        if (errorElement) errorElement.textContent = message;
        if (inputElement) inputElement.classList.add('error');
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePasswordMatch() {
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        
        if (confirmPassword && password !== confirmPassword) {
            this.showError('signup-confirm', 'Passwords do not match');
            return false;
        } else {
            document.getElementById('signup-confirm-error').textContent = '';
            document.getElementById('signup-confirm-password').classList.remove('error');
            return true;
        }
    }

    setLoading(formType, isLoading) {
        const btn = document.getElementById(formType + '-btn');
        const btnText = btn.querySelector('.btn-text');
        const loading = document.getElementById(formType + '-loading');
        
        if (isLoading) {
            btn.disabled = true;
            btnText.style.opacity = '0';
            loading.classList.remove('hidden');
        } else {
            btn.disabled = false;
            btnText.style.opacity = '1';
            loading.classList.add('hidden');
        }
    }

    async handleLogin() {
        this.clearErrors();
        
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        // Validation
        let isValid = true;
        
        if (!email) {
            this.showError('login-email', 'Email is required');
            isValid = false;
        } else if (!this.validateEmail(email)) {
            this.showError('login-email', 'Please enter a valid email');
            isValid = false;
        }
        
        if (!password) {
            this.showError('login-password', 'Password is required');
            isValid = false;
        }
        
        if (!isValid) return;

        this.setLoading('login', true);
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            this.setLoading('login', false);
            
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    this.showError('login-password', 'Invalid email or password');
                    break;
                case 'auth/invalid-email':
                    this.showError('login-email', 'Invalid email address');
                    break;
                case 'auth/too-many-requests':
                    this.showError('login-password', 'Too many failed attempts. Try again later.');
                    break;
                default:
                    this.showError('login-password', 'Login failed. Please try again.');
            }
        }
    }

    async handleSignup() {
        this.clearErrors();
        
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        // Validation
        let isValid = true;
        
        if (!name) {
            this.showError('signup-name', 'Full name is required');
            isValid = false;
        }
        
        if (!email) {
            this.showError('signup-email', 'Email is required');
            isValid = false;
        } else if (!this.validateEmail(email)) {
            this.showError('signup-email', 'Please enter a valid email');
            isValid = false;
        }
        
        if (!password) {
            this.showError('signup-password', 'Password is required');
            isValid = false;
        } else if (password.length < 6) {
            this.showError('signup-password', 'Password must be at least 6 characters');
            isValid = false;
        }
        
        if (!confirmPassword) {
            this.showError('signup-confirm', 'Please confirm your password');
            isValid = false;
        } else if (password !== confirmPassword) {
            this.showError('signup-confirm', 'Passwords do not match');
            isValid = false;
        }
        
        if (!isValid) return;

        this.setLoading('signup', true);
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
        } catch (error) {
            this.setLoading('signup', false);
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    this.showError('signup-email', 'Email is already registered');
                    break;
                case 'auth/invalid-email':
                    this.showError('signup-email', 'Invalid email address');
                    break;
                case 'auth/weak-password':
                    this.showError('signup-password', 'Password is too weak');
                    break;
                default:
                    this.showError('signup-confirm', 'Registration failed. Please try again.');
            }
        }
    }

    async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }
}

// Initialize auth manager
export const authManager = new AuthManager();