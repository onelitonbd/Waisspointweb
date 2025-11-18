// Gemini API Integration
// Note: Replace 'YOUR_GEMINI_API_KEY' with your actual API key

const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export class GeminiAPI {
    constructor() {
        this.apiKey = GEMINI_API_KEY;
    }

    async generateResponse(message) {
        if (this.apiKey === 'YOUR_GEMINI_API_KEY') {
            // Return simulated response if API key is not set
            return this.getSimulatedResponse(message);
        }

        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
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