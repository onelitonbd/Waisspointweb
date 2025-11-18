// Gemini API Integration
// Note: Replace 'YOUR_GEMINI_API_KEY' with your actual API key

const GEMINI_API_KEYS = {
    gemini1: 'AIzaSyDvebS7E3P_nwZ9pNAhhQEdiy1XS9CKJc0',
    gemini2: 'AIzaSyCljak_hsmaVgiCk-klGuc98pCJBSsV2gY',
    gemini3: 'AIzaSyBDgVYYVDOAn_eG2t0QNsVXTweO7UlbkSQ'
};
const MODEL_NAME = 'gemini-2.5-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

export class GeminiAPI {
    constructor() {
        this.apiKeys = GEMINI_API_KEYS;
    }

    async generateResponse(message) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKeys.gemini1}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a helpful AI study assistant. Help the student with their question: ${message}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Gemini API error:', error);
            return this.getSimulatedResponse(message);
        }
    }

    async generateNotes(conversationText, sessionTitle) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKeys.gemini2}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Generate structured study notes from this conversation. Format as markdown with sections for Key Points, Summary, Action Items, and Additional Resources. Conversation: ${conversationText}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topK: 20,
                        topP: 0.8,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Gemini2 API error:', error);
            return this.getSimulatedNotes(sessionTitle);
        }
    }

    async generateExam(prompt) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKeys.gemini3}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topK: 20,
                        topP: 0.8,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const examText = data.candidates[0].content.parts[0].text;
                try {
                    return JSON.parse(examText);
                } catch (parseError) {
                    console.error('JSON parse error:', parseError);
                    return this.getSimulatedExam();
                }
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Gemini3 API error:', error);
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
                    question: 'Describe a comprehensive study strategy that incorporates note-taking, regular review, and active recall techniques.',
                    difficulty: 'hard'
                }
            ]
        };
    }

    getSimulatedNotes(sessionTitle) {
        return `# ${sessionTitle} - Notes

## Key Points
• Main concepts discussed in the study session
• Important definitions and explanations provided
• Critical information highlighted for retention
• Practical examples and applications covered

## Summary
This study session provided comprehensive coverage of ${sessionTitle.toLowerCase()}. The discussion included detailed explanations, practical examples, and interactive Q&A to reinforce understanding of the core concepts.

## Action Items
• Review the main concepts discussed
• Practice with the examples provided
• Complete any suggested exercises
• Prepare questions for the next session
• Research additional resources if needed

## Additional Resources
• Recommended reading materials
• Practice exercises and problems
• Related topics for further exploration
• Online resources and references

---
*Notes automatically generated by AI from study session*`;
    }

    async generateTeacherResponse(prompt) {
        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKeys.gemini1}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.8,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Gemini Teacher API error:', error);
            return this.getSimulatedTeacherResponse();
        }
    }

    getSimulatedTeacherResponse() {
        const responses = [
            "Great question! Let me break this down for you step by step. This is an important concept that will help you understand the bigger picture. 🎯",
            "I love that you're asking about this! This topic is really fascinating once you understand the fundamentals. Let me explain it in a way that makes sense. ✨",
            "Excellent! This is exactly the kind of question that shows you're thinking deeply. Let me walk you through this concept carefully. 📚",
            "That's a wonderful question to explore! Understanding this will really strengthen your knowledge. Let me guide you through it. 🌟"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    getSimulatedResponse(message) {
        const responses = [
            `That's a great question about "${message}". Let me help you understand this concept better. Here are the key points you should know...`,
            `I can help you with that! Regarding "${message}", here's what I recommend you focus on for your studies...`,
            `Excellent topic to explore! For "${message}", let's break this down into manageable study sections...`,
            `I understand you're asking about "${message}". This is an important concept. Let me explain it step by step...`,
            `Great question! "${message}" is definitely worth studying. Here's how I suggest you approach this topic...`,
            `Let me help you with "${message}". This is a fundamental concept that's important to master. Here's my explanation...`,
            `I see you're interested in "${message}". This is a valuable topic for your studies. Let me break it down for you...`
        ];

        return responses[Math.floor(Math.random() * responses.length)];
    }
}

export const geminiAPI = new GeminiAPI();