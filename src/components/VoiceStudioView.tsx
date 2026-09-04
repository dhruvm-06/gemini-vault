import React, { useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { JournalMessage } from '../types';
import { VaultPresence } from './VaultPresence';
import { useVoiceSession } from '../hooks/useVoiceSession';

interface VoiceStudioViewProps {
  sessionId: string;
  sessionTitle: string;
  messages: JournalMessage[];
  getIdToken: () => Promise<string | null>;
  onReturnToText: () => void;
  onTurnPersisted: (turn: JournalMessage) => void;
  onInterrupted?: (turnId?: string, text?: string) => void;
  onConcludeSession: () => void;
}

export const VoiceStudioView: React.FC<VoiceStudioViewProps> = ({
  sessionId,
  sessionTitle,
  messages,
  getIdToken,
  onReturnToText,
  onTurnPersisted,
  onInterrupted,
  onConcludeSession,
}) => {
  const {
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
    clearError,
  } = useVoiceSession({
    sessionId,
    getIdToken,
    onTurnPersisted,
    onInterrupted,
    onConcluded: () => {
      onConcludeSession();
    },
  });

  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Auto-start voice session on mount
  useEffect(() => {
    void start();
    return () => {
      stop();
    };
  }, [start, stop]);

  // Auto-scroll transcript on new interim or persisted text
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [interimAssistantText, interimUserText, messages.length]);

  // Keyboard shortcuts: Space toggles mute, Escape returns to text
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onReturnToText();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMute, onReturnToText]);

  // Format timer: MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = () => {
    if (isMuted) return 'Microphone muted';
    switch (presenceState) {
      case 'listening':
        return 'Listening deeply… Speak freely';
      case 'thinking':
        return 'Reflecting on your thoughts…';
      case 'speaking':
        return 'Gemini speaking (speak to interrupt)';
      case 'interrupted':
        return 'Interrupted. Listening…';
      case 'reconnecting':
        return 'Reconnecting live voice session…';
      case 'ended':
        return 'Session ended';
      default:
        return 'Connecting to Vault Presence…';
    }
  };

  // Recent voice and text turns (show last 6 turns for calm focus)
  const recentTurns = messages.slice(-6);

  return (
    <div className="h-full flex flex-col justify-between bg-[var(--gv-surface-ground)] text-[var(--gv-text-primary)] relative select-none overflow-hidden transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="px-4 sm:px-8 py-4 flex items-center justify-between border-b border-[var(--gv-border-subtle)] bg-[var(--gv-surface-base)]/80 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onReturnToText}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] border border-[var(--gv-border-subtle)] text-xs font-medium transition cursor-pointer shrink-0"
            aria-label="Return to Text Reflection"
            title="Switch to keyboard typing (Esc)"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Return to Text</span>
          </button>

          <div className="flex flex-col min-w-0">
            <h2 className="font-serif text-sm sm:text-base font-medium text-[var(--gv-text-primary)] truncate max-w-xs sm:max-w-md">
              {sessionTitle || 'Voice Reflection'}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-[var(--gv-accent)] font-sans">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gv-accent)] animate-pulse" />
              <span>Continuous Live Stream</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live Audio Duration Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-xs font-mono text-[var(--gv-text-secondary)]">
            <Clock className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
            <span>{formatTime(durationSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={onConcludeSession}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--gv-accent)] hover:opacity-90 text-white text-xs font-medium transition cursor-pointer shadow-xs"
          >
            Conclude
          </button>
        </div>
      </header>

      {/* Main Celestial Presence Centerpiece & Live Transcript */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden relative max-w-3xl mx-auto w-full">
        {/* Error Notification Banner */}
        {error && (
          <div className="w-full mb-4 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onReturnToText}
                className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-900 border border-rose-700 text-[11px] font-medium transition cursor-pointer"
              >
                Switch to Text
              </button>
              <button
                type="button"
                onClick={clearError}
                className="p-1 text-rose-400 hover:text-white transition cursor-pointer text-sm"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Vault Presence Center */}
        <div className="my-auto flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative flex items-center justify-center">
            <VaultPresence
              size="large"
              state={presenceState}
              audioReactivity={audioReactivity}
              className="scale-90 sm:scale-110 md:scale-125 transition-transform duration-300"
            />
          </div>

          <div className="space-y-1">
            <p className="font-serif text-base sm:text-lg text-[var(--gv-text-primary)] tracking-tight font-medium animate-in fade-in duration-200">
              {getStatusLabel()}
            </p>
            <p className="text-[11px] text-[var(--gv-text-tertiary)] font-sans">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] font-mono text-[10px]">Space</kbd> to {isMuted ? 'unmute' : 'mute'}, <kbd className="px-1.5 py-0.5 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] font-mono text-[10px]">Esc</kbd> for keyboard
            </p>
          </div>
        </div>

        {/* Rolling Live Transcript Stream */}
        <div
          ref={transcriptScrollRef}
          className="w-full max-h-48 sm:max-h-60 overflow-y-auto px-4 py-3 rounded-2xl bg-[var(--gv-surface-base)]/65 border border-[var(--gv-border-subtle)]/80 backdrop-blur-xs space-y-3 font-sans text-xs scroll-smooth"
          aria-live="polite"
        >
          {recentTurns.length === 0 && !interimUserText && !interimAssistantText ? (
            <div className="py-4 text-center text-[var(--gv-text-tertiary)] italic font-serif">
              Begin speaking your thoughts. Spoken turns appear here in real time.
            </div>
          ) : (
            <>
              {recentTurns.map((turn) => {
                const isUser = turn.role === 'user';
                return (
                  <div
                    key={turn.id}
                    className={`flex flex-col space-y-1 transition-opacity ${
                      isUser ? 'items-end text-right' : 'items-start text-left'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--gv-text-tertiary)]">
                      <span>{isUser ? 'You' : 'Gemini'}</span>
                      {turn.modality === 'voice' && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--gv-surface-raised)] text-[var(--gv-accent)]">
                          spoken
                        </span>
                      )}
                      {turn.interrupted && (
                        <span className="text-[9px] text-[var(--gv-text-muted)] italic">
                          (interrupted)
                        </span>
                      )}
                    </div>
                    <p
                      className={`max-w-[85%] text-xs leading-relaxed ${
                        isUser
                          ? 'text-[var(--gv-text-secondary)] font-sans'
                          : 'text-[var(--gv-text-primary)] font-serif text-[13px]'
                      }`}
                    >
                      {turn.content}
                    </p>
                  </div>
                );
              })}

              {/* Live Interim User Transcript */}
              {interimUserText && (
                <div className="flex flex-col items-end text-right space-y-1 animate-in fade-in duration-100">
                  <span className="text-[10px] text-[var(--gv-accent)] font-medium">You (speaking…)</span>
                  <p className="max-w-[85%] text-xs text-[var(--gv-text-primary)] leading-relaxed font-sans">
                    {interimUserText}
                  </p>
                </div>
              )}

              {/* Live Interim Assistant Transcript */}
              {interimAssistantText && (
                <div className="flex flex-col items-start text-left space-y-1 animate-in fade-in duration-100">
                  <span className="text-[10px] text-[var(--gv-accent)] font-medium">Gemini (speaking…)</span>
                  <p className="max-w-[85%] text-[13px] text-[var(--gv-text-primary)] leading-relaxed font-serif">
                    {interimAssistantText}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating Bottom Control Dock */}
      <footer className="p-4 sm:p-6 shrink-0 z-20 flex justify-center">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] shadow-lg backdrop-blur-md">
          {/* Mute / Unmute Button */}
          <button
            type="button"
            id="voice-mic-btn"
            onClick={toggleMute}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              isMuted
                ? 'bg-rose-900/70 text-rose-200 border border-rose-700'
                : 'bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-primary)] border border-[var(--gv-border-subtle)]'
            }`}
            title={isMuted ? 'Unmute microphone (Space)' : 'Mute microphone (Space)'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-[var(--gv-accent)]" />}
            <span>{isMuted ? 'Muted' : 'Mute'}</span>
          </button>

          {/* Switch to Typing Button */}
          <button
            type="button"
            id="voice-text-btn"
            onClick={onReturnToText}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] border border-[var(--gv-border-subtle)] text-xs font-medium transition cursor-pointer"
            title="Return to text keyboard reflection (Escape)"
          >
            <Keyboard className="w-4 h-4" />
            <span>Type Instead</span>
          </button>

          <div className="w-px h-5 bg-[var(--gv-border-subtle)]" />

          {/* Conclude Reflection Button */}
          <button
            type="button"
            id="voice-conclude-btn"
            onClick={onConcludeSession}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gv-accent)] hover:opacity-90 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            title="Conclude reflection and review memories"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Conclude</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
