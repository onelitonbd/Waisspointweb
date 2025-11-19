// Data Validation Utility for Firebase Operations
import { ErrorHandler } from './error-handler.js';

export class DataValidator {
    static validateStudySession(sessionData) {
        if (!ErrorHandler.validateData(sessionData, ['title'], 'Study session validation')) {
            return { valid: false, error: 'Missing required session data' };
        }

        // Validate messages if present
        if (sessionData.messages) {
            if (!ErrorHandler.validateArray(sessionData.messages, 'Session messages')) {
                return { valid: false, error: 'Invalid messages format' };
            }

            for (let i = 0; i < sessionData.messages.length; i++) {
                const message = sessionData.messages[i];
                if (!ErrorHandler.validateData(message, ['sender', 'content'], `Message ${i}`)) {
                    return { valid: false, error: `Invalid message at index ${i}` };
                }
            }
        }

        // Validate session notes if present
        if (sessionData.sessionNotes) {
            if (!ErrorHandler.validateArray(sessionData.sessionNotes, 'Session notes')) {
                return { valid: false, error: 'Invalid session notes format' };
            }

            for (let i = 0; i < sessionData.sessionNotes.length; i++) {
                const note = sessionData.sessionNotes[i];
                if (!ErrorHandler.validateData(note, ['title', 'content'], `Note ${i}`)) {
                    return { valid: false, error: `Invalid note at index ${i}` };
                }
            }
        }

        return { valid: true };
    }

    static validateExam(examData) {
        if (!ErrorHandler.validateData(examData, ['title', 'questions'], 'Exam validation')) {
            return { valid: false, error: 'Missing required exam data' };
        }

        if (!ErrorHandler.validateArray(examData.questions, 'Exam questions')) {
            return { valid: false, error: 'Invalid questions format' };
        }

        if (examData.questions.length === 0) {
            return { valid: false, error: 'Exam must have at least one question' };
        }

        for (let i = 0; i < examData.questions.length; i++) {
            const question = examData.questions[i];
            
            if (!ErrorHandler.validateData(question, ['type', 'question'], `Question ${i}`)) {
                return { valid: false, error: `Invalid question at index ${i}` };
            }

            // Validate question types
            const validTypes = ['mcq', 'short', 'long'];
            if (!validTypes.includes(question.type)) {
                return { valid: false, error: `Invalid question type at index ${i}: ${question.type}` };
            }

            // Validate MCQ specific fields
            if (question.type === 'mcq') {
                if (!ErrorHandler.validateArray(question.options, `Question ${i} options`)) {
                    return { valid: false, error: `Invalid options for MCQ at index ${i}` };
                }

                if (question.options.length < 2) {
                    return { valid: false, error: `MCQ at index ${i} must have at least 2 options` };
                }

                if (typeof question.correct !== 'number' || question.correct < 0 || question.correct >= question.options.length) {
                    return { valid: false, error: `Invalid correct answer index for MCQ at index ${i}` };
                }
            }
        }

        return { valid: true };
    }

    static validateNote(noteData) {
        if (!ErrorHandler.validateData(noteData, ['title', 'content'], 'Note validation')) {
            return { valid: false, error: 'Missing required note data' };
        }

        if (!ErrorHandler.validateString(noteData.title, 1, 'Note title')) {
            return { valid: false, error: 'Note title must be a non-empty string' };
        }

        if (!ErrorHandler.validateString(noteData.content, 1, 'Note content')) {
            return { valid: false, error: 'Note content must be a non-empty string' };
        }

        return { valid: true };
    }

    static sanitizeSessionData(sessionData) {
        const sanitized = { ...sessionData };

        // Sanitize title
        if (sanitized.title) {
            sanitized.title = ErrorHandler.sanitizeInput(sanitized.title);
        }

        // Sanitize messages
        if (sanitized.messages && Array.isArray(sanitized.messages)) {
            sanitized.messages = sanitized.messages
                .filter(msg => msg && msg.sender && msg.content)
                .map(msg => ({
                    ...msg,
                    content: ErrorHandler.sanitizeInput(msg.content),
                    sender: ErrorHandler.sanitizeInput(msg.sender)
                }));
        }

        // Sanitize session notes
        if (sanitized.sessionNotes && Array.isArray(sanitized.sessionNotes)) {
            sanitized.sessionNotes = sanitized.sessionNotes
                .filter(note => note && note.title && note.content)
                .map(note => ({
                    ...note,
                    title: ErrorHandler.sanitizeInput(note.title),
                    content: ErrorHandler.sanitizeInput(note.content)
                }));
        }

        return sanitized;
    }

    static sanitizeExamData(examData) {
        const sanitized = { ...examData };

        // Sanitize title
        if (sanitized.title) {
            sanitized.title = ErrorHandler.sanitizeInput(sanitized.title);
        }

        // Sanitize questions
        if (sanitized.questions && Array.isArray(sanitized.questions)) {
            sanitized.questions = sanitized.questions
                .filter(q => q && q.type && q.question)
                .map(question => {
                    const sanitizedQuestion = {
                        ...question,
                        question: ErrorHandler.sanitizeInput(question.question)
                    };

                    // Sanitize MCQ options
                    if (question.type === 'mcq' && question.options && Array.isArray(question.options)) {
                        sanitizedQuestion.options = question.options.map(option => 
                            ErrorHandler.sanitizeInput(option)
                        );
                    }

                    return sanitizedQuestion;
                });
        }

        return sanitized;
    }

    static sanitizeNoteData(noteData) {
        return {
            ...noteData,
            title: ErrorHandler.sanitizeInput(noteData.title),
            content: ErrorHandler.sanitizeInput(noteData.content)
        };
    }

    static prepareForFirestore(data, type) {
        let sanitized;
        let validation;

        switch (type) {
            case 'session':
                sanitized = this.sanitizeSessionData(data);
                validation = this.validateStudySession(sanitized);
                break;
            case 'exam':
                sanitized = this.sanitizeExamData(data);
                validation = this.validateExam(sanitized);
                break;
            case 'note':
                sanitized = this.sanitizeNoteData(data);
                validation = this.validateNote(sanitized);
                break;
            default:
                return { valid: false, error: 'Unknown data type' };
        }

        if (!validation.valid) {
            return validation;
        }

        return { valid: true, data: sanitized };
    }

    static validateFirestoreResponse(response, expectedFields = []) {
        if (!response) {
            return { valid: false, error: 'No response received' };
        }

        if (typeof response.exists === 'function' && !response.exists()) {
            return { valid: false, error: 'Document does not exist' };
        }

        const data = typeof response.data === 'function' ? response.data() : response;
        
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Invalid response data' };
        }

        for (const field of expectedFields) {
            if (!(field in data)) {
                return { valid: false, error: `Missing expected field: ${field}` };
            }
        }

        return { valid: true, data };
    }

    static createSafeFirestoreData(data, type) {
        const prepared = this.prepareForFirestore(data, type);
        
        if (!prepared.valid) {
            throw new Error(prepared.error);
        }

        // Remove any undefined values that could cause Firestore errors
        const cleanData = this.removeUndefinedValues(prepared.data);
        
        return cleanData;
    }

    static removeUndefinedValues(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.removeUndefinedValues(item)).filter(item => item !== undefined);
        }

        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = this.removeUndefinedValues(value);
            }
        }

        return cleaned;
    }
}