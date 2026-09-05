import { useState, useEffect, useRef, useCallback } from 'react';
import {
  JournalMessage,
  VoiceSessionStatus,
  VoiceServerMessage,
} from '../types';
import { VaultPresenceState } from '../components/VaultPresence';
import { AudioCaptureService, AudioPlaybackService, formatMicrophoneError } from '../utils/audioProcessor';

interface UseVoiceSessionOptions {
  sessionId: string;
  getIdToken: () => Promise<string | null>;
  onTurnPersisted?: (turn: JournalMessage) => void;
  onInterrupted?: (turnId?: string, text?: string) => void;
  onConcluded?: (sessionId: string) => void;
  onSessionTitled?: (title: string) => void;
}

const TERMINAL_CLOSE_CODES = new Set([
  1000, // Normal Closure (intentional conclusion or unmount)
  4000, // Superseded by another active connection
  4401, // Unauthorized / Auth timeout / Invalid token
  4403, // Session concluded / forbidden
  4404, // Session not found
  4429, // Rate limit exceeded
  4503, // Model unavailable / upstream Live API closed
]);

export function useVoiceSession({
  sessionId,
  getIdToken,
  onTurnPersisted,
  onInterrupted,
  onConcluded,
  onSessionTitled,
}: UseVoiceSessionOptions) {
  const [status, setStatus] = useState<VoiceSessionStatus>('unauthenticated');
  const [presenceState, setPresenceState] = useState<VaultPresenceState>('idle');
  const [audioReactivity, setAudioReactivity] = useState(0);
  const [interimUserText, setInterimUserText] = useState('');
  const [interimAssistantText, setInterimAssistantText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<AudioCaptureService | null>(null);
  const playbackRef = useRef<AudioPlaybackService | null>(null);
  const isMutedRef = useRef(false);
  const presenceStateRef = useRef<VaultPresenceState>('idle');
  const retryCountRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isActiveRef = useRef(false);

  // Preserve latest callback references without destabilizing useCallback hooks
  const callbacksRef = useRef({
    getIdToken,
    onTurnPersisted,
    onInterrupted,
    onConcluded,
    onSessionTitled,
  });
  useEffect(() => {
    callbacksRef.current = {
      getIdToken,
      onTurnPersisted,
      onInterrupted,
      onConcluded,
      onSessionTitled,
    };
  });

  // Sync state to refs for real-time audio processor callbacks
  isMutedRef.current = isMuted;
  presenceStateRef.current = presenceState;

  // Cancel any scheduled reconnect timer
  const cancelReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }
  }, []);

  // Stop microphone capture without resetting session status
  const stopAudioCapture = useCallback(() => {
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
    setAudioReactivity(0);
  }, []);

  // Comprehensive service cleanup
  const cleanupServices = useCallback(() => {
    cancelReconnectTimer();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }

    stopAudioCapture();

    if (playbackRef.current) {
      playbackRef.current.close();
      playbackRef.current = null;
    }

    if (socketRef.current) {
      const ws = socketRef.current;
      socketRef.current = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Normal Closure');
      }
    }

    setAudioReactivity(0);
  }, [cancelReconnectTimer, stopAudioCapture]);

  const connectWebSocket = useCallback(async () => {
    if (!sessionId || !isActiveRef.current) return;

    // Single-connection invariant: cancel pending reconnect and close any existing socket
    cancelReconnectTimer();

    if (socketRef.current) {
      const oldWs = socketRef.current;
      socketRef.current = null;
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onerror = null;
      oldWs.onclose = null;
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close(1000, 'Replaced by single connection invariant');
      }
    }

    // Stop audio capture while connecting/authenticating
    stopAudioCapture();

    setStatus('connecting');
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // STRICTLY NO token in query string — verified in immediate auth control frame
    const wsUrl = `${protocol}//${window.location.host}/api/voice/live?sessionId=${encodeURIComponent(sessionId)}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = async () => {
      // Guard against stale socket
      if (socketRef.current !== ws || !isActiveRef.current) {
        ws.close(1000, 'Stale socket');
        return;
      }

      console.log('[useVoiceSession] WebSocket connected. Sending immediate auth control frame...');
      try {
        const token = await callbacksRef.current.getIdToken();
        if (socketRef.current !== ws || !isActiveRef.current) {
          ws.close(1000, 'Stale socket');
          return;
        }

        if (!token) {
          setError('Authentication token unavailable.');
          setStatus('error');
          setPresenceState('idle');
          isActiveRef.current = false;
          cleanupServices();
          return;
        }

        // Send immediate authentication frame (Token never touches URL query string)
        ws.send(JSON.stringify({ type: 'auth', token }));
      } catch (authErr) {
        console.error('[useVoiceSession] Token acquisition error:', authErr);
        if (socketRef.current === ws) {
          setError('Failed to acquire authentication token.');
          setStatus('error');
          setPresenceState('idle');
          isActiveRef.current = false;
          cleanupServices();
        }
      }
    };

    ws.onmessage = (event) => {
      // Guard against stale socket
      if (socketRef.current !== ws || !isActiveRef.current) return;

      try {
        const msg = JSON.parse(event.data) as VoiceServerMessage;

        switch (msg.type) {
          case 'authenticated': {
            console.log('[useVoiceSession] Socket verified and bound to UID:', msg.uid);
            setStatus('authenticated');
            retryCountRef.current = 0;
            break;
          }

          case 'ready': {
            console.log('[useVoiceSession] Live API ready for session:', msg.sessionId);
            setStatus('ready');
            setPresenceState('listening');

            // Start duration timer
            if (!timerIntervalRef.current) {
              timerIntervalRef.current = setInterval(() => {
                setDurationSeconds((prev) => prev + 1);
              }, 1000);
            }

            // Start audio capture service bound to current active socket
            stopAudioCapture();

            const capture = new AudioCaptureService();
            captureRef.current = capture;

            capture.start((base64Chunk, inputRms) => {
              const activeWs = socketRef.current;
              if (
                isActiveRef.current &&
                activeWs &&
                activeWs.readyState === WebSocket.OPEN &&
                !isMutedRef.current
              ) {
                // Barge-in check: If Gemini is speaking and user vocalizes, immediately cut playback
                if (presenceStateRef.current === 'speaking' && inputRms > 0.25) {
                  if (playbackRef.current) {
                    playbackRef.current.stopAll();
                  }
                  activeWs.send(JSON.stringify({ type: 'user_interrupted' }));
                  setPresenceState('listening');
                }

                activeWs.send(JSON.stringify({
                  type: 'audio_chunk',
                  data: base64Chunk,
                }));
              }

              // Update reactivity if in listening state
              if (presenceStateRef.current === 'listening') {
                setAudioReactivity(isMutedRef.current ? 0 : inputRms);
              }
            }).catch((micErr) => {
              console.error('[useVoiceSession] Microphone initialization error:', micErr);
              const errorMessage = formatMicrophoneError(micErr);
              setError(errorMessage);
              setStatus('error');
              setPresenceState('idle');
              isActiveRef.current = false;
              cleanupServices();
            });

            // Setup playback service
            if (!playbackRef.current) {
              const playback = new AudioPlaybackService();
              playbackRef.current = playback;
              playback.setRmsCallback((outputRms) => {
                if (presenceStateRef.current === 'speaking') {
                  setAudioReactivity(outputRms);
                }
              });
            }
            break;
          }

          case 'state_change': {
            setPresenceState(msg.state as VaultPresenceState);
            if (msg.state === 'listening' || msg.state === 'idle') {
              setInterimAssistantText('');
            }
            break;
          }

          case 'audio_chunk': {
            if (playbackRef.current && msg.pcm) {
              setPresenceState('speaking');
              playbackRef.current.playPcmChunk(msg.pcm);
            }
            break;
          }

          case 'interim_transcript': {
            if (msg.role === 'assistant') {
              setInterimAssistantText(msg.text);
            } else {
              setInterimUserText(msg.text);
            }
            break;
          }

          case 'turn_persisted': {
            if (msg.message.role === 'user') {
              setInterimUserText('');
            } else {
              setInterimAssistantText('');
            }
            if (callbacksRef.current.onTurnPersisted) {
              callbacksRef.current.onTurnPersisted(msg.message);
            }
            break;
          }

          case 'interrupted': {
            if (playbackRef.current) {
              playbackRef.current.stopAll();
            }
            setInterimAssistantText('');
            setPresenceState('listening');
            if (callbacksRef.current.onInterrupted) {
              callbacksRef.current.onInterrupted(msg.assistantTurnId, msg.finalContent);
            }
            break;
          }

          case 'session_concluded': {
            setStatus('concluded');
            setPresenceState('ended');
            isActiveRef.current = false;
            cleanupServices();
            if (callbacksRef.current.onConcluded) {
              callbacksRef.current.onConcluded(msg.sessionId);
            }
            break;
          }

          case 'session_titled': {
            if (callbacksRef.current.onSessionTitled) {
              callbacksRef.current.onSessionTitled(msg.title);
            }
            break;
          }

          case 'error': {
            console.warn('[useVoiceSession] Server error:', msg.code, msg.message);
            setError(msg.message);
            if (msg.fatal) {
              setStatus('error');
              setPresenceState('idle');
              isActiveRef.current = false;
              cleanupServices();
            }
            break;
          }
        }
      } catch (err) {
        console.error('[useVoiceSession] Message parsing error:', err);
      }
    };

    ws.onclose = (e) => {
      // Guard: Ignore closed events from old superseded sockets
      if (socketRef.current !== ws) return;

      console.log(`[useVoiceSession] WebSocket closed (${e.code}: ${e.reason})`);
      socketRef.current = null;
      stopAudioCapture();
      if (playbackRef.current) {
        playbackRef.current.stopAll();
      }

      // Check terminal close codes (never auto-retry on terminal codes)
      if (TERMINAL_CLOSE_CODES.has(e.code)) {
        isActiveRef.current = false;
        cleanupServices();

        if (e.code === 1000) {
          // Intentional close or conclusion
          if (status !== 'concluded') {
            setStatus('unauthenticated');
            setPresenceState('idle');
          }
        } else if (e.code === 4000) {
          setError('Voice session was superseded by another connection in a different tab or window.');
          setStatus('error');
          setPresenceState('idle');
        } else if (e.code === 4429) {
          setError('Voice connection rate limit exceeded. Please wait a minute before retrying.');
          setStatus('error');
          setPresenceState('idle');
        } else if (e.code === 4503) {
          setError('Live voice companion is temporarily unavailable. You can continue reflecting via text.');
          setStatus('error');
          setPresenceState('idle');
        } else if (e.code === 4401) {
          setError('Authentication failed. Please sign in again.');
          setStatus('error');
          setPresenceState('idle');
        } else {
          setError(e.reason || 'Voice reflection session closed.');
          setStatus('error');
          setPresenceState('idle');
        }
        return;
      }

      // Transient disconnect reconnect logic:
      // Bounded retry count (< 3), exponential backoff with jitter
      if (isActiveRef.current && retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setStatus('reconnecting');
        setPresenceState('reconnecting');

        const baseDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 8000);
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelay + jitter;

        console.log(`[useVoiceSession] Attempting reconnect in ${delay}ms (attempt ${retryCountRef.current}/3)...`);
        cancelReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = undefined;
          if (isActiveRef.current) {
            void connectWebSocket();
          }
        }, delay);
      } else {
        // Retries exhausted
        isActiveRef.current = false;
        setError('Voice connection lost. You can continue reflecting via text.');
        setStatus('error');
        setPresenceState('idle');
        cleanupServices();
      }
    };

    ws.onerror = (err) => {
      if (socketRef.current !== ws) return;
      console.error('[useVoiceSession] WebSocket error:', err);
    };
  }, [sessionId, cancelReconnectTimer, stopAudioCapture, cleanupServices]);

  const start = useCallback(async () => {
    // If already active and socket is open/connecting, don't duplicate
    if (
      isActiveRef.current &&
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    isActiveRef.current = true;
    retryCountRef.current = 0;
    setDurationSeconds(0);
    await connectWebSocket();
  }, [connectWebSocket]);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    cleanupServices();
    setStatus('unauthenticated');
    setPresenceState('idle');
  }, [cleanupServices]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const conclude = useCallback(async () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'conclude_session' }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      cleanupServices();
    };
  }, [cleanupServices]);

  return {
    status,
    presenceState,
    audioReactivity,
    interimUserText,
    interimAssistantText,
    isMuted,
    error,
    durationSeconds,
    start,
    stop,
    toggleMute,
    conclude,
    clearError: () => setError(null),
  };
}
