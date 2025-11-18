// Gemini3 Exam AI Module
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    updateDoc,
    doc,
    getDocs,
    query,
    where,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class Gemini3Exam {
    constructor() {
        this.personality = this.getExamPersonality();
        this.currentExam = null;
        this.correctAnswers = {};
    }

    getExamPersonality() {
        return {
            systemPrompt: `You are Gemini3, a strict exam conductor. Your ONLY job is to create and evaluate exams.

RULES:
- NO teaching, NO explanations, NO conversations
- ONLY generate structured exams from provided notes
- Serious, professional tone
- Questions MUST be based 100% on the notes content
- Follow exact exam format template
- Store correct answers internally
- Evaluate submissions objectively

EXAM STRUCTURE:
1. MCQ Section (5 questions, 4 options each)
2. Short Questions (3 questions)
3. Long Questions (2 questions)

BEHAVIOR:
- Strict examiner personality
- No hints or help during exam
- Objective evaluation only
- Clear scoring criteria`,

            examTemplate: {
                sections: ['MCQ', 'Short Questions', 'Long Questions'],
                mcqCount: 5,
                shortCount: 3,
                longCount: 2
            }
        };
    }

    async generateExamFromNotes(topic = null) {
        try {
            // Get user's notes
            const notesContent = await this.fetchUserNotes(topic);
            
            if (!notesContent) {
                throw new Error('No notes found for exam generation');
            }

            // Generate exam questions
            const examData = await this.createExamQuestions(notesContent, topic);
            
            // Save exam to Firebase
            const examId = await this.saveExamToFirebase(examData);
            
            return {
                success: true,
                examId: examId,
                examData: examData
            };
            
        } catch (error) {
            console.error('Gemini3 Exam Generation Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async fetchUserNotes(topic = null) {
        if (!auth.currentUser) return null;

        try {
            const userId = auth.currentUser.uid;
            const notesQuery = topic 
                ? query(collection(db, 'users', userId, 'notes'), where('topic', '==', topic))
                : query(collection(db, 'users', userId, 'notes'));
            
            const notesSnapshot = await getDocs(notesQuery);
            
            if (notesSnapshot.empty) return null;

            // Combine all notes content
            return notesSnapshot.docs
                .map(doc => doc.data().content)
                .join('\n\n');
                
        } catch (error) {
            console.error('Error fetching notes:', error);
            return null;
        }
    }

    async createExamQuestions(notesContent, topic) {
        try {
            const prompt = this.buildExamPrompt(notesContent, topic);
            const { geminiAPI } = await import('./gemini-api.js');
            const examData = await geminiAPI.generateExam(prompt);
            
            // Store correct answers internally
            this.storeCorrectAnswers(examData);
            
            return examData;
        } catch (error) {
            console.error('Error creating exam questions:', error);
            return this.getFallbackExam(topic);
        }
    }

    buildExamPrompt(notesContent, topic) {
        return `${this.personality.systemPrompt}

NOTES CONTENT TO CREATE EXAM FROM:
${notesContent}

TOPIC: ${topic || 'Study Material'}

Generate a structured exam following the exact format:
- 5 MCQ questions with 4 options each
- 3 Short answer questions
- 2 Long answer questions

Questions MUST be based ONLY on the provided notes content. Return as JSON format with:
{
  "title": "${topic || 'Study Material'} - Exam",
  "questions": [
    {
      "type": "mcq",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "difficulty": "easy"
    },
    {
      "type": "short",
      "question": "...",
      "difficulty": "medium"
    },
    {
      "type": "long", 
      "question": "...",
      "difficulty": "hard"
    }
  ]
}`;
    }

    storeCorrectAnswers(examData) {
        this.correctAnswers = {};
        
        examData.questions.forEach((question, index) => {
            if (question.type === 'mcq') {
                this.correctAnswers[index] = question.correct;
            }
            // For short/long questions, store expected key points
            else {
                this.correctAnswers[index] = this.extractKeyPoints(question.question);
            }
        });
    }

    extractKeyPoints(question) {
        // Simple key point extraction for evaluation
        const keywords = question.toLowerCase().match(/\b\w{4,}\b/g) || [];
        return keywords.slice(0, 5); // Top 5 keywords for evaluation
    }

    getFallbackExam(topic) {
        return {
            title: `${topic || 'Study Material'} - Exam`,
            questions: [
                {
                    type: 'mcq',
                    question: 'Which of the following is a key concept from the study material?',
                    options: [
                        'Fundamental principle A',
                        'Basic concept B', 
                        'Important theory C',
                        'All of the above'
                    ],
                    correct: 3,
                    difficulty: 'easy'
                },
                {
                    type: 'mcq',
                    question: 'What is the main application of the concepts studied?',
                    options: [
                        'Theoretical understanding',
                        'Practical implementation',
                        'Academic research',
                        'All applications'
                    ],
                    correct: 1,
                    difficulty: 'medium'
                },
                {
                    type: 'short',
                    question: 'Explain the main concept discussed in the study material.',
                    difficulty: 'medium'
                },
                {
                    type: 'short',
                    question: 'List three important points from the topic.',
                    difficulty: 'easy'
                },
                {
                    type: 'long',
                    question: 'Provide a comprehensive explanation of the topic with examples.',
                    difficulty: 'hard'
                }
            ]
        };
    }

    async saveExamToFirebase(examData) {
        if (!auth.currentUser) {
            throw new Error('User not authenticated');
        }

        try {
            const userId = auth.currentUser.uid;
            const exam = {
                title: examData.title,
                questions: examData.questions,
                createdAt: serverTimestamp(),
                completed: false,
                score: null,
                totalQuestions: examData.questions.length,
                correctAnswers: this.correctAnswers
            };

            const docRef = await addDoc(
                collection(db, 'users', userId, 'exams'), 
                exam
            );
            
            return docRef.id;
        } catch (error) {
            console.error('Error saving exam to Firebase:', error);
            throw error;
        }
    }

    async evaluateExam(examId, userAnswers) {
        try {
            let score = 0;
            const totalQuestions = Object.keys(this.correctAnswers).length;
            const evaluation = {};

            // Evaluate each answer
            Object.keys(userAnswers).forEach(questionIndex => {
                const userAnswer = userAnswers[questionIndex];
                const correctAnswer = this.correctAnswers[questionIndex];
                
                if (Array.isArray(correctAnswer)) {
                    // Short/Long answer evaluation
                    const isCorrect = this.evaluateTextAnswer(userAnswer, correctAnswer);
                    evaluation[questionIndex] = isCorrect;
                    if (isCorrect) score++;
                } else {
                    // MCQ evaluation
                    const isCorrect = userAnswer === correctAnswer;
                    evaluation[questionIndex] = isCorrect;
                    if (isCorrect) score++;
                }
            });

            // Calculate percentage and grade
            const percentage = Math.round((score / totalQuestions) * 100);
            const grade = this.calculateGrade(percentage);

            // Update exam in Firebase
            await this.updateExamResults(examId, {
                completed: true,
                score: score,
                totalQuestions: totalQuestions,
                percentage: percentage,
                grade: grade,
                userAnswers: userAnswers,
                evaluation: evaluation,
                completedAt: serverTimestamp()
            });

            return {
                success: true,
                score: score,
                totalQuestions: totalQuestions,
                percentage: percentage,
                grade: grade,
                evaluation: evaluation
            };

        } catch (error) {
            console.error('Error evaluating exam:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    evaluateTextAnswer(userAnswer, keywords) {
        if (!userAnswer || userAnswer.trim().length < 10) return false;
        
        const userText = userAnswer.toLowerCase();
        const matchedKeywords = keywords.filter(keyword => 
            userText.includes(keyword.toLowerCase())
        );
        
        // Consider correct if at least 40% of keywords are present
        return matchedKeywords.length >= Math.ceil(keywords.length * 0.4);
    }

    calculateGrade(percentage) {
        if (percentage >= 90) return 'A+';
        if (percentage >= 80) return 'A';
        if (percentage >= 70) return 'B';
        if (percentage >= 60) return 'C';
        if (percentage >= 50) return 'D';
        return 'F';
    }

    async updateExamResults(examId, results) {
        if (!auth.currentUser) return;

        try {
            const userId = auth.currentUser.uid;
            const examRef = doc(db, 'users', userId, 'exams', examId);
            await updateDoc(examRef, results);
        } catch (error) {
            console.error('Error updating exam results:', error);
            throw error;
        }
    }

    getExamFeedback(percentage) {
        if (percentage >= 90) return 'Excellent performance! You have mastered this material.';
        if (percentage >= 80) return 'Great job! You have a strong understanding of the concepts.';
        if (percentage >= 70) return 'Good work! Review the areas where you lost points.';
        if (percentage >= 60) return 'Fair performance. More study is recommended for better understanding.';
        return 'Keep studying! Review your notes thoroughly and try again.';
    }
}