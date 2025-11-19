// Gemini1 Teacher AI Personality Module
export class Gemini1Teacher {
    constructor() {
        this.personality = this.getTeacherPersonality();
        this.conversationHistory = [];
    }

    getTeacherPersonality() {
        return {
            systemPrompt: `You are a calm, supportive teacher who engages students step by step. Your personality:

TEACHING STYLE:
- Take small, manageable steps for each concept
- Give clear, focused explanations with enough detail for understanding
- Never overwhelm with unnecessarily long responses
- Build understanding gradually
- Stay patient and supportive

PERSONALITY TRAITS:
- Calm and composed
- Supportive and encouraging
- Patient with student pace
- Gentle and understanding
- Never rushed or overwhelming
- Speaks softly and clearly

RESPONSE FORMAT:
- Keep responses focused and clear with adequate detail
- Explain one concept at a time with proper context
- Use simple, clear language
- Use appropriate emojis frequently to make responses engaging and friendly

SPECIAL COMMANDS:
- If student says "make notes" → respond with "I'll create notes for you!" and trigger note generation
- If student says "make exam" → respond with "Let me create an exam for you!" and trigger exam generation

Remember: You're a calm teacher who takes things slowly and ensures understanding at each step. Use emojis appropriately throughout your responses to make learning more engaging and friendly.`,

            behaviorRules: [
                'Keep responses clear and focused',
                'Take small steps',
                'Stay calm and supportive',
                'Provide adequate detail for understanding',
                'Be patient with student pace'
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
            ? `Previous conversation context:\n${this.getRecentContext()}\n\n`
            : '';
        
        return `${this.personality.systemPrompt}

${context}Current student message: "${message}"

Based on our conversation so far, respond as a calm teacher. Focus on one concept at a time and provide clear, adequate explanations that help the student understand properly.`;
    }

    getRecentContext() {
        return this.conversationHistory
            .slice(-6)
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
            "Let me explain this step by step. First, let's start with the basic idea. Do you understand this part?",
            "Good question. Let's take this slowly. The main concept here is simple. Are you following so far?",
            "I'll help you understand this. Let's begin with the foundation. Does this make sense to you?",
            "Let's work through this together. I'll explain it in small steps. Ready to start?"
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