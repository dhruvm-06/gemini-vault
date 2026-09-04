import { useState, useEffect, useRef, useCallback } from 'react';
import {
  JournalMessage,
  VoiceSessionStatus,
  VoiceServerMessage,
} from '../types';
import { VaultPresenceState } from '../components/VaultPresence';
import { AudioCaptureService, AudioPlaybackService } from '../utils/audioProcessor';

interface UseVoiceSessionOptions {
  sessionId: string;
  getIdToken: () => Promise<string | null>;
  onTurnPersisted?: (turn: JournalMessage) => void;
  onInterrupted?: (turnId?: string, text?: string) => void;
  onConcluded?: (sessionId: string) => void;
}

export function useVoiceSession({
  sessionId,
  getIdToken,
  onTurnPersisted,
  onInterrupted,
  onConcluded,
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
  const isActiveRef = useRef(false);

  // Sync refs
  isMutedRef.current = isMuted;
  presenceStateRef.current = presenceState;

  // Cleanup services
  const cleanupServices = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }
    if (captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
    }
    if (playbackRef.current) {
      playbackRef.current.close();
      playbackRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close(1000, 'Normal Closure');
      socketRef.current = null;
    }
    setAudioReactivity(0);
  }, []);

  const connectWebSocket = useCallback(async () => {
    if (!sessionId) return;

    setStatus('connecting');
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Notice: STRICTLY NO bearer token in URL query string!
    const wsUrl = `${protocol}//${window.location.host}/api/voice/live?sessionId=${encodeURIComponent(sessionId)}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = async () => {
      console.log('[useVoiceSession] WebSocket connected. Sending immediate auth control frame...');
      try {
        const token = await getIdToken();
        if (!token) {
          setError('Authentication token unavailable.');
          setStatus('error');
          ws.close(4401, 'No Token');
          return;
        }

        // Send immediate authentication frame (Token never touches URL query string)
        ws.send(JSON.stringify({ type: 'auth', token }));
      } catch (authErr) {
        console.error('[useVoiceSession] Token acquisition error:', authErr);
        setError('Failed to acquire authentication token.');
        setStatus('error');
        ws.close(4401, 'Token Error');
      }
    };

    ws.onmessage = (event) => {
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

            // Start timer
            if (!timerIntervalRef.current) {
              timerIntervalRef.current = setInterval(() => {
                setDurationSeconds((prev) => prev + 1);
              }, 1000);
            }

            // Start audio capture service
            if (!captureRef.current) {
              const capture = new AudioCaptureService();
              captureRef.current = capture;

              capture.start((base64Chunk, inputRms) => {
                if (!isMutedRef.current && ws.readyState === WebSocket.OPEN) {
                  // Barge-in check: If Gemini is speaking and user vocalizes, immediately cut playback
                  if (presenceStateRef.current === 'speaking' && inputRms > 0.25) {
                    if (playbackRef.current) {
                      playbackRef.current.stopAll();
                    }
                    ws.send(JSON.stringify({ type: 'user_interrupted' }));
                    setPresenceState('listening');
                  }

                  ws.send(JSON.stringify({
                    type: 'audio_chunk',
                    data: base64Chunk,
                  }));
                }

                // Update reactivity if in listening state
                if (presenceStateRef.current === 'listening') {
                  setAudioReactivity(isMutedRef.current ? 0 : inputRms);
                }
              }).catch((micErr) => {
                console.error('[useVoiceSession] Microphone error:', micErr);
                setError('Microphone access denied. Please allow microphone permissions to use Voice Reflection.');
                setStatus('error');
                setPresenceState('idle');
              });
            }

            // Setup playback reactivity
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
            if (onTurnPersisted) {
              onTurnPersisted(msg.message);
            }
            break;
          }

          case 'interrupted': {
            if (playbackRef.current) {
              playbackRef.current.stopAll();
            }
            setInterimAssistantText('');
            setPresenceState('listening');
            if (onInterrupted) {
              onInterrupted(msg.assistantTurnId, msg.finalContent);
            }
            break;
          }

          case 'session_concluded': {
            setStatus('concluded');
            setPresenceState('ended');
            cleanupServices();
            if (onConcluded) {
              onConcluded(msg.sessionId);
            }
            break;
          }

          case 'error': {
            console.warn('[useVoiceSession] Server error:', msg.code, msg.message);
            setError(msg.message);
            if (msg.fatal) {
              setStatus('error');
              setPresenceState('idle');
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
      console.log(`[useVoiceSession] WebSocket closed (${e.code}: ${e.reason})`);

      // Do not auto-retry if connection was terminated due to auth failure, unauthorized, or rate limit
      const isTerminalCode = e.code === 1000 || e.code === 4401 || e.code === 4403 || e.code === 4429;

      if (isActiveRef.current && !isTerminalCode && retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setStatus('reconnecting');
        setPresenceState('reconnecting');

        const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
        console.log(`[useVoiceSession] Attempting reconnect in ${delay}ms (attempt ${retryCountRef.current})...`);
        setTimeout(() => {
          if (isActiveRef.current) {
            void connectWebSocket();
          }
        }, delay);
      } else if (e.code !== 1000) {
        setStatus('error');
        setPresenceState('idle');
      }
    };

    ws.onerror = (err) => {
      console.error('[useVoiceSession] WebSocket error:', err);
    };
  }, [sessionId, getIdToken, onTurnPersisted, onInterrupted, onConcluded, cleanupServices]);

  const start = useCallback(async () => {
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
