import { GoogleGenAI } from '@google/genai';

/**
 * Lazy-initialized GoogleGenAI client singleton.
 * Uses User-Agent: 'aistudio-build' as required by platform standards.
 */
let aiClient: GoogleGenAI | null = null;

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.PROJECT_ID || 'gemini-vault-507219',
      location: 'global',
    });
  }

  return client;
}

/**
 * Model Fallback Ladder:
 * Ordered sequentially for low-latency conversational text interaction and high availability.
 */
const MODEL_FALLBACK_LADDER = [
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

export const JOURNAL_SYSTEM_INSTRUCTION = `You are the reflective companion within Gemini Vault, a private, serene space for deep thinking and self-reflection.

Your Role & Guiding Principles:
1. Thoughtful Exploration: Listen deeply to what the user writes. Help them unpack underlying motivations, emotions, and thought patterns.
2. Socratic Inquiries: Ask one or two poignant, open-ended follow-up questions that invite deeper clarity or alternative perspectives.
3. Gentle Nuance & Contradiction: If you notice subtle tensions or conflicting feelings in what they share, gently mirror it back without judgment (e.g., "It seems part of you feels relieved, yet another part feels anxious about...").
4. Authentic Humility: Never pretend to know the user's life better than they do. Avoid definitive judgments or labeling their personality.
5. Non-Clinical Boundary: You are a reflective thought partner, not a therapist, counselor, or medical professional. Avoid clinical diagnoses, pathology labels, or therapeutic prescriptions.
6. Tone & Style: Calm, warm, concise, and intellectually lucid. Avoid clichés like "How does that make you feel?" or generic motivational cheerleading. Speak in natural conversational prose (typically 2-4 focused paragraphs). Never give unsolicited multi-step action plans unless explicitly requested.`;

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Executes a conversational generation using the resilient model fallback ladder.
 * Gracefully iterates through available models if a recoverable API error occurs.
 */
export async function generateJournalResponseWithFallback(
  recentHistory: ConversationTurn[],
  latestUserMessage: string
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();

  // Format bounded history into Gemini content turns
  const contents = recentHistory.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }));

  // Append latest user message
  contents.push({
    role: 'user',
    parts: [{ text: latestUserMessage }],
  });

  let lastError: unknown = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    try {
      console.log(`[Gemini] Attempting generation with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: JOURNAL_SYSTEM_INSTRUCTION,
          temperature: 0.7,
          topP: 0.95,
        },
      });

      const responseText = response.text?.trim();
      if (responseText) {
        console.log(`[Gemini] Generation succeeded with model: ${modelName}`);
        return {
          text: responseText,
          modelUsed: modelName,
        };
      }
    } catch (err: unknown) {
      console.warn(`[Gemini] Model ${modelName} failed, evaluating fallback ladder:`, err);
      lastError = err;
      // Continue to next model in the fallback ladder
    }
  }

  throw lastError || new Error('All Gemini fallback models failed to generate a response.');
}
