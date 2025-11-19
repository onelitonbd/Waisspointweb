// Gemini2 Notes Generator AI Module
import { auth, db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class Gemini2Notes {
    constructor() {
        this.personality = this.getNotesPersonality();
    }

    getNotesPersonality() {
        return {
            systemPrompt: `You are Gemini2, a professional notes generator. Your ONLY job is to create structured notes from the provided conversation.

CRITICAL RULES:
- ONLY use information from the provided conversation
- DO NOT add external knowledge or information
- DO NOT include anything not discussed in the conversation
- Extract and organize ONLY what was actually said
- If conversation lacks information for a section, write "Not discussed" or skip it

FORMAT TEMPLATE:
# [Topic Name] - Notes

## 1. Introduction
Brief overview based on conversation content only.

## 2. Key Concepts
- Only concepts mentioned in the conversation
- Definitions as explained in the chat
- Terms used by participants

## 3. Detailed Explanation
Expand only on points discussed in the conversation.

## 4. Examples
Only examples given during the conversation.

## 5. Important Points
- Only critical information from the chat
- Formulas/rules mentioned in conversation

## 6. Summary
Recap only what was covered in the conversation.

## 7. Keywords
Terms actually used in the conversation.

BEHAVIOR:
- Extract, don't create
- Conversation content only
- No external additions
- Professional formatting`,

            formatTemplate: {
                sections: [
                    'Introduction',
                    'Key Concepts', 
                    'Detailed Explanation',
                    'Examples',
                    'Important Points',
                    'Summary',
                    'Keywords'
                ]
            }
        };
    }

    async generateNotes(content, suggestedTitle = null) {
        try {
            // Detect topic from content
            const topic = this.detectTopic(content, suggestedTitle);
            
            // Generate structured notes
            const notesContent = await this.createStructuredNotes(content, topic);
            
            // Save to Firebase
            const noteId = await this.saveToFirebase(topic, notesContent);
            
            return {
                success: true,
                noteId: noteId,
                title: `${topic} - Notes`,
                content: notesContent
            };
            
        } catch (error) {
            console.error('Gemini2 Notes Generation Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    detectTopic(content, suggestedTitle) {
        if (suggestedTitle) {
            return suggestedTitle.replace(' - Notes', '');
        }

        // Extract topic from conversation content
        const lines = content.split('\n');
        const userMessages = lines.filter(line => line.startsWith('user:') || line.startsWith('USER:'));
        
        if (userMessages.length > 0) {
            const firstQuestion = userMessages[0].replace(/^(user:|USER:)\s*/i, '');
            return this.extractTopicFromQuestion(firstQuestion);
        }

        return 'Study Session';
    }

    extractTopicFromQuestion(question) {
        // Simple topic extraction logic
        const topicKeywords = [
            'physics', 'chemistry', 'biology', 'mathematics', 'math',
            'history', 'geography', 'literature', 'science', 'algebra',
            'calculus', 'geometry', 'newton', 'einstein', 'photosynthesis',
            'cell', 'atom', 'molecule', 'equation', 'theorem'
        ];

        const lowerQuestion = question.toLowerCase();
        
        for (const keyword of topicKeywords) {
            if (lowerQuestion.includes(keyword)) {
                return keyword.charAt(0).toUpperCase() + keyword.slice(1);
            }
        }

        // Extract first few words as topic
        const words = question.split(' ').slice(0, 3).join(' ');
        return words.length > 30 ? words.substring(0, 30) : words;
    }

    async createStructuredNotes(content, topic) {
        try {
            const prompt = this.buildNotesPrompt(content, topic);
            const { geminiAPI } = await import('./gemini-api.js');
            return await geminiAPI.generateNotes(prompt, topic);
        } catch (error) {
            console.error('Error creating structured notes:', error);
            return this.getFallbackNotes(topic, content);
        }
    }

    buildNotesPrompt(content, topic) {
        return `${this.personality.systemPrompt}

CONVERSATION TO EXTRACT NOTES FROM:
${content}

TOPIC DETECTED: ${topic}

IMPORTANT: Create notes using ONLY the information from this conversation. Do not add any external knowledge, definitions, or examples not mentioned in the chat. If a section cannot be filled with conversation content, write "Not discussed in conversation" or skip it entirely.`;
    }

    getFallbackNotes(topic, content) {
        return `# ${topic} - Notes

## 1. Introduction
This study session covered key concepts related to ${topic}.

## 2. Key Concepts
- Main principles discussed
- Important definitions
- Core concepts explained

## 3. Detailed Explanation
The session provided comprehensive coverage of ${topic} fundamentals, including theoretical background and practical applications.

## 4. Examples
Practical examples and real-world applications were discussed to illustrate the concepts.

## 5. Important Points
- Key principles to remember
- Critical information highlighted
- Essential formulas or rules

## 6. Summary
${topic} involves understanding the fundamental principles and their practical applications in real-world scenarios.

## 7. Keywords
${topic}, concepts, principles, applications, theory, practice`;
    }

    async saveToFirebase(topic, content) {
        if (!auth.currentUser) {
            throw new Error('User not authenticated');
        }

        try {
            const userId = auth.currentUser.uid;
            const noteData = {
                title: `${topic} - Notes`,
                content: content,
                topic: topic,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                type: 'generated'
            };

            const docRef = await addDoc(
                collection(db, 'users', userId, 'notes'), 
                noteData
            );
            
            return docRef.id;
        } catch (error) {
            console.error('Error saving notes to Firebase:', error);
            throw error;
        }
    }

    // Generate session note for recent messages
    async generateSessionNote(conversationText) {
        try {
            const topic = this.detectTopicFromConversation(conversationText);
            const noteContent = await this.createSessionNote(conversationText, topic);
            
            return {
                success: true,
                noteTitle: topic,
                noteContent: noteContent
            };
        } catch (error) {
            console.error('Error generating session note:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    detectTopicFromConversation(conversationText) {
        const lines = conversationText.split('\n');
        const userMessages = lines.filter(line => line.startsWith('USER:'));
        
        if (userMessages.length > 0) {
            const firstQuestion = userMessages[0].replace(/^USER:\s*/i, '');
            return this.extractTopicFromQuestion(firstQuestion);
        }
        
        return 'Discussion Topic';
    }

    async createSessionNote(conversationText, topic) {
        try {
            const prompt = `Create a concise study note about "${topic}" from this conversation:

${conversationText}

Format as markdown with:
- Brief explanation of the topic
- Key points discussed
- Important details or examples

Keep it focused and under 200 words.`;
            
            const { geminiAPI } = await import('./gemini-api.js');
            return await geminiAPI.generateNotes(prompt, topic);
        } catch (error) {
            return this.getFallbackSessionNote(topic, conversationText);
        }
    }

    getFallbackSessionNote(topic, conversationText) {
        return `## ${topic}

Key points from recent discussion:

- Main concepts covered in the conversation
- Important details and explanations
- Practical applications discussed

*Note: This is a summary of the recent conversation about ${topic}.*`;
    }
}