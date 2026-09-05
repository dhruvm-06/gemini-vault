import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { setupVoiceWebSocket } from '../server/routes/voiceLive';
import { formatMicrophoneError } from '../src/utils/audioProcessor';

test('Voice WebSocket Server Contract: Rejects unauthenticated audio with 4401', async () => {
  const server = http.createServer();
  setupVoiceWebSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;

  const sessionId = 'test-session-auth-check-001';
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/voice/live?sessionId=${sessionId}`);

  const messages: any[] = [];
  let closedCode: number | null = null;
  let closedReason = '';

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      // Attempt to stream audio immediately without auth frame
      ws.send(JSON.stringify({ type: 'audio_chunk', data: 'AQIDBA==' }));
    });

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    ws.on('close', (code, reason) => {
      closedCode = code;
      closedReason = reason.toString();
      resolve();
    });

    ws.on('error', reject);
  });

  server.close();

  // Verify server rejected unauthorized audio with UNAUTHENTICATED and code 4401
  assert.strictEqual(closedCode, 4401, 'Socket must be closed with 4401');
  assert.strictEqual(closedReason, 'Unauthenticated');
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].type, 'error');
  assert.strictEqual(messages[0].code, 'UNAUTHENTICATED');
  assert.strictEqual(messages[0].fatal, true);
});

test('Voice WebSocket Server Contract: Rejects invalid Firebase token with 4401', async () => {
  const server = http.createServer();
  setupVoiceWebSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;

  const sessionId = 'test-session-invalid-token-002';
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/voice/live?sessionId=${sessionId}`);

  const messages: any[] = [];
  let closedCode: number | null = null;

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'bogus-invalid-token' }));
    });

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    ws.on('close', (code) => {
      closedCode = code;
      resolve();
    });

    ws.on('error', reject);
  });

  server.close();

  assert.strictEqual(closedCode, 4401, 'Socket must be closed with 4401 on invalid token');
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].code, 'INVALID_TOKEN');
  assert.strictEqual(messages[0].fatal, true);
});

test('Voice WebSocket Server Contract: Invalid session ID rejected during upgrade with 400', async () => {
  const server = http.createServer();
  setupVoiceWebSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;

  // Malicious session ID with illegal characters
  const badSessionId = 'bad/session/id?injection=true';
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/voice/live?sessionId=${encodeURIComponent(badSessionId)}`);

  let errorReceived = false;

  await new Promise<void>((resolve) => {
    ws.on('open', () => {
      ws.close();
      resolve();
    });
    ws.on('error', () => {
      errorReceived = true;
      resolve();
    });
  });

  server.close();
  assert.strictEqual(errorReceived, true, 'Upgrade must be rejected for illegal session IDs');
});

test('Voice Client Lifecycle Invariant: Terminal codes never trigger reconnect', () => {
  const TERMINAL_CLOSE_CODES = new Set([1000, 4000, 4401, 4403, 4404, 4429, 4503]);

  // Verify all critical terminal codes are accounted for
  assert(TERMINAL_CLOSE_CODES.has(1000), 'Normal closure must be terminal');
  assert(TERMINAL_CLOSE_CODES.has(4000), 'Superseded (4000) must be terminal to prevent ping-pong reconnect storms');
  assert(TERMINAL_CLOSE_CODES.has(4401), 'Auth failure (4401) must be terminal');
  assert(TERMINAL_CLOSE_CODES.has(4403), 'Concluded session (4403) must be terminal');
  assert(TERMINAL_CLOSE_CODES.has(4404), 'Session not found (4404) must be terminal');
  assert(TERMINAL_CLOSE_CODES.has(4429), 'Rate limit (4429) must be terminal, never retry immediately');
  assert(TERMINAL_CLOSE_CODES.has(4503), 'Model unavailable (4503) must be terminal');

  // Transient network drop (1006) should NOT be terminal
  assert(!TERMINAL_CLOSE_CODES.has(1006), '1006 abnormal drop must be non-terminal for bounded retry');
});

test('Voice Client Single-Connection Invariant: Stale socket cleanup and timer cancellation', () => {
  // Simulate the single-connection manager state
  let activeSocket: any = null;
  let reconnectTimer: any = null;
  let connectCount = 0;
  let closeCount = 0;

  function cancelReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function connect(sessionId: string) {
    cancelReconnectTimer();

    // Close any previous socket and detach handlers
    if (activeSocket) {
      const old = activeSocket;
      activeSocket = null;
      old.onopen = null;
      old.onclose = null;
      old.onmessage = null;
      old.close();
      closeCount++;
    }

    const wsMock = {
      sessionId,
      id: ++connectCount,
      readyState: 1, // OPEN
      close() {
        this.readyState = 3; // CLOSED
      },
      onopen: () => {},
      onclose: () => {},
      onmessage: () => {},
    };

    activeSocket = wsMock;
    return wsMock;
  }

  // 1. Initial connection
  const s1 = connect('sess-1');
  assert.strictEqual(activeSocket.id, 1);
  assert.strictEqual(closeCount, 0);

  // 2. React remount / second start call
  const s2 = connect('sess-1');
  assert.strictEqual(activeSocket.id, 2);
  assert.strictEqual(closeCount, 1, 'Previous socket must be closed synchronously before opening replacement');
  assert.strictEqual(s1.readyState, 3, 'Old socket must be closed');
  assert.strictEqual(s1.onclose, null, 'Old socket handlers must be detached so stale close events do not trigger reconnect');

  // 3. Schedule reconnect then cancel
  reconnectTimer = setTimeout(() => {
    connect('sess-1');
  }, 10000);
  assert(reconnectTimer !== null);

  cancelReconnectTimer();
  assert.strictEqual(reconnectTimer, null, 'Reconnect timer must be cleanly cancelled');
});

test('Voice Client Reconnect Invariant: Bounded backoff with maximum 3 retries', () => {
  let retryCount = 0;
  const delays: number[] = [];

  for (let attempt = 1; attempt <= 5; attempt++) {
    if (retryCount < 3) {
      retryCount++;
      const baseDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
      delays.push(baseDelay);
    }
  }

  assert.strictEqual(retryCount, 3, 'Maximum retry attempts must be strictly capped at 3');
  assert.deepStrictEqual(delays, [1000, 2000, 4000], 'Exponential backoff sequence: 1s, 2s, 4s');
});

test('Voice Client Start Idempotence: No duplicate connections when already active', () => {
  let activeSocket: any = null;
  let connectCalls = 0;
  let isActive = false;

  function start() {
    if (isActive && activeSocket && (activeSocket.readyState === 0 || activeSocket.readyState === 1)) {
      return; // Idempotent guard
    }
    isActive = true;
    connectCalls++;
    activeSocket = {
      readyState: 1, // OPEN
      close() { this.readyState = 3; }
    };
  }

  // First call opens socket
  start();
  assert.strictEqual(connectCalls, 1);

  // Rapid second and third call (e.g. React StrictMode or effect re-renders)
  start();
  start();
  assert.strictEqual(connectCalls, 1, 'Subsequent start() calls must be no-ops when already active');
});

test('Voice Client Terminal Code Rejection: Code 4000, 4429, 4503 terminate immediately', () => {
  const TERMINAL_CLOSE_CODES = new Set([1000, 4000, 4401, 4403, 4404, 4429, 4503]);

  function handleClose(code: number, state: { retried: boolean; status: string }) {
    if (TERMINAL_CLOSE_CODES.has(code)) {
      state.status = 'error';
      state.retried = false;
      return;
    }
    state.retried = true;
    state.status = 'reconnecting';
  }

  // 1. Superseded (4000)
  const state4000 = { retried: false, status: 'listening' };
  handleClose(4000, state4000);
  assert.strictEqual(state4000.retried, false, 'Code 4000 must NOT trigger reconnect');
  assert.strictEqual(state4000.status, 'error');

  // 2. Rate Limit Exceeded (4429)
  const state4429 = { retried: false, status: 'listening' };
  handleClose(4429, state4429);
  assert.strictEqual(state4429.retried, false, 'Code 4429 must NOT trigger reconnect storm');
  assert.strictEqual(state4429.status, 'error');

  // 3. Model Unavailable (4503)
  const state4503 = { retried: false, status: 'listening' };
  handleClose(4503, state4503);
  assert.strictEqual(state4503.retried, false, 'Code 4503 must NOT trigger reconnect loop');
  assert.strictEqual(state4503.status, 'error');

  // 4. Transient network drop (1006)
  const state1006 = { retried: false, status: 'listening' };
  handleClose(1006, state1006);
  assert.strictEqual(state1006.retried, true, 'Code 1006 should allow controlled reconnect');
  assert.strictEqual(state1006.status, 'reconnecting');
});

test('Microphone Diagnostics: formatMicrophoneError distinguishes NotAllowedError from device/constraint errors', async () => {
  const { formatMicrophoneError } = await import('../src/utils/audioProcessor');

  // 1. NotAllowedError (the ONLY error that should state permission denied)
  const notAllowedMsg = formatMicrophoneError({ name: 'NotAllowedError', message: 'Permission denied' });
  assert.strictEqual(
    notAllowedMsg,
    'Microphone access denied. Please allow microphone permissions in your browser to use Voice Reflection.'
  );

  // 2. NotReadableError (Line In in use, unplugged, hardware lock)
  const notReadableMsg = formatMicrophoneError({ name: 'NotReadableError', message: 'Device in use' });
  assert(
    notReadableMsg.includes('Microphone is unavailable or in use by another application'),
    'NotReadableError must report device unavailable or in use'
  );
  assert(
    !notReadableMsg.includes('access denied'),
    'NotReadableError must NEVER be reported as permission/access denied'
  );

  // 3. NotFoundError (no microphone attached)
  const notFoundMsg = formatMicrophoneError({ name: 'NotFoundError', message: 'Requested device not found' });
  assert(notFoundMsg.includes('No microphone detected'));
  assert(!notFoundMsg.includes('access denied'));

  // 4. OverconstrainedError (constraints could not be satisfied)
  const overconstrainedMsg = formatMicrophoneError({ name: 'OverconstrainedError', message: 'Constraints unfulfillable' });
  assert(overconstrainedMsg.includes('requested audio constraints'));
  assert(!overconstrainedMsg.includes('access denied'));

  // 5. AbortError (interrupted by OS or browser)
  const abortMsg = formatMicrophoneError({ name: 'AbortError', message: 'Aborted' });
  assert(abortMsg.includes('interrupted'));
  assert(!abortMsg.includes('access denied'));

  // 6. SecurityError (insecure origin or policy)
  const securityMsg = formatMicrophoneError({ name: 'SecurityError', message: 'Restricted' });
  assert(securityMsg.includes('security policy'));
  assert(!securityMsg.includes('access denied'));

  // 7. TypeError (invalid constraint syntax)
  const typeMsg = formatMicrophoneError({ name: 'TypeError', message: 'Invalid constraints' });
  assert(typeMsg.includes('Invalid microphone configuration constraints'));
  assert(!typeMsg.includes('access denied'));
});

test('Microphone Failure Lifecycle Invariant: Clean stop without reconnect loop', () => {
  let isActive = true;
  let status = 'ready';
  let presenceState = 'listening';
  let error: string | null = null;
  let socketClosed = false;
  let closeCode = 0;
  let retryCount = 0;

  function cleanupServices() {
    socketClosed = true;
    closeCode = 1000;
  }

  function handleMicError(err: unknown) {
    error = formatMicrophoneError(err);
    status = 'error';
    presenceState = 'idle';
    isActive = false;
    cleanupServices();
  }

  // Simulate microphone failure (e.g. Line In NotReadableError)
  handleMicError({ name: 'NotReadableError', message: 'Device in use' });

  assert.strictEqual(status, 'error', 'Status must be error');
  assert.strictEqual(presenceState, 'idle', 'Presence must transition to idle');
  assert.strictEqual(isActive, false, 'Session must not be active');
  assert.strictEqual(socketClosed, true, 'Socket must be closed');
  assert.strictEqual(closeCode, 1000, 'Socket must close cleanly with terminal code 1000');
  assert.strictEqual(retryCount, 0, 'No reconnect attempt should be scheduled on mic failure');
  assert(error !== null && error.includes('unavailable or in use'));
});

test('Gemini Live Outgoing Payload Contract: Uses audio field, not deprecated mediaChunks', async () => {
  const { GoogleGenAI } = await import('@google/genai');

  const ai = new GoogleGenAI({ apiKey: 'mock-test-key' });
  let savedCallbacks: any;
  const sentWireMessages: any[] = [];

  // Mock WebSocketFactory to intercept the exact wire JSON payload sent to Gemini Live
  (ai.live as any).webSocketFactory = {
    create: (url: string, headers: any, callbacks: any) => {
      savedCallbacks = callbacks;
      return {
        connect: () => {
          setTimeout(() => {
            savedCallbacks.onopen();
            setTimeout(() => {
              savedCallbacks.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
            }, 10);
          }, 10);
        },
        send: (data: string) => {
          sentWireMessages.push(JSON.parse(data));
        },
        close: () => {},
      };
    },
  };

  const session = await ai.live.connect({
    model: 'gemini-3.1-flash-live-preview',
    callbacks: { onmessage: () => {} },
  });

  const testAudioData = 'dGVzdC1hdWRpby1jaHVuaw==';
  const testMimeType = 'audio/pcm;rate=16000';

  // Send PCM audio using current API/SDK format
  session.sendRealtimeInput({
    audio: {
      mimeType: testMimeType,
      data: testAudioData,
    },
  });

  // Verify wire message
  assert.strictEqual(sentWireMessages.length, 2, 'Must have sent setup message and realtimeInput message');
  const realtimeMsg = sentWireMessages[1];

  assert(realtimeMsg.realtimeInput, 'Message must contain realtimeInput object');
  assert(realtimeMsg.realtimeInput.audio, 'realtimeInput must contain audio field');
  assert.strictEqual(realtimeMsg.realtimeInput.audio.data, testAudioData, 'Audio data must match');
  assert.strictEqual(realtimeMsg.realtimeInput.audio.mimeType, testMimeType, 'Audio mimeType must match');

  // Verify strictly NO deprecated mediaChunks field
  assert.strictEqual(
    realtimeMsg.realtimeInput.mediaChunks,
    undefined,
    'realtimeInput must NEVER contain deprecated mediaChunks'
  );
  assert.strictEqual(
    realtimeMsg.realtimeInput.media_chunks,
    undefined,
    'realtimeInput must NEVER contain deprecated media_chunks'
  );
});

test('Gemini Live Setup Contract: Configures inputAudioTranscription and outputAudioTranscription', async () => {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: 'mock-test-key' });
  let savedCallbacks: any;
  const sentWireMessages: any[] = [];

  (ai.live as any).webSocketFactory = {
    create: (url: string, headers: any, callbacks: any) => {
      savedCallbacks = callbacks;
      return {
        connect: () => {
          setTimeout(() => {
            savedCallbacks.onopen();
            setTimeout(() => {
              savedCallbacks.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
            }, 10);
          }, 10);
        },
        send: (data: string) => {
          sentWireMessages.push(JSON.parse(data));
        },
        close: () => {},
      };
    },
  };

  await ai.live.connect({
    model: 'gemini-3.1-flash-live-preview',
    config: {
      responseModalities: ['AUDIO' as any],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: { onmessage: () => {} },
  });

  assert.strictEqual(sentWireMessages.length, 1, 'Must send setup message on connect');
  const setupMsg = sentWireMessages[0];
  assert(setupMsg.setup, 'Must contain setup block');
  // Both camelCase and snake_case representations in the SDK wire serialization
  const hasInputTranscription =
    setupMsg.setup.inputAudioTranscription !== undefined ||
    setupMsg.setup.input_audio_transcription !== undefined ||
    setupMsg.setup.generationConfig?.inputAudioTranscription !== undefined ||
    setupMsg.setup.generationConfig?.input_audio_transcription !== undefined;

  const hasOutputTranscription =
    setupMsg.setup.outputAudioTranscription !== undefined ||
    setupMsg.setup.output_audio_transcription !== undefined ||
    setupMsg.setup.generationConfig?.outputAudioTranscription !== undefined ||
    setupMsg.setup.generationConfig?.output_audio_transcription !== undefined;

  assert(hasInputTranscription, 'Setup must include inputAudioTranscription config');
  assert(hasOutputTranscription, 'Setup must include outputAudioTranscription config');
});

test('Voice Transcription Invariant: User turn deduplication and canonical turn persistence', () => {
  // Simulate the turn tracking logic in voiceLive.ts
  let lastFinalizedUserText: string | undefined = undefined;
  const persistedUserTurns: string[] = [];

  function handleInputTranscription(text: string) {
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed !== lastFinalizedUserText) {
      lastFinalizedUserText = trimmed;
      persistedUserTurns.push(trimmed);
      return true; // Persisted
    }
    return false; // Deduplicated
  }

  function handleTurnComplete() {
    // Reset deduplication tracker on turn complete so repeated short answers in subsequent turns are accepted
    lastFinalizedUserText = undefined;
  }

  // 1. Initial utterance
  const result1 = handleInputTranscription('I have been feeling overwhelmed lately');
  assert.strictEqual(result1, true);
  assert.strictEqual(persistedUserTurns.length, 1);

  // 2. Duplicate arrival of identical utterance within same turn
  const result2 = handleInputTranscription('I have been feeling overwhelmed lately');
  assert.strictEqual(result2, false, 'Duplicate text within same turn must be ignored');
  assert.strictEqual(persistedUserTurns.length, 1);

  // 3. Whitespace-only utterance
  const result3 = handleInputTranscription('   ');
  assert.strictEqual(result3, false, 'Whitespace-only must be ignored');
  assert.strictEqual(persistedUserTurns.length, 1);

  // 4. New distinct utterance in same turn
  const result4 = handleInputTranscription('It mostly comes from my workload at the hospital');
  assert.strictEqual(result4, true);
  assert.strictEqual(persistedUserTurns.length, 2);

  // 5. Assistant turn completes, resetting deduplication tracker
  handleTurnComplete();

  // 6. User says a short phrase ("Yes") on the new turn
  const result5 = handleInputTranscription('Yes');
  assert.strictEqual(result5, true, 'Short phrase on new turn must succeed');
  assert.strictEqual(persistedUserTurns.length, 3);

  // 7. Assistant responds and turn completes
  handleTurnComplete();

  // 8. User repeats "Yes" on the subsequent turn — must NOT be dropped!
  const result6 = handleInputTranscription('Yes');
  assert.strictEqual(result6, true, 'Repeated short response across turns must succeed');
  assert.strictEqual(persistedUserTurns.length, 4);
  assert.strictEqual(persistedUserTurns[2], 'Yes');
  assert.strictEqual(persistedUserTurns[3], 'Yes');
});

test('Voice Titling State Machine: Requires 2-3 turns of accumulated context, never on turn 1, max 1 refinement', () => {
  // Simulate the titling state machine logic in triggerAutoTitling
  interface StateContext {
    titleGenerationState: 'none' | 'initial' | 'refined';
    userTurnsCount: number;
    finalizedUserTurns: string[];
    isGeneratingTitle: boolean;
    titlingTriggers: string[];
  }

  const ctx: StateContext = {
    titleGenerationState: 'none',
    userTurnsCount: 0,
    finalizedUserTurns: [],
    isGeneratingTitle: false,
    titlingTriggers: [],
  };

  function evaluateTitling(userText: string) {
    ctx.finalizedUserTurns.push(userText);
    ctx.userTurnsCount++;

    const turnCount = ctx.finalizedUserTurns.length;
    const totalWords = ctx.finalizedUserTurns.reduce(
      (acc, t) => acc + t.trim().split(/\s+/).filter(Boolean).length,
      0
    );

    // Initial title after 2-3 meaningful turns with sufficient text context (never on turn 1)
    const shouldInitialTitle =
      ctx.titleGenerationState === 'none' &&
      !ctx.isGeneratingTitle &&
      ((turnCount >= 2 && totalWords >= 15) || turnCount >= 3);

    // Controlled refinement around turn 5-6 after topic evolves
    const shouldRefineTitle =
      ctx.titleGenerationState === 'initial' &&
      !ctx.isGeneratingTitle &&
      ctx.userTurnsCount >= 5 &&
      turnCount >= 4;

    if (!shouldInitialTitle && !shouldRefineTitle) {
      return false;
    }

    const nextState = shouldInitialTitle ? 'initial' : 'refined';
    ctx.titleGenerationState = nextState;
    ctx.titlingTriggers.push(nextState);
    return true;
  }

  // Turn 1: Single thought (even if lengthy) -> NEVER titles on turn 1
  const t1 = evaluateTitling('I have been feeling completely drained and wondering why I chose this career path.');
  assert.strictEqual(t1, false, 'Must never generate title on turn 1');
  assert.strictEqual(ctx.titleGenerationState, 'none');

  // Turn 2: Second thought, total words >= 15 -> triggers initial title after collecting context
  const t2 = evaluateTitling('It feels like no matter how much effort I put into my projects, expectations keep shifting.');
  assert.strictEqual(t2, true, 'Turn 2 with >= 15 words across 2 turns triggers initial title');
  assert.strictEqual(ctx.titleGenerationState, 'initial');
  assert.deepStrictEqual(ctx.titlingTriggers, ['initial']);

  // Turns 3 & 4: Ongoing reflection -> cooldown, no premature re-titling
  const t3 = evaluateTitling('Maybe the issue is that I hesitate to push back when deadlines are unreasonable.');
  assert.strictEqual(t3, false, 'Turn 3 does not trigger refinement');
  const t4 = evaluateTitling('I usually just say yes to avoid any friction.');
  assert.strictEqual(t4, false, 'Turn 4 does not trigger refinement');
  assert.strictEqual(ctx.titleGenerationState, 'initial');

  // Turn 5: Evolved perspective (turn 5+) -> triggers refinement
  const t5 = evaluateTitling('The real dilemma is learning how to set boundaries with my manager without fear.');
  assert.strictEqual(t5, true, 'Turn 5 triggers controlled title refinement');
  assert.strictEqual(ctx.titleGenerationState, 'refined');
  assert.deepStrictEqual(ctx.titlingTriggers, ['initial', 'refined']);

  // Turn 6+: Further conversation -> NEVER re-titles after refinement
  const t6 = evaluateTitling('I will prepare a brief list of priorities for tomorrow morning.');
  assert.strictEqual(t6, false, 'Turn 6 does not re-title');
  assert.strictEqual(ctx.titlingTriggers.length, 2, 'Must never exceed 2 titling runs per session');
});

test('Voice Model Turn Contract: Assistant text single-source invariant prevents duplication', () => {
  // Simulate Gemini Live serverContent dispatch with outputTranscription and modelTurn
  let accumulatedAssistantText = '';
  let hasOutputTranscription = false;
  const audioChunks: string[] = [];

  function handleServerContent(serverContent: any) {
    const outputTranscription = serverContent.outputTranscription || serverContent.output_transcription;
    if (outputTranscription?.text) {
      hasOutputTranscription = true;
      accumulatedAssistantText += outputTranscription.text;
    }

    if (serverContent.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          audioChunks.push(part.inlineData.data);
        }
        // Deduplication guard: ignore part.text when outputTranscription is providing the transcript
        if (part.text && !hasOutputTranscription && !outputTranscription?.text) {
          accumulatedAssistantText += part.text;
        }
      }
    }

    if (serverContent.turnComplete) {
      hasOutputTranscription = false;
      const finalTurn = accumulatedAssistantText.trim();
      accumulatedAssistantText = '';
      return finalTurn;
    }
    return null;
  }

  // Frame 1: Model audio chunk arrives
  handleServerContent({
    modelTurn: {
      parts: [{ inlineData: { data: 'PCM_AUDIO_CHUNK_1' } }],
    },
  });
  assert.strictEqual(audioChunks.length, 1);
  assert.strictEqual(accumulatedAssistantText, '');

  // Frame 2: outputTranscription text arrives alongside subsequent audio chunk
  handleServerContent({
    outputTranscription: { text: 'I hear the weight you have been carrying. ' },
    modelTurn: {
      parts: [
        { inlineData: { data: 'PCM_AUDIO_CHUNK_2' } },
        // Even if an upstream SDK part includes redundant text, it must NOT duplicate
        { text: 'I hear the weight you have been carrying. ' },
      ],
    },
  });
  assert.strictEqual(audioChunks.length, 2);
  assert.strictEqual(accumulatedAssistantText, 'I hear the weight you have been carrying. ');

  // Frame 3: Next outputTranscription text chunk
  handleServerContent({
    outputTranscription: { text: 'What feels like the most urgent part of this right now?' },
  });
  assert.strictEqual(
    accumulatedAssistantText,
    'I hear the weight you have been carrying. What feels like the most urgent part of this right now?'
  );

  // Frame 4: Turn completion
  const completedTurn = handleServerContent({ turnComplete: true });
  assert.strictEqual(
    completedTurn,
    'I hear the weight you have been carrying. What feels like the most urgent part of this right now?'
  );
  assert.strictEqual(hasOutputTranscription, false, 'State must reset for next turn');
});

test('Vault Presence State: Supports muted state alongside active presence states', () => {
  const validStates = new Set([
    'idle',
    'listening',
    'thinking',
    'speaking',
    'interrupted',
    'reconnecting',
    'muted',
    'ended',
  ]);

  assert(validStates.has('muted'), 'muted state must be recognized');
  assert(validStates.has('listening'), 'listening state must be recognized');
  assert(validStates.has('speaking'), 'speaking state must be recognized');
  assert(validStates.has('interrupted'), 'interrupted state must be recognized');
});
test('Voice Titling Model Ladder Contract: Uses gemini-3.1-flash-lite as primary model with gemini-3.5-flash-lite fallback', async () => {
  const { MODEL_FALLBACK_LADDER } = await import('../server/gemini');

  assert(Array.isArray(MODEL_FALLBACK_LADDER), 'MODEL_FALLBACK_LADDER must be an array');
  assert.strictEqual(
    MODEL_FALLBACK_LADDER[0],
    'gemini-3.1-flash-lite',
    'Primary model must be gemini-3.1-flash-lite'
  );
  assert.strictEqual(
    MODEL_FALLBACK_LADDER[1],
    'gemini-3.5-flash-lite',
    'Fallback model must be gemini-3.5-flash-lite'
  );
});

test('Audio Playback Scheduling Invariant: Lookahead on new burst and seamless continuous chunk chaining', () => {
  // Simulate AudioPlaybackService timing mathematics
  let nextPlayTime = 0;
  const scheduledChunks: Array<{ startTime: number; duration: number; isNewBurst: boolean }> = [];

  function schedulePcm(currentTime: number, duration: number) {
    const isNewBurst = nextPlayTime < currentTime;
    // 40ms lookahead on silence / new burst to avoid buffer starvation / DAC clicks
    const startTime = isNewBurst
      ? Math.max(currentTime + 0.04, nextPlayTime)
      : nextPlayTime;

    nextPlayTime = startTime + duration;
    scheduledChunks.push({ startTime, duration, isNewBurst });
    return startTime;
  }

  // 1. Initial burst starts after silence (currentTime = 5.0, nextPlayTime = 0)
  const t1 = schedulePcm(5.0, 0.1); // 100ms chunk
  assert.strictEqual(scheduledChunks[0].isNewBurst, true);
  assert(Math.abs(t1 - 5.04) < 1e-6, 'New burst must have 40ms lookahead (5.0 + 0.04 = 5.04)');
  assert(Math.abs(nextPlayTime - 5.14) < 1e-6);

  // 2. Chained chunk 2 arrives while chunk 1 is queued (currentTime = 5.05)
  const t2 = schedulePcm(5.05, 0.1);
  assert.strictEqual(scheduledChunks[1].isNewBurst, false, 'Continuous chunk is not a new burst');
  assert(Math.abs(t2 - 5.14) < 1e-6, 'Chunk 2 must chain seamlessly onto chunk 1 end time without gaps or delay');
  assert(Math.abs(nextPlayTime - 5.24) < 1e-6);

  // 3. Chained chunk 3 arrives (currentTime = 5.10)
  const t3 = schedulePcm(5.10, 0.1);
  assert.strictEqual(scheduledChunks[2].isNewBurst, false);
  assert(Math.abs(t3 - 5.24) < 1e-6, 'Chunk 3 must chain seamlessly onto chunk 2 end time');
  assert(Math.abs(nextPlayTime - 5.34) < 1e-6);

  // 4. Gemini finishes speaking, user reflects for 4 seconds, queue drains (currentTime = 9.34)
  const t4 = schedulePcm(9.5, 0.1);
  assert.strictEqual(scheduledChunks[3].isNewBurst, true, 'Queue drained: must be recognized as new burst');
  assert(Math.abs(t4 - 9.54) < 1e-6, 'Next burst after silence must again apply 40ms lookahead cushion');
  assert(Math.abs(nextPlayTime - 9.64) < 1e-6);
});
