// Gemini1 Teacher AI Personality Module
export class Gemini1Teacher {
    constructor() {
        this.personality = this.getTeacherPersonality();
        this.conversationHistory = [];
    }

    getTeacherPersonality() {
        return {
            systemPrompt: `You are an enthusiastic, friendly teacher who loves helping students learn. Your personality:

TEACHING STYLE:
- Explain concepts step-by-step with clear structure
- Use analogies and real-world examples
- Break down complex topics into simple parts
- Ask follow-up questions to check understanding
- Encourage and motivate students
- Adjust difficulty based on student responses

PERSONALITY TRAITS:
- Warm, encouraging, and patient
- Never robotic - always human-like
- Celebrates student progress
- Gently corrects mistakes
- Makes learning fun and interactive
- Uses emojis occasionally for friendliness

RESPONSE FORMAT:
- Start with acknowledgment of the question
- Provide structured explanations
- Include examples when helpful
- End with encouragement or follow-up question
- Never give one-word or overly short answers

SPECIAL COMMANDS:
- If student says "make notes" or "generate notes" → respond with "I'll create notes for you!" and trigger note generation
- If student says "make exam" or "create test" → respond with "Let me create an exam for you!" and trigger exam generation

Remember: You're not an AI assistant - you're a dedicated teacher who cares about student success!`,

            behaviorRules: [
                'Always teach step-by-step',
                'Use encouraging language',
                'Provide examples and analogies',
                'Check for understanding',
                'Make learning interactive',
                'Never respond like a robot'
            ]
        };
    }

    async processMessage(message) {
        // Check for special commands
        const lowerMessage = message.toLowerCase();
        
        if (this.isNotesRequest(lowerMessage)) {
            return {
                response: "I'll create comprehensive notes from our discussion for you! 📝",
                action: 'generate_notes',
                content: this.getConversationContent()
            };
        }

        if (this.isExamRequest(lowerMessage)) {
            return {
                response: "Let me create an exam to test your understanding! 📋",
                action: 'generate_exam',
                content: this.getConversationContent()
            };
        }

        // Regular teaching response
        const teacherPrompt = this.buildTeacherPrompt(message);
        return {
            response: await this.getTeacherResponse(teacherPrompt),
            action: 'chat',
            content: null
        };
    }

    isNotesRequest(message) {
        const notesKeywords = ['make notes', 'generate notes', 'create notes', 'save notes', 'notes please'];
        return notesKeywords.some(keyword => message.includes(keyword));
    }

    isExamRequest(message) {
        const examKeywords = ['make exam', 'create exam', 'generate exam', 'make test', 'create test', 'quiz me'];
        return examKeywords.some(keyword => message.includes(keyword));
    }

    buildTeacherPrompt(message) {
        const context = this.conversationHistory.length > 0 
            ? `Previous conversation context: ${this.getRecentContext()}\n\n`
            : '';
        
        return `${this.personality.systemPrompt}

${context}Student's question: "${message}"

Respond as a caring teacher who wants to help the student understand this topic thoroughly.`;
    }

    getRecentContext() {
        return this.conversationHistory
            .slice(-4)
            .map(msg => `${msg.sender}: ${msg.content}`)
            .join('\n');
    }

    getConversationContent() {
        return this.conversationHistory
            .map(msg => `${msg.sender}: ${msg.content}`)
            .join('\n');
    }

    async getTeacherResponse(prompt) {
        try {
            const { geminiAPI } = await import('./gemini-api.js');
            return await geminiAPI.generateTeacherResponse(prompt);
        } catch (error) {
            console.error('Error getting teacher response:', error);
            return this.getFallbackTeacherResponse();
        }
    }

    getFallbackTeacherResponse() {
        const responses = [
            "Great question! Let me break this down for you step by step. This is an important concept that will help you understand the bigger picture. 🎯",
            "I love that you're asking about this! This topic is really fascinating once you understand the fundamentals. Let me explain it in a way that makes sense. ✨",
            "Excellent! This is exactly the kind of question that shows you're thinking deeply. Let me walk you through this concept carefully. 📚",
            "That's a wonderful question to explore! Understanding this will really strengthen your knowledge. Let me guide you through it. 🌟"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    addToHistory(sender, content) {
        this.conversationHistory.push({
            sender,
            content,
            timestamp: new Date()
        });

        // Keep only last 10 messages for context
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }
    }

    clearHistory() {
        this.conversationHistory = [];
    }
}