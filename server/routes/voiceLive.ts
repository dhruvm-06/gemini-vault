import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../firebaseAdmin';
import { getGeminiClient, LIVE_VOICE_MODEL, JOURNAL_SYSTEM_INSTRUCTION } from '../gemini';
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
  userTurnStartTime?: number;
  sessionStartTime: number;
  authTimeoutTimer?: NodeJS.Timeout;
  pingInterval?: NodeJS.Timeout;
  durationTimer?: NodeJS.Timeout;
  warningTimer?: NodeJS.Timeout;
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

          // Connect to Gemini Live API via Vertex AI ADC
          try {
            const ai = getGeminiClient();

            ctx.liveSession = await ai.live.connect({
              model: LIVE_VOICE_MODEL,
              config: {
                responseModalities: ['AUDIO' as any],
                systemInstruction: { parts: [{ text: fullSystemInstruction }] },
              },
              callbacks: {
                onmessage: async (liveMsg: any) => {
                  try {
                    const serverContent = liveMsg.serverContent;
                    if (!serverContent) return;

                    // Handle Interruption Signal from Gemini Live
                    if (serverContent.interrupted) {
                      console.log(`[Voice Live] Interruption detected for session ${sessionId}`);
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
                        await sessionRef.collection('messages').doc(assistantMsgId).set(payload);

                        sendToClient(ws, {
                          type: 'interrupted',
                          assistantTurnId: assistantMsgId,
                          finalContent: partialContent,
                        });
                      } else {
                        sendToClient(ws, { type: 'interrupted' });
                      }

                      sendToClient(ws, { type: 'state_change', state: 'listening' });
                      return;
                    }

                    // Handle Model Turn Audio and Transcript
                    if (serverContent.modelTurn?.parts) {
                      sendToClient(ws, { type: 'state_change', state: 'speaking' });

                      for (const part of serverContent.modelTurn.parts) {
                        // Relay PCM audio chunk to browser
                        if (part.inlineData?.data) {
                          sendToClient(ws, {
                            type: 'audio_chunk',
                            pcm: part.inlineData.data, // base64 24kHz 16-bit PCM
                          });
                        }
                        // Accumulate and stream interim transcript text
                        if (part.text) {
                          ctx.accumulatedAssistantText += part.text;
                          sendToClient(ws, {
                            type: 'interim_transcript',
                            role: 'assistant',
                            text: ctx.accumulatedAssistantText,
                          });
                        }
                      }
                    }

                    // Handle Turn Completion
                    if (serverContent.turnComplete) {
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

                        await sessionRef.collection('messages').doc(assistantMsgId).set(payload);

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

                        // Update session wordCount
                        const wordsAdded = finalContent.split(/\s+/).length;
                        await sessionRef.update({
                          wordCount: FieldValue.increment(wordsAdded),
                          updatedAt: FieldValue.serverTimestamp(),
                        });
                      }

                      sendToClient(ws, { type: 'state_change', state: 'listening' });
                    }
                  } catch (streamErr) {
                    console.error('[Voice Live] Error handling Live API message:', streamErr);
                  }
                },
                onerror: (err: any) => {
                  console.error('[Voice Live] Gemini Live API error:', err);
                  sendError(ws, 'MODEL_ERROR', 'The voice companion encountered a temporary connection glitch.');
                },
                onclose: () => {
                  console.log(`[Voice Live] Gemini Live API stream closed for session ${sessionId}`);
                },
              },
            });

            console.log(`[Voice Live] Successfully connected to Gemini Live (${LIVE_VOICE_MODEL}) for session ${sessionId}`);
            sendToClient(ws, { type: 'ready', sessionId });
            sendToClient(ws, { type: 'state_change', state: 'listening' });
          } catch (liveErr) {
            console.error('[Voice Live] Failed to connect to Gemini Live API:', liveErr);
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
                  media: {
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
            media: {
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
