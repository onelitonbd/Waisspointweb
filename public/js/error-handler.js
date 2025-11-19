// Centralized Error Handling Utility
export class ErrorHandler {
    static logError(context, error, additionalInfo = {}) {
        console.error(`[${context}] Error:`, error);
        if (Object.keys(additionalInfo).length > 0) {
            console.error(`[${context}] Additional info:`, additionalInfo);
        }
    }

    static handleFirebaseError(error, context = 'Firebase') {
        let userMessage = 'An unexpected error occurred. Please try again.';
        
        switch (error.code) {
            case 'permission-denied':
                userMessage = 'You do not have permission to perform this action.';
                break;
            case 'not-found':
                userMessage = 'The requested data was not found.';
                break;
            case 'unavailable':
                userMessage = 'Service is temporarily unavailable. Please try again later.';
                break;
            case 'unauthenticated':
                userMessage = 'Please log in to continue.';
                break;
            case 'failed-precondition':
                userMessage = 'Operation failed due to invalid conditions.';
                break;
            case 'resource-exhausted':
                userMessage = 'Too many requests. Please wait a moment and try again.';
                break;
            case 'cancelled':
                userMessage = 'Operation was cancelled.';
                break;
            case 'data-loss':
                userMessage = 'Data corruption detected. Please refresh and try again.';
                break;
            default:
                if (error.message) {
                    userMessage = error.message;
                }
        }
        
        this.logError(context, error);
        return userMessage;
    }

    static validateData(data, requiredFields = [], context = 'Data validation') {
        if (!data || typeof data !== 'object') {
            this.logError(context, new Error('Invalid data type'), { data, requiredFields });
            return false;
        }

        for (const field of requiredFields) {
            if (!(field in data) || data[field] === null || data[field] === undefined) {
                this.logError(context, new Error(`Missing required field: ${field}`), { data, requiredFields });
                return false;
            }
        }

        return true;
    }

    static validateArray(arr, context = 'Array validation') {
        if (!Array.isArray(arr)) {
            this.logError(context, new Error('Expected array but got ' + typeof arr), { arr });
            return false;
        }
        return true;
    }

    static validateString(str, minLength = 0, context = 'String validation') {
        if (typeof str !== 'string') {
            this.logError(context, new Error('Expected string but got ' + typeof str), { str });
            return false;
        }
        
        if (str.length < minLength) {
            this.logError(context, new Error(`String too short. Expected at least ${minLength} characters`), { str, minLength });
            return false;
        }
        
        return true;
    }

    static showUserError(message, container = null) {
        if (!container) {
            container = document.getElementById('chat-messages');
        }
        
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message ai-message';
            errorDiv.innerHTML = `
                <div class="message-bubble" style="background: #fed7d7; border: 1px solid #e53e3e; color: #c53030;">
                    <div class="message-content">
                        <i data-lucide="alert-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>
                        ${message}
                    </div>
                </div>
            `;
            
            container.appendChild(errorDiv);
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            
            container.scrollTop = container.scrollHeight;
        } else {
            // Fallback to alert if no container
            alert(message);
        }
    }

    static async withErrorHandling(asyncFunction, context = 'Operation', showUserError = true) {
        try {
            return await asyncFunction();
        } catch (error) {
            const userMessage = this.handleFirebaseError(error, context);
            
            if (showUserError) {
                this.showUserError(userMessage);
            }
            
            return { success: false, error: userMessage };
        }
    }

    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }
        
        // Basic XSS prevention
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    static validateSessionData(sessionData) {
        if (!this.validateData(sessionData, ['title'], 'Session validation')) {
            return false;
        }

        if (sessionData.messages && !this.validateArray(sessionData.messages, 'Session messages validation')) {
            return false;
        }

        if (sessionData.messages) {
            for (let i = 0; i < sessionData.messages.length; i++) {
                const message = sessionData.messages[i];
                if (!this.validateData(message, ['sender', 'content'], `Message ${i} validation`)) {
                    return false;
                }
            }
        }

        return true;
    }

    static validateExamData(examData) {
        if (!this.validateData(examData, ['title', 'questions'], 'Exam validation')) {
            return false;
        }

        if (!this.validateArray(examData.questions, 'Exam questions validation')) {
            return false;
        }

        for (let i = 0; i < examData.questions.length; i++) {
            const question = examData.questions[i];
            if (!this.validateData(question, ['type', 'question'], `Question ${i} validation`)) {
                return false;
            }

            if (question.type === 'mcq' && !this.validateArray(question.options, `Question ${i} options validation`)) {
                return false;
            }
        }

        return true;
    }

    static validateNotesData(notesData) {
        if (!this.validateData(notesData, ['title', 'content'], 'Notes validation')) {
            return false;
        }

        if (!this.validateString(notesData.title, 1, 'Notes title validation')) {
            return false;
        }

        if (!this.validateString(notesData.content, 1, 'Notes content validation')) {
            return false;
        }

        return true;
    }
}