import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../firebaseAdmin';
import {
  getGeminiClient,
  getGeminiLiveClient,
  LIVE_VOICE_MODEL,
  JOURNAL_SYSTEM_INSTRUCTION,
  MODEL_FALLBACK_LADDER,
} from '../gemini';
import { SAFE_ID_REGEX } from './journal';

// Active voice connections map: userId -> WebSocket
const activeConnections = new Map<string, WebSocket>();

// Rate limiter map for connection attempts: userId -> timestamp[]
const connectionAttempts = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxAttempts = 10;

  const timestamps = (connectionAttempts.get(userId) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxAttempts) {
    return true;
  }
  timestamps.push(now);
  connectionAttempts.set(userId, timestamps);
  return false;
}

interface SocketContext {
  ws: WebSocket;
  sessionId: string;
  userId?: string;
  isAuthenticated: boolean;
  liveSession?: any;
  currentAssistantTurnId?: string;
  accumulatedAssistantText: string;
  accumulatedUserText: string;
  lastFinalizedUserText?: string;
  hasOutputTranscription?: boolean;
  fallbackModelText?: string;
  finalizedUserTurns: string[];
  userTurnsCount: number;
  titleGenerationState: 'none' | 'initial' | 'refined';
  isGeneratingTitle: boolean;
  currentSessionTitle?: string;
  userTurnStartTime?: number;
  sessionStartTime: number;
  authTimeoutTimer?: NodeJS.Timeout;
  pingInterval?: NodeJS.Timeout;
  durationTimer?: NodeJS.Timeout;
  warningTimer?: NodeJS.Timeout;
}

/**
 * Generates a concise, human reflection title (3-6 words) based on accumulated user thoughts.
 * Uses server-side Gemini without blocking the active voice streaming loop.
 */
async function generateVoiceSessionTitle(accumulatedThoughts: string[]): Promise<string | null> {
  const contextText = accumulatedThoughts
    .map((t, i) => `Thought ${i + 1}: ${t}`)
    .join('\n')
    .slice(0, 800);

  const prompt = `You are titling a private reflection session in Gemini Vault.
Based strictly on the reflector's accumulated thoughts below, generate a concise, human, insightful title (3 to 6 words) that captures their core dilemma, theme, or intention.

<reflector_thoughts>
${contextText}
</reflector_thoughts>

Strict Rules:
- 3 to 6 words only.
- Must summarize the actual reflector thoughts above; do not assume or invent unstated facts.
- Do NOT use generic titles like "Voice Reflection", "My Thoughts", "Reflection Session", "Finding Clarity", "Self Reflection", "Journal Entry", "Morning Thoughts", "Evening Reflection", or "User Thoughts".
- Do NOT use quotation marks, asterisks, backticks, or markdown.
- Return ONLY the clean title text.`;

  const ai = process.env.GEMINI_API_KEY ? getGeminiLiveClient() : getGeminiClient();
  const models = MODEL_FALLBACK_LADDER;

  const GENERIC_TITLES = new Set([
    'voice reflection',
    'my thoughts',
    'reflection session',
    'finding clarity',
    'self reflection',
    'journal entry',
    'morning thoughts',
    'evening reflection',
    'user thoughts',
    'untitled',
  ]);

  for (const model of models) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          maxOutputTokens: 25,
          temperature: 0.3,
        },
      });
      const rawTitle = resp.text?.replace(/["'*_#`]/g, '').trim();
      if (
        rawTitle &&
        rawTitle.length >= 3 &&
        rawTitle.length <= 60 &&
        !GENERIC_TITLES.has(rawTitle.toLowerCase())
      ) {
        return rawTitle;
      }
    } catch (err) {
      console.warn(`[Voice Titling] Model ${model} generation failed:`, err);
    }
  }
  return null;
}

/**
 * Triggers asynchronous title generation after accumulating sufficient context (2-3 turns).
 * Allows at most one later refinement.
 */
function triggerAutoTitling(
  ctx: SocketContext,
  sessionRef: FirebaseFirestore.DocumentReference
): void {
  const turnCount = ctx.finalizedUserTurns.length;
  const totalWords = ctx.finalizedUserTurns.reduce(
    (acc, t) => acc + t.trim().split(/\s+/).filter(Boolean).length,
    0
  );

  // Condition 1: Initial title after 2-3 meaningful turns with sufficient text context (never on turn 1)
  const shouldInitialTitle =
    ctx.titleGenerationState === 'none' &&
    !ctx.isGeneratingTitle &&
    ((turnCount >= 2 && totalWords >= 15) || turnCount >= 3);

  // Condition 2: Controlled refinement around turn 5-6 after topic evolves
  const shouldRefineTitle =
    ctx.titleGenerationState === 'initial' &&
    !ctx.isGeneratingTitle &&
    ctx.userTurnsCount >= 5 &&
    turnCount >= 4;

  if (!shouldInitialTitle && !shouldRefineTitle) {
    return;
  }

  const nextState = shouldInitialTitle ? 'initial' : 'refined';
  ctx.titleGenerationState = nextState;
  ctx.isGeneratingTitle = true;
  const turnsSnapshot = [...ctx.finalizedUserTurns];

  (async () => {
    try {
      const generatedTitle = await generateVoiceSessionTitle(turnsSnapshot);
      if (
        generatedTitle &&
        generatedTitle !== ctx.currentSessionTitle &&
        ctx.userId
      ) {
        ctx.currentSessionTitle = generatedTitle;
        await sessionRef.update({
          title: generatedTitle,
          updatedAt: FieldValue.serverTimestamp(),
        });
        sendToClient(ctx.ws, {
          type: 'session_titled',
          title: generatedTitle,
        });
        console.log(`[Voice Titling] Session ${ctx.sessionId} titled (${nextState}): "${generatedTitle}"`);
      }
    } catch (titleErr) {
      console.warn(`[Voice Titling] Titling failed for session ${ctx.sessionId} (preserving existing):`, titleErr);
    } finally {
      ctx.isGeneratingTitle = false;
    }
  })().catch((err) => {
    console.error('[Voice Titling] Unhandled background titling error:', err);
    ctx.isGeneratingTitle = false;
  });
}

function sendToClient(ws: WebSocket, message: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, code: string, message: string, fatal = false): void {
  sendToClient(ws, { type: 'error', code, message, fatal });
}

export function setupVoiceWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname !== '/api/voice/live') {
      return; // Leave for other upgrade handlers or Vite
    }

    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId || !SAFE_ID_REGEX.test(sessionId)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Notice: NO token in query string! Token will be verified in the immediate auth frame.
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, sessionId);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, sessionId: string) => {
    const ctx: SocketContext = {
      ws,
      sessionId,
      isAuthenticated: false,
      accumulatedAssistantText: '',
      accumulatedUserText: '',
      finalizedUserTurns: [],
      hasOutputTranscription: false,
      userTurnsCount: 0,
      titleGenerationState: 'none',
      isGeneratingTitle: false,
      sessionStartTime: Date.now(),
    };

    console.log(`[Voice WebSocket] Socket connected for session ${sessionId}. Awaiting auth frame...`);

    // Strict 5-second authentication timeout: socket MUST authenticate immediately
    ctx.authTimeoutTimer = setTimeout(() => {
      if (!ctx.isAuthenticated) {
        console.warn(`[Voice WebSocket] Auth timeout for session ${sessionId}`);
        sendError(ws, 'AUTH_TIMEOUT', 'Authentication timed out. No valid auth frame received.', true);
        ws.close(4401, 'Authentication Timeout');
      }
    }, 5000);

    // Keepalive Ping/Pong Heartbeat (every 25s for Cloud Run proxy resilience)
    let isAlive = true;
    ws.on('pong', () => {
      isAlive = true;
    });

    ctx.pingInterval = setInterval(() => {
      if (!isAlive) {
        console.warn(`[Voice WebSocket] Ping timeout for session ${sessionId}. Terminating zombie connection.`);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 25000);

    // Message handler
    ws.on('message', async (rawData: Buffer | string) => {
      try {
        let msg: any = null;

        // Check if message is binary audio or JSON control frame
        if (Buffer.isBuffer(rawData) || typeof rawData === 'string') {
          try {
            const str = rawData.toString('utf8');
            if (str.startsWith('{') && str.endsWith('}')) {
              msg = JSON.parse(str);
            }
          } catch {
            // Not a JSON frame; treat as binary audio if authenticated
          }
        }

        // 1. UNAUTHENTICATED STAGE: Accept ONLY { type: 'auth', token }
        if (!ctx.isAuthenticated) {
          if (!msg || msg.type !== 'auth' || typeof msg.token !== 'string') {
            sendError(ws, 'UNAUTHENTICATED', 'Must authenticate with Firebase ID token before sending data.', true);
            ws.close(4401, 'Unauthenticated');
            return;
          }

          // Clear auth timer
          if (ctx.authTimeoutTimer) {
            clearTimeout(ctx.authTimeoutTimer);
            ctx.authTimeoutTimer = undefined;
          }

          // Verify Firebase ID Token
          let decodedToken;
          try {
            decodedToken = await adminAuth.verifyIdToken(msg.token);
          } catch (authErr) {
            console.warn(`[Voice WebSocket] Invalid Firebase ID token for session ${sessionId}:`, authErr);
            sendError(ws, 'INVALID_TOKEN', 'Firebase token verification failed.', true);
            ws.close(4401, 'Invalid Token');
            return;
          }

          const uid = decodedToken.uid;
          ctx.userId = uid;

          // Rate limit check
          if (isRateLimited(uid)) {
            sendError(ws, 'RATE_LIMIT_EXCEEDED', 'Too many voice connection attempts. Please wait a minute.', true);
            ws.close(4429, 'Rate Limit Exceeded');
            return;
          }

          // Validate session ownership and active status
          const sessionRef = adminDb.collection('users').doc(uid).collection('sessions').doc(sessionId);
          const sessionDoc = await sessionRef.get();

          if (!sessionDoc.exists) {
            sendError(ws, 'SESSION_NOT_FOUND', 'Reflection session not found or unauthorized.', true);
            ws.close(4404, 'Session Not Found');
            return;
          }

          const sessionData = sessionDoc.data();
          if (sessionData?.status === 'completed') {
            sendError(ws, 'SESSION_CONCLUDED', 'This reflection session is already concluded and read-only.', true);
            ws.close(4403, 'Session Concluded');
            return;
          }

          if (sessionData?.title) {
            ctx.currentSessionTitle = sessionData.title;
            if (
              !sessionData.title.startsWith('Voice Reflection') &&
              !sessionData.title.startsWith('Reflection Session')
            ) {
              ctx.titleGenerationState = 'initial';
            }
          }

          // Enforce 1 active voice connection per user (terminate previous if any)
          const existingSocket = activeConnections.get(uid);
          if (existingSocket && existingSocket !== ws && existingSocket.readyState === WebSocket.OPEN) {
            sendToClient(existingSocket, {
              type: 'error',
              code: 'SUPERSEDED',
              message: 'Voice session opened in another tab or device.',
              fatal: true,
            });
            existingSocket.close(4000, 'Superseded');
          }
          activeConnections.set(uid, ws);

          ctx.isAuthenticated = true;
          console.log(`[Voice WebSocket] User ${uid} authenticated for session ${sessionId}`);
          sendToClient(ws, { type: 'authenticated', uid });

          // 20-minute session duration warning & hard cap
          ctx.warningTimer = setTimeout(() => {
            sendToClient(ws, { type: 'session_warning', minutesRemaining: 2 });
          }, 18 * 60 * 1000);

          ctx.durationTimer = setTimeout(() => {
            sendToClient(ws, {
              type: 'error',
              code: 'SESSION_DURATION_LIMIT',
              message: 'Voice reflection reached maximum 20-minute duration. Please take a pause or switch to text.',
              fatal: true,
            });
            ws.close(1000, 'Duration Limit Reached');
          }, 20 * 60 * 1000);

          // Fetch recent 16 conversation turns to seed context
          const messagesSnap = await sessionRef.collection('messages').orderBy('timestamp', 'asc').limitToLast(16).get();
          const historyTurns: Array<{ role: string; text: string }> = [];
          messagesSnap.forEach((doc) => {
            const d = doc.data();
            if (d && d.content && (d.role === 'user' || d.role === 'assistant')) {
              historyTurns.push({ role: d.role, text: d.content });
            }
          });

          // Build context-seeded system instruction
          let contextPreamble = '';
          if (historyTurns.length > 0) {
            const formattedHistory = historyTurns
              .map((t) => `${t.role === 'assistant' ? 'Companion' : 'Reflector'}: ${t.text}`)
              .join('\n');
            contextPreamble = `\n\nRecent context from this ongoing reflection session:\n<session_history>\n${formattedHistory}\n</session_history>\nContinue the reflection naturally from this point.`;
          }

          const fullSystemInstruction = `${JOURNAL_SYSTEM_INSTRUCTION}${contextPreamble}`;

          // Connect to Gemini Live API via server-side Gemini client
          try {
            const ai = getGeminiLiveClient();

            ctx.liveSession = await ai.live.connect({
              model: LIVE_VOICE_MODEL,
              config: {
                responseModalities: ['AUDIO' as any],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: { parts: [{ text: fullSystemInstruction }] },
              },
              callbacks: {
                onmessage: async (liveMsg: any) => {
                  try {
                    const serverContent = liveMsg.serverContent;
                    if (!serverContent) return;

                    // Helper to finalize a user turn: immediate client dispatch with non-blocking Firestore persistence
                    const finalizeUserTurn = (rawText: string) => {
                      const userText = rawText.trim();
                      if (userText.length === 0 || !ctx.userId) return;
                      // Intra-turn duplicate check: do not emit duplicate turns within the same speaking cycle
                      if (userText === ctx.lastFinalizedUserText) return;

                      ctx.lastFinalizedUserText = userText;
                      ctx.accumulatedUserText = '';
                      ctx.userTurnsCount = (ctx.userTurnsCount || 0) + 1;

                      if (!ctx.finalizedUserTurns) ctx.finalizedUserTurns = [];
                      ctx.finalizedUserTurns.push(userText);
                      if (ctx.finalizedUserTurns.length > 6) {
                        ctx.finalizedUserTurns = ctx.finalizedUserTurns.slice(-6);
                      }

                      const userMsgId = `msg_u_v_${crypto.randomUUID()}`;
                      const userPayload = {
                        id: userMsgId,
                        role: 'user',
                        content: userText,
                        modality: 'voice',
                        interrupted: false,
                        clientTimestamp: new Date().toISOString(),
                        timestamp: FieldValue.serverTimestamp(),
                      };

                      // 1. Immediately send turn_persisted to client (<1ms) - DO NOT block on Firestore I/O
                      sendToClient(ws, {
                        type: 'turn_persisted',
                        message: {
                          id: userMsgId,
                          role: 'user',
                          content: userText,
                          modality: 'voice',
                          interrupted: false,
                          clientTimestamp: userPayload.clientTimestamp,
                        },
                      });

                      // 2. Persist to Firestore asynchronously in background
                      sessionRef
                        .collection('messages')
                        .doc(userMsgId)
                        .set(userPayload)
                        .catch((dbErr) => {
                          console.error(`[Voice Live] Failed to persist user turn ${userMsgId}:`, dbErr);
                        });

                      const wordsAdded = userText.split(/\s+/).filter(Boolean).length;
                      sessionRef
                        .update({
                          wordCount: FieldValue.increment(wordsAdded),
                          updatedAt: FieldValue.serverTimestamp(),
                        })
                        .catch((dbErr) => {
                          console.error(`[Voice Live] Failed to update wordCount for session ${sessionId}:`, dbErr);
                        });

                      // Trigger asynchronous automatic session titling
                      triggerAutoTitling(ctx, sessionRef);
                    };

                    // 1. Live interim user transcription preview (ephemeral UI state)
                    const interimInput = serverContent.interimInputTranscription || serverContent.interim_input_transcription;
                    if (interimInput?.text) {
                      const interimText = interimInput.text;
                      ctx.accumulatedUserText = interimText;
                      sendToClient(ws, {
                        type: 'interim_transcript',
                        role: 'user',
                        text: interimText,
                      });
                    }

                    // 2. Canonical finalized user turn transcription
                    const inputTranscription = serverContent.inputTranscription || serverContent.input_transcription;
                    if (inputTranscription?.text) {
                      finalizeUserTurn(inputTranscription.text);
                    }

                    // 3. Handle Interruption Signal from Gemini Live
                    if (serverContent.interrupted) {
                      console.log(`[Voice Live] Interruption detected for session ${sessionId}`);
                      ctx.hasOutputTranscription = false;
                      ctx.fallbackModelText = '';
                      // Reset user turn deduplication tracker on interruption so next speech turn starts clean
                      ctx.lastFinalizedUserText = undefined;
                      const partialContent = ctx.accumulatedAssistantText.trim();
                      ctx.accumulatedAssistantText = '';

                      // Save partial assistant turn if substantial (> 3 chars)
                      if (partialContent.length > 3 && ctx.userId) {
                        const assistantMsgId = `msg_a_v_${crypto.randomUUID()}`;
                        const payload = {
                          id: assistantMsgId,
                          role: 'assistant',
                          content: partialContent,
                          modality: 'voice',
                          interrupted: true,
                          clientTimestamp: new Date().toISOString(),
                          timestamp: FieldValue.serverTimestamp(),
                        };

                        sendToClient(ws, {
                          type: 'interrupted',
                          assistantTurnId: assistantMsgId,
                          finalContent: partialContent,
                        });

                        sessionRef
                          .collection('messages')
                          .doc(assistantMsgId)
                          .set(payload)
                          .catch((dbErr) => {
                            console.error(`[Voice Live] Failed to persist interrupted assistant turn ${assistantMsgId}:`, dbErr);
                          });
                      } else {
                        sendToClient(ws, { type: 'interrupted' });
                      }

                      sendToClient(ws, { type: 'state_change', state: 'listening' });
                      return;
                    }

                    // 4. Handle Output Transcription (Gemini spoken text stream - single authoritative source)
                    const outputTranscription = serverContent.outputTranscription || serverContent.output_transcription;
                    if (outputTranscription?.text) {
                      ctx.hasOutputTranscription = true;
                      ctx.accumulatedAssistantText += outputTranscription.text;
                      sendToClient(ws, {
                        type: 'interim_transcript',
                        role: 'assistant',
                        text: ctx.accumulatedAssistantText,
                      });
                    }

                    // 5. Handle Model Turn Audio and Transcript
                    if (serverContent.modelTurn?.parts) {
                      // If model begins responding but user turn was not yet finalized from inputTranscription,
                      // promote the accumulated interim user speech into the current user turn exactly once.
                      if (ctx.accumulatedUserText.trim().length > 0) {
                        finalizeUserTurn(ctx.accumulatedUserText);
                      }

                      sendToClient(ws, { type: 'state_change', state: 'speaking' });

                      for (const part of serverContent.modelTurn.parts) {
                        // Relay PCM audio chunk to browser
                        if (part.inlineData?.data) {
                          sendToClient(ws, {
                            type: 'audio_chunk',
                            pcm: part.inlineData.data, // base64 24kHz 16-bit PCM
                          });
                        }
                        // Note: outputTranscription is the authoritative transcription of spoken audio.
                        // We buffer part.text solely as a fallback if outputTranscription is entirely absent,
                        // avoiding duplicate concatenation and speech/transcript desynchronization.
                        if (part.text) {
                          ctx.fallbackModelText = (ctx.fallbackModelText || '') + part.text;
                        }
                      }
                    }

                    // 6. Handle Turn Completion
                    if (serverContent.turnComplete) {
                      // If outputTranscription was completely absent for this turn, fall back to buffered model text
                      if (!ctx.hasOutputTranscription && ctx.fallbackModelText && ctx.accumulatedAssistantText.length === 0) {
                        ctx.accumulatedAssistantText = ctx.fallbackModelText;
                      }
                      ctx.fallbackModelText = '';
                      ctx.hasOutputTranscription = false;
                      // Reset user turn deduplication tracker so repeated short responses ("Yes", "No", etc.) on next turn succeed
                      ctx.lastFinalizedUserText = undefined;
                      const finalContent = ctx.accumulatedAssistantText.trim();
                      ctx.accumulatedAssistantText = '';

                      if (finalContent.length > 0 && ctx.userId) {
                        const assistantMsgId = `msg_a_v_${crypto.randomUUID()}`;
                        const payload = {
                          id: assistantMsgId,
                          role: 'assistant',
                          content: finalContent,
                          modality: 'voice',
                          interrupted: false,
                          clientTimestamp: new Date().toISOString(),
                          timestamp: FieldValue.serverTimestamp(),
                        };

                        // Immediate client dispatch - DO NOT block on Firestore I/O
                        sendToClient(ws, {
                          type: 'turn_persisted',
                          message: {
                            id: assistantMsgId,
                            role: 'assistant',
                            content: finalContent,
                            modality: 'voice',
                            interrupted: false,
                            clientTimestamp: payload.clientTimestamp,
                          },
                        });

                        // Persist to Firestore asynchronously in background
                        sessionRef
                          .collection('messages')
                          .doc(assistantMsgId)
                          .set(payload)
                          .catch((dbErr) => {
                            console.error(`[Voice Live] Failed to persist assistant turn ${assistantMsgId}:`, dbErr);
                          });

                        // Update session wordCount
                        const wordsAdded = finalContent.split(/\s+/).filter(Boolean).length;
                        sessionRef
                          .update({
                            wordCount: FieldValue.increment(wordsAdded),
                            updatedAt: FieldValue.serverTimestamp(),
                          })
                          .catch((dbErr) => {
                            console.error(`[Voice Live] Failed to update wordCount for session ${sessionId}:`, dbErr);
                          });
                      }

                      sendToClient(ws, { type: 'state_change', state: 'listening' });
                    }
                  } catch (streamErr) {
                    console.error('[Voice Live] Error handling Live API message:', streamErr);
                  }
                },
                onerror: (err: any) => {
                  const errPayload = {
                    model: LIVE_VOICE_MODEL,
                    sessionId,
                    message: err?.message || (typeof err === 'string' ? err : 'Unknown upstream error'),
                    code: err?.code,
                    status: err?.status,
                  };
                  console.error(`[Voice Live] Gemini Live API error for session ${sessionId} (model: ${LIVE_VOICE_MODEL}):`, JSON.stringify(errPayload));
                  sendError(ws, 'MODEL_ERROR', 'The voice companion encountered a connection glitch.');
                },
                onclose: (closeEvt: any) => {
                  const closeDetails = {
                    model: LIVE_VOICE_MODEL,
                    sessionId,
                    code: closeEvt?.code,
                    reason: closeEvt?.reason || (closeEvt?.target?._closeMessage ? closeEvt.target._closeMessage.toString() : undefined),
                    wasClean: closeEvt?.wasClean,
                  };
                  console.warn(`[Voice Live] Gemini Live API stream closed for session ${sessionId} (model: ${LIVE_VOICE_MODEL}):`, JSON.stringify(closeDetails));

                  if (ws.readyState === WebSocket.OPEN) {
                    sendError(
                      ws,
                      'MODEL_UNAVAILABLE',
                      'The live voice companion stream closed unexpectedly. You can continue reflecting via text.',
                      true
                    );
                    ws.close(4503, 'Upstream Live Stream Closed');
                  }
                },
              },
            });

            console.log(`[Voice Live] Successfully connected to Gemini Live (${LIVE_VOICE_MODEL}) for session ${sessionId}`);
            sendToClient(ws, { type: 'ready', sessionId });
            sendToClient(ws, { type: 'state_change', state: 'listening' });
          } catch (liveErr: any) {
            const errPayload = {
              model: LIVE_VOICE_MODEL,
              sessionId,
              message: liveErr?.message || String(liveErr),
              code: liveErr?.code,
              status: liveErr?.status,
            };
            console.error(`[Voice Live] Failed to connect to Gemini Live API for session ${sessionId} (model: ${LIVE_VOICE_MODEL}):`, JSON.stringify(errPayload));
            sendError(
              ws,
              'MODEL_UNAVAILABLE',
              'The live voice companion is temporarily unavailable. You can continue reflecting via text.',
              true
            );
            ws.close(4503, 'Model Unavailable');
          }
          return;
        }

        // 2. AUTHENTICATED STAGE: Process Voice Events
        if (msg) {
          switch (msg.type) {
            case 'auth_refresh': {
              if (typeof msg.token === 'string') {
                try {
                  const refreshedToken = await adminAuth.verifyIdToken(msg.token);
                  if (refreshedToken.uid === ctx.userId) {
                    sendToClient(ws, { type: 'auth_refreshed', success: true });
                  } else {
                    ws.close(4401, 'Mismatched User');
                  }
                } catch {
                  ws.close(4401, 'Expired Token');
                }
              }
              break;
            }

            case 'audio_chunk': {
              // Binary or base64 PCM 16kHz audio chunk from browser
              if (ctx.liveSession && typeof msg.data === 'string') {
                if (!ctx.userTurnStartTime) {
                  ctx.userTurnStartTime = Date.now();
                }

                ctx.liveSession.sendRealtimeInput({
                  audio: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: msg.data,
                  },
                });
              }
              break;
            }

            case 'end_of_turn': {
              // User has finished speaking their turn
              if (ctx.liveSession) {
                sendToClient(ws, { type: 'state_change', state: 'thinking' });

                // If user text transcript was provided from client or accumulated
                if (typeof msg.transcript === 'string' && msg.transcript.trim().length > 0 && ctx.userId) {
                  const userText = msg.transcript.trim();
                  const durationMs = ctx.userTurnStartTime ? Date.now() - ctx.userTurnStartTime : 0;
                  ctx.userTurnStartTime = undefined;

                  const userMsgId = `msg_u_v_${crypto.randomUUID()}`;
                  const sessionRef = adminDb.collection('users').doc(ctx.userId).collection('sessions').doc(sessionId);

                  const userPayload = {
                    id: userMsgId,
                    role: 'user',
                    content: userText,
                    modality: 'voice',
                    audioDurationMs: durationMs,
                    clientTimestamp: new Date().toISOString(),
                    timestamp: FieldValue.serverTimestamp(),
                  };

                  await sessionRef.collection('messages').doc(userMsgId).set(userPayload);

                  const wordsAdded = userText.split(/\s+/).length;
                  await sessionRef.update({
                    wordCount: FieldValue.increment(wordsAdded),
                    updatedAt: FieldValue.serverTimestamp(),
                  });

                  sendToClient(ws, {
                    type: 'turn_persisted',
                    message: {
                      id: userMsgId,
                      role: 'user',
                      content: userText,
                      modality: 'voice',
                      audioDurationMs: durationMs,
                      clientTimestamp: userPayload.clientTimestamp,
                    },
                  });
                }
              }
              break;
            }

            case 'user_interrupted': {
              // Client-side detected barge-in: client cut audio, tell Gemini Live
              if (ctx.liveSession) {
                // Clearing liveSession buffer
                ctx.accumulatedAssistantText = '';
                ctx.lastFinalizedUserText = undefined;
                sendToClient(ws, { type: 'state_change', state: 'listening' });
              }
              break;
            }

            case 'conclude_session': {
              if (ctx.userId) {
                const sessionRef = adminDb.collection('users').doc(ctx.userId).collection('sessions').doc(sessionId);
                await sessionRef.update({
                  status: 'completed',
                  endedAt: FieldValue.serverTimestamp(),
                });

                sendToClient(ws, { type: 'session_concluded', sessionId });
                ws.close(1000, 'Session Concluded');
              }
              break;
            }
          }
        } else if (Buffer.isBuffer(rawData) && ctx.liveSession) {
          // Direct binary buffer containing raw 16kHz PCM audio
          if (!ctx.userTurnStartTime) {
            ctx.userTurnStartTime = Date.now();
          }

          ctx.liveSession.sendRealtimeInput({
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: rawData.toString('base64'),
            },
          });
        }
      } catch (msgErr) {
        console.error('[Voice WebSocket] Message processing error:', msgErr);
      }
    });

    // Cleanup on socket disconnect
    ws.on('close', () => {
      console.log(`[Voice WebSocket] Socket closed for session ${sessionId}`);

      if (ctx.authTimeoutTimer) clearTimeout(ctx.authTimeoutTimer);
      if (ctx.pingInterval) clearInterval(ctx.pingInterval);
      if (ctx.durationTimer) clearTimeout(ctx.durationTimer);
      if (ctx.warningTimer) clearTimeout(ctx.warningTimer);

      if (ctx.userId && activeConnections.get(ctx.userId) === ws) {
        activeConnections.delete(ctx.userId);
      }

      if (ctx.liveSession) {
        try {
          // Close upstream Gemini Live session cleanly
          if (typeof ctx.liveSession.close === 'function') {
            ctx.liveSession.close();
          }
        } catch {
          // Ignore close errors
        }
        ctx.liveSession = undefined;
      }
    });

    ws.on('error', (err) => {
      console.error(`[Voice WebSocket] Error on socket for session ${sessionId}:`, err);
    });
  });

  return wss;
}
