// Exams functionality with Gemini3 AI integration
import { auth, db } from './firebase-config.js';
import { markdownRenderer } from './markdown-renderer.js';
import { ErrorHandler } from './error-handler.js';
import { DataValidator } from './data-validator.js';
import { 
    collection, 
    addDoc, 
    updateDoc,
    doc,
    query, 
    where, 
    orderBy, 
    onSnapshot,
    getDocs,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class ExamsManager {
    constructor() {
        this.currentExam = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
        this.difficulty = 'medium';
    }

    async generateExamFromNotes() {
        if (!auth.currentUser) {
            throw new Error('User not authenticated');
        }

        try {
            // Get user's study sessions with notes
            const userId = auth.currentUser.uid;
            const sessionsQuery = query(
                collection(db, 'users', userId, 'study_sessions'),
                orderBy('createdAt', 'desc')
            );
            
            const sessionsSnapshot = await getDocs(sessionsQuery);
            
            // Filter sessions that have notes
            const sessionsWithNotes = sessionsSnapshot.docs
                .map(doc => doc.data())
                .filter(session => session.sessionNotes && Array.isArray(session.sessionNotes) && session.sessionNotes.length > 0);
            
            if (sessionsWithNotes.length === 0) {
                throw new Error('No notes available for exam generation. Please create some study sessions with notes first.');
            }

            // Combine notes content from all sessions
            const notesContent = sessionsWithNotes
                .flatMap(session => session.sessionNotes)
                .map(note => note.content)
                .join('\n\n');

            if (!notesContent.trim()) {
                throw new Error('No valid notes content found');
            }

            // Generate exam using Gemini3
            const examData = await this.generateExamQuestions(notesContent);
            
            // Save exam to Firebase
            const examId = await this.saveExam(examData);
            
            if (examId) {
                return { success: true, examId, examData };
            } else {
                throw new Error('Failed to save exam');
            }
            
        } catch (error) {
            console.error('Error generating exam:', error);
            return { success: false, error: error.message };
        }
    }

    async generateExamQuestions(notesContent) {
        try {
            const { geminiAPI } = await import('./gemini-api.js');
            const examData = await geminiAPI.generateExam(notesContent);
            return examData;
        } catch (error) {
            console.error('Error generating questions with Gemini3:', error);
            return this.getSimulatedExam();
        }
    }

    getSimulatedExam() {
        return {
            title: `Study Exam - ${new Date().toLocaleDateString()}`,
            questions: [
                {
                    type: 'mcq',
                    question: 'What is the main purpose of taking structured notes during study sessions?',
                    options: [
                        'To pass time during boring lectures',
                        'To organize and retain key information for better learning',
                        'To impress teachers with neat handwriting',
                        'To avoid paying attention to the speaker'
                    ],
                    correct: 1,
                    difficulty: 'easy'
                },
                {
                    type: 'short',
                    question: 'Explain the importance of reviewing notes regularly after a study session.',
                    difficulty: 'medium'
                },
                {
                    type: 'long',
                    question: 'Describe a comprehensive study strategy that incorporates note-taking, regular review, and active recall techniques. Explain how each component contributes to effective learning.',
                    difficulty: 'hard'
                }
            ]
        };
    }

    async saveExam(examData) {
        if (!auth.currentUser || !examData || !examData.questions || !Array.isArray(examData.questions)) {
            console.error('Invalid exam data or user not authenticated');
            return null;
        }

        try {
            const userId = auth.currentUser.uid;
            
            const rawExamData = {
                title: examData.title || `Exam - ${new Date().toLocaleDateString()}`,
                questions: examData.questions,
                completed: false,
                score: null,
                totalQuestions: examData.questions.length
            };

            // Validate and sanitize exam data
            const safeExamData = DataValidator.createSafeFirestoreData(rawExamData, 'exam');
            safeExamData.createdAt = serverTimestamp();

            const examRef = await addDoc(collection(db, 'users', userId, 'exams'), safeExamData);
            return examRef.id;
        } catch (error) {
            ErrorHandler.handleFirebaseError(error, 'Save exam');
            return null;
        }
    }

    displayExam(examData, examId) {
        // Validate exam data
        if (!ErrorHandler.validateExamData(examData)) {
            this.showExamError('Invalid exam data. Please try generating a new exam.');
            return;
        }

        if (!examId) {
            ErrorHandler.logError('Exams', new Error('Missing exam ID'));
            this.showExamError('Invalid exam ID. Please try again.');
            return;
        }

        this.currentExam = { ...examData, id: examId };
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;

        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            ErrorHandler.logError('Exams', new Error('Messages container not found'));
            return;
        }
        
        messagesContainer.innerHTML = '';

        // Add exam header
        this.addExamHeader(examData);

        if (examData.completed) {
            this.displayExamResults(examData);
        } else {
            this.displayCurrentQuestion();
        }
    }

    addExamHeader(examData) {
        const messagesContainer = document.getElementById('chat-messages');
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message ai-message';
        headerDiv.innerHTML = `
            <div class="message-bubble exam-header">
                <div class="message-content">
                    <h3><i data-lucide="clipboard-list" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>${examData.title}</h3>
                    <div class="exam-info">
                        <span>Questions: ${examData.totalQuestions || examData.questions?.length || 0}</span>
                        ${examData.completed ? `<span>Score: ${examData.score}/${examData.totalQuestions}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(headerDiv);
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    displayCurrentQuestion() {
        if (!this.currentExam || !this.currentExam.questions || this.currentQuestionIndex >= this.currentExam.questions.length) {
            this.completeExam();
            return;
        }

        const question = this.currentExam.questions[this.currentQuestionIndex];
        const messagesContainer = document.getElementById('chat-messages');

        const questionDiv = document.createElement('div');
        questionDiv.className = 'message ai-message';
        questionDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-content">
                    <div class="question-header">
                        <span class="question-number">Question ${this.currentQuestionIndex + 1}/${this.currentExam.questions.length}</span>
                        <span class="question-type">${question.type.toUpperCase()}</span>
                    </div>
                    <div class="question-text markdown-question"></div>
                    ${this.renderQuestionInput(question)}
                </div>
            </div>
        `;
        messagesContainer.appendChild(questionDiv);
        
        // Render markdown for question text
        const questionTextDiv = questionDiv.querySelector('.markdown-question');
        markdownRenderer.renderToElement(questionTextDiv, question.question);
        
        // Render markdown for MCQ options
        const optionElements = questionDiv.querySelectorAll('.markdown-option');
        if (question.options && optionElements.length > 0) {
            question.options.forEach((option, index) => {
                if (optionElements[index]) {
                    markdownRenderer.renderToElement(optionElements[index], option);
                }
            });
        }
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Add submit button
        this.addSubmitButton();
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    renderQuestionInput(question) {
        switch (question.type) {
            case 'mcq':
                return `
                    <div class="mcq-options">
                        ${question.options.map((option, index) => `
                            <label class="mcq-option">
                                <input type="radio" name="mcq-answer" value="${index}">
                                <span class="option-text markdown-option"></span>
                            </label>
                        `).join('')}
                    </div>
                `;
            case 'short':
                return `
                    <textarea class="short-answer" placeholder="Enter your answer (1-3 lines)..." rows="3"></textarea>
                `;
            case 'long':
                return `
                    <textarea class="long-answer" placeholder="Enter your detailed answer..." rows="6"></textarea>
                `;
            default:
                return '';
        }
    }

    addSubmitButton() {
        const messagesContainer = document.getElementById('chat-messages');
        
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'message user-message';
        buttonDiv.innerHTML = `
            <div class="message-bubble">
                <button class="exam-submit-btn" onclick="window.examsManager.submitAnswer()">
                    Submit Answer
                </button>
            </div>
        `;
        messagesContainer.appendChild(buttonDiv);
    }

    submitAnswer() {
        const question = this.currentExam.questions[this.currentQuestionIndex];
        let answer = null;
        let isCorrect = false;

        switch (question.type) {
            case 'mcq':
                const selectedOption = document.querySelector('input[name="mcq-answer"]:checked');
                if (selectedOption) {
                    answer = parseInt(selectedOption.value);
                    isCorrect = answer === question.correct;
                }
                break;
            case 'short':
                answer = document.querySelector('.short-answer').value.trim();
                isCorrect = answer.length > 0; // Basic validation
                break;
            case 'long':
                answer = document.querySelector('.long-answer').value.trim();
                isCorrect = answer.length > 50; // Basic validation
                break;
        }

        if (answer === null || answer === '') {
            alert('Please provide an answer before submitting.');
            return;
        }

        // Store answer
        this.userAnswers.push({ answer, isCorrect, question: question.question });
        
        if (isCorrect) {
            this.score++;
        }

        // Show feedback
        this.showAnswerFeedback(isCorrect, question);

        // Move to next question
        this.currentQuestionIndex++;
        
        setTimeout(() => {
            this.displayCurrentQuestion();
        }, 2000);
    }

    showAnswerFeedback(isCorrect, question) {
        const messagesContainer = document.getElementById('chat-messages');
        
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'message ai-message';
        feedbackDiv.innerHTML = `
            <div class="message-bubble ${isCorrect ? 'correct-answer' : 'incorrect-answer'}">
                <div class="message-content">
                    ${isCorrect ? '<i data-lucide="check-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Correct!' : '<i data-lucide="x-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>Incorrect'}
                    ${question.type === 'mcq' && !isCorrect ? 
                        `<br>Correct answer: ${question.options[question.correct]}` : ''}
                </div>
            </div>
        `;
        messagesContainer.appendChild(feedbackDiv);
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async completeExam() {
        if (!this.currentExam || !auth.currentUser) {
            console.error('No current exam or user not authenticated');
            return;
        }

        // Update exam in Firebase
        try {
            const userId = auth.currentUser.uid;
            const examRef = doc(db, 'users', userId, 'exams', this.currentExam.id);
            
            await updateDoc(examRef, {
                completed: true,
                score: this.score || 0,
                userAnswers: this.userAnswers || [],
                completedAt: serverTimestamp()
            });

            this.displayExamResults({
                ...this.currentExam,
                completed: true,
                score: this.score || 0,
                totalQuestions: this.currentExam.questions?.length || 0
            });

        } catch (error) {
            console.error('Error completing exam:', error);
            this.showExamError('Failed to save exam results. Please try again.');
        }
    }

    displayExamResults(examData) {
        const messagesContainer = document.getElementById('chat-messages');
        
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'message ai-message';
        
        const percentage = Math.round((examData.score / examData.totalQuestions) * 100);
        const grade = this.getGrade(percentage);
        
        resultsDiv.innerHTML = `
            <div class="message-bubble exam-results">
                <div class="message-content">
                    <h3><i data-lucide="trophy" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>Exam Completed!</h3>
                    <div class="results-summary">
                        <div class="score-display">
                            <span class="score">${examData.score}/${examData.totalQuestions}</span>
                            <span class="percentage">${percentage}%</span>
                        </div>
                        <div class="grade ${grade.toLowerCase()}">${grade}</div>
                    </div>
                    <div class="results-message">
                        ${this.getResultsMessage(percentage)}
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(resultsDiv);
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    getGrade(percentage) {
        if (percentage >= 90) return 'A+';
        if (percentage >= 80) return 'A';
        if (percentage >= 70) return 'B';
        if (percentage >= 60) return 'C';
        if (percentage >= 50) return 'D';
        return 'F';
    }

    getResultsMessage(percentage) {
        if (percentage >= 90) return 'Excellent work! You have mastered this material.';
        if (percentage >= 80) return 'Great job! You have a strong understanding.';
        if (percentage >= 70) return 'Good work! Review the areas you missed.';
        if (percentage >= 60) return 'Fair performance. More study is recommended.';
        return 'Keep studying! Review your notes and try again.';
    }

    showExamError(message) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="message ai-message">
                <div class="message-bubble">
                    <div class="message-content">
                        <i data-lucide="alert-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>
                        ${message}
                    </div>
                </div>
            </div>
        `;
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}