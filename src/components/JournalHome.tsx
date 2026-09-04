import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Clock,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Bookmark,
  Brain,
  Layers3,
  Sparkles,
  Target,
  MessageCircle,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormattedResponse } from './FormattedResponse';
import { JournalSession, Memory } from '../types';
import { toTimestamp } from '../utils/time';

type SessionRecord = JournalSession & {
  rootSessionId?: string;
  continuedFromSessionId?: string | null;
  updatedAt?: string | { seconds?: number; _seconds?: number };
  endedAt?: string | { seconds?: number; _seconds?: number };
};

interface JournalHomeProps {
  onStartNewSession: (initialText?: string) => Promise<void>;
  onResumeSession: (sessionId: string) => void;
  onContinueSession?: (sessionId: string) => Promise<void>;
  isCreating: boolean;
}

export const JournalHome: React.FC<JournalHomeProps> = ({
  onStartNewSession,
  onResumeSession,
  onContinueSession,
  isCreating,
}) => {
  const { getIdToken, user } = useAuth();
  const [initialThought, setInitialThought] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sessions, setSessions] = useState<JournalSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [showAllMemories, setShowAllMemories] = useState(false);
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [askingVault, setAskingVault] = useState(false);
  const [askError, setAskError] = useState('');
  const askInputRef = useRef<HTMLTextAreaElement>(null);

  const suggestedDirections = [
    {
      title: 'Morning clarity',
      description: 'What intention or challenge needs your focus today?',
      prompt: 'What intention or challenge needs my focus most clearly today?',
    },
    {
      title: 'Unpack an open loop',
      description: 'Untangle an unresolved decision or lingering tension.',
      prompt: 'I want to unpack an open loop or pending decision that is currently on my mind.',
    },
    {
      title: 'Notice a recurring theme',
      description: 'Explore patterns showing up across recent thoughts.',
      prompt: 'Notice recurring themes: What patterns have been showing up across my thoughts lately?',
    },
    {
      title: 'Think through a decision',
      description: 'Weigh choices with clear, grounded perspective.',
      prompt: 'Help me think through an important decision I am facing right now.',
    },
    {
      title: 'Plan something important',
      description: 'Shape ideas into structured next steps.',
      prompt: 'I want to plan an important initiative and break it down into meaningful next steps.',
    },
  ];

  // Auto-focus starter composer on desktop
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Global type-anywhere for starter studio: typing anywhere on canvas focuses the composer
  useEffect(() => {
    const handleGlobalTyping = (event: KeyboardEvent) => {
      if (isCreating || !textareaRef.current || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1) return;

      const target = event.target as HTMLElement | null;
      const isFormControl =
        target && target instanceof Element
          ? target.closest('input, textarea, select, button, a, [contenteditable="true"]')
          : false;

      if (isFormControl) return;

      textareaRef.current.focus();
    };

    document.addEventListener('keydown', handleGlobalTyping);
    return () => document.removeEventListener('keydown', handleGlobalTyping);
  }, [isCreating]);

  const useStarterPrompt = (prompt: string) => {
    setInitialThought(prompt);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    setLoadError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/journal/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load reflection history');
      }

      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: unknown) {
      console.error('[JournalHome] Error loading sessions:', err);
      setLoadError('Unable to load past reflections. Please try again.');
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchMemories = async () => {
    setLoadingMemories(true);

    try {
      const token = await getIdToken();
      if (!token) {
        setMemories([]);
        return;
      }

      const res = await fetch('/api/memories', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load Vault memories');
      }

      const data = await res.json();
      const loadedMemories = Array.isArray(data.memories) ? data.memories : [];

      loadedMemories.sort((a: Memory, b: Memory) => {
        return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
      });

      setMemories(loadedMemories);
    } catch (err: unknown) {
      console.error('[JournalHome] Error loading Vault memories:', err);
      setMemories([]);
    } finally {
      setLoadingMemories(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchMemories();
  }, []);

  useEffect(() => {
    if (!askOpen || typeof window === 'undefined' || window.innerWidth < 768) return;
    const timer = window.setTimeout(() => askInputRef.current?.focus({ preventScroll: true }), 120);
    return () => window.clearTimeout(timer);
  }, [askOpen]);

  const handleAskMyVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = askQuestion.trim();
    if (!question || askingVault) return;

    setAskingVault(true);
    setAskError('');
    setAskAnswer('');
    askInputRef.current?.blur();
    setAskedQuestion(question);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication required.');
      }

      const res = await fetch('/api/memories/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Unable to ask your Vault.');
      }

      setAskAnswer(typeof data.answer === 'string' ? data.answer : 'Your Vault did not return an answer.');
      setAskQuestion('');
    } catch (err: unknown) {
      console.error('[JournalHome] Error asking Vault:', err);
      setAskError(err instanceof Error ? err.message : 'Unable to ask your Vault right now.');
    } finally {
      setAskingVault(false);
    }
  };

  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onStartNewSession(initialThought.trim());
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => toTimestamp((b as SessionRecord).updatedAt || (b as SessionRecord).createdAt) -
      toTimestamp((a as SessionRecord).updatedAt || (a as SessionRecord).createdAt)
  ) as SessionRecord[];

  const activeSessions = sortedSessions.filter((s) => s.status === 'active');

  const completedSessionRecords = sortedSessions.filter(
    (s) => s.status === 'completed'
  );

  const threadMap = new Map<string, SessionRecord[]>();
  completedSessionRecords.forEach((session) => {
    const rootId = session.rootSessionId || session.id;
    const existing = threadMap.get(rootId) || [];
    existing.push(session);
    threadMap.set(rootId, existing);
  });

  const completedThreads = Array.from(threadMap.entries())
    .map(([rootSessionId, threadSessions]) => ({
      rootSessionId,
      sessions: threadSessions,
      latest: threadSessions[0],
      reflectionCount: threadSessions.length,
      memoryCount: memories.filter((memory) => {
        const source = memory.sourceSessionId;
        return threadSessions.some((session) => session.id === source);
      }).length,
      memoryPreview: memories
        .filter((memory) => threadSessions.some((session) => session.id === memory.sourceSessionId))
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
        .slice(0, 2),
    }))
    .sort((a, b) => toTimestamp(b.latest.updatedAt || b.latest.createdAt) - toTimestamp(a.latest.updatedAt || a.latest.createdAt));

  return (
    <div className="w-full min-h-full px-4 sm:px-8 py-8 sm:py-12 bg-[var(--gv-surface-base)] text-[var(--gv-text-primary)] transition-colors">
      <div className="gv-reading-measure space-y-12 sm:space-y-16">
        {/* 1. Reflect Starter Studio Canvas */}
        <section className="space-y-6 animate-turn-enter">
          <div className="space-y-2">
            <div className="text-xs font-sans font-medium text-[var(--gv-accent)] tracking-wider uppercase">
              Gemini Vault · Reflective Studio
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[var(--gv-text-primary)] tracking-tight leading-[1.12]">
              What is on your mind today?
            </h1>
            <p className="text-sm sm:text-base text-[var(--gv-text-secondary)] font-sans leading-relaxed max-w-xl">
              Reflect with an intelligent companion, preserve what matters, and notice how your thinking evolves over time.
            </p>
          </div>

          {/* Large Reflection Composer */}
          <form onSubmit={handleStartSubmit} className="space-y-3 pt-2">
            <div className="relative rounded-2xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] focus-within:border-[var(--gv-accent)] focus-within:ring-2 focus-within:ring-[var(--gv-focus-ring)] transition shadow-sm">
              <textarea
                ref={textareaRef}
                id="initial-thought"
                value={initialThought}
                onChange={(e) => setInitialThought(e.target.value)}
                placeholder="What is currently on your mind?"
                rows={3}
                className="w-full p-4 sm:p-5 pr-28 bg-transparent text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] text-sm sm:text-base focus:outline-none resize-none font-sans leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isCreating && initialThought.trim()) {
                      onStartNewSession(initialThought.trim());
                    }
                  }
                }}
              />

              <button
                type="submit"
                disabled={isCreating || !initialThought.trim()}
                id="start-reflection-btn"
                className="absolute right-3 bottom-3 px-4 py-2.5 rounded-xl bg-[var(--gv-accent)] text-white hover:opacity-90 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {isCreating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Reflect</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-[var(--gv-text-tertiary)] font-sans select-none">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] font-mono text-[10px]">Return</kbd> to begin · <kbd className="px-1.5 py-0.5 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] font-mono text-[10px]">Shift+Return</kbd> for newline</span>
              <span className="hidden sm:inline">Encrypted in personal vault isolation</span>
            </div>
          </form>

          {/* Integrated Suggested Directions */}
          <div className="space-y-2.5 pt-2">
            <span className="text-xs font-medium text-[var(--gv-text-tertiary)] font-sans">
              Suggested directions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {suggestedDirections.map((dir) => (
                <button
                  key={dir.title}
                  type="button"
                  onClick={() => useStarterPrompt(dir.prompt)}
                  className="text-left p-3.5 rounded-xl border border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)] hover:bg-[var(--gv-surface-raised)] hover:border-[var(--gv-border-strong)] transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-[var(--gv-text-primary)] group-hover:text-[var(--gv-accent)] transition">
                      {dir.title}
                    </h3>
                    <ArrowRight className="w-3 h-3 text-[var(--gv-text-tertiary)] group-hover:text-[var(--gv-accent)] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--gv-text-secondary)] leading-relaxed">
                    {dir.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Active Reflections in Progress (Quiet, non-card-wall hierarchy) */}
        {activeSessions.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--gv-accent)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Active Reflections</span>
              </h2>
              <span className="text-xs text-[var(--gv-text-tertiary)]">{activeSessions.length} active</span>
            </div>

            <div className="divide-y divide-[var(--gv-border-subtle)] rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)] overflow-hidden shadow-xs">
              {(showAllActive ? activeSessions : activeSessions.slice(0, 3)).map((session) => (
                <div
                  key={session.id}
                  onClick={() => onResumeSession(session.id)}
                  className="p-4 hover:bg-[var(--gv-surface-raised)] transition cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1 pr-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--gv-accent)] animate-pulse shrink-0"></span>
                      <h3 className="text-sm font-medium text-[var(--gv-text-primary)] group-hover:text-[var(--gv-accent)] transition truncate">
                        {session.title || 'Untitled Reflection'}
                      </h3>
                    </div>
                    {session.draftContent && (
                      <p className="text-xs text-[var(--gv-text-secondary)] truncate font-sans">
                        {session.draftContent}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--gv-accent)] shrink-0">
                    <span>Resume</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>

            {activeSessions.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllActive((prev) => !prev)}
                className="w-full pt-1 text-center text-[11px] font-medium text-[var(--gv-text-tertiary)] hover:text-[var(--gv-accent)] transition cursor-pointer"
              >
                {showAllActive ? 'Show fewer active reflections' : `View all ${activeSessions.length} active reflections`}
              </button>
            )}
          </section>
        )}

        {/* 3. Completed Reflection Threads (Calm, editorial history) */}
        <section id="reflection-threads-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--gv-text-secondary)] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Past Reflections</span>
            </h2>
            {completedThreads.length > 0 && (
              <span className="text-xs text-[var(--gv-text-tertiary)]">
                {completedSessionRecords.length} sessions · {completedThreads.length} threads
              </span>
            )}
          </div>

          {loadError && (
            <div className="p-3.5 rounded-xl bg-[var(--gv-error-muted)] border border-[var(--gv-error-border)] text-[var(--gv-error-text)] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[var(--gv-error)]" />
              <span>{loadError}</span>
            </div>
          )}

          {loadingSessions ? (
            <div className="p-8 text-center text-[var(--gv-text-tertiary)] text-xs font-sans flex flex-col items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--gv-accent)] border-t-transparent rounded-full animate-spin"></div>
              <span>Loading reflection history...</span>
            </div>
          ) : completedThreads.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] text-center space-y-1.5">
              <p className="text-xs text-[var(--gv-text-secondary)] font-sans font-medium">No concluded reflections yet.</p>
              <p className="text-[11px] text-[var(--gv-text-tertiary)] max-w-sm mx-auto">
                When you conclude an active session, it will be safely archived here in your personal vault.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-[var(--gv-border-subtle)] rounded-2xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] overflow-hidden shadow-xs">
                {(showAllCompleted ? completedThreads : completedThreads.slice(0, 5)).map((thread) => (
                  <div key={thread.rootSessionId} className="p-4 hover:bg-[var(--gv-surface-raised)] transition">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => onResumeSession(thread.latest.id)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--gv-success)] shrink-0" />
                          <h3 className="text-sm font-medium text-[var(--gv-text-primary)] hover:text-[var(--gv-accent)] truncate">
                            {thread.latest.title || 'Concluded Reflection'}
                          </h3>
                        </div>

                        <div className="mt-1 text-[11px] text-[var(--gv-text-tertiary)] font-sans flex items-center gap-3">
                          <span>
                            {thread.reflectionCount === 1
                              ? '1 session'
                              : `${thread.reflectionCount} connected sessions`}
                          </span>
                          {thread.memoryCount > 0 && (
                            <span>
                              {thread.memoryCount} {thread.memoryCount === 1 ? 'memory' : 'memories'}
                            </span>
                          )}
                        </div>

                        {thread.memoryPreview.length > 0 && (
                          <div className="mt-2.5 space-y-1">
                            {thread.memoryPreview.map((memory) => (
                              <div
                                key={memory.id}
                                className="pl-3 border-l-2 border-[var(--gv-border-subtle)] text-[11px] text-[var(--gv-text-secondary)] truncate"
                              >
                                {memory.fact}
                              </div>
                            ))}
                          </div>
                        )}
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onResumeSession(thread.latest.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] text-xs font-medium transition cursor-pointer"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        {onContinueSession && (
                          <button
                            type="button"
                            id={`continue-thread-btn-${thread.latest.id}`}
                            onClick={() => onContinueSession(thread.latest.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--gv-accent-border)] bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] hover:opacity-90 text-xs font-medium transition cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Continue</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {completedThreads.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllCompleted((prev) => !prev)}
                  className="w-full pt-1 text-center text-[11px] font-medium text-[var(--gv-text-tertiary)] hover:text-[var(--gv-accent)] transition cursor-pointer"
                >
                  {showAllCompleted
                    ? 'Show recent 5 reflection threads'
                    : `View all ${completedThreads.length} reflection threads`}
                </button>
              )}
            </>
          )}
        </section>

        {/* 4. Grounded Ask My Vault Tool (Quiet Accordion Tool) */}
        <section className="rounded-2xl border border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)] overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setAskOpen((prev) => !prev)}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-[var(--gv-surface-raised)] transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent-gold)] flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-[var(--gv-text-primary)]">Ask My Vault</h2>
                <p className="text-xs text-[var(--gv-text-tertiary)] font-sans">
                  Query what your saved memories say over time with semantic attribution.
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-[var(--gv-text-tertiary)] transition-transform duration-200 ${askOpen ? 'rotate-180' : ''}`} />
          </button>

          {askOpen && (
            <div className="p-4 sm:p-5 border-t border-[var(--gv-border-subtle)] bg-[var(--gv-surface-base)] space-y-4">
              <form onSubmit={handleAskMyVault} className="space-y-3">
                <textarea
                  ref={askInputRef}
                  value={askQuestion}
                  onChange={(e) => setAskQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void handleAskMyVault(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="What have I been trying to improve lately?"
                  rows={2}
                  maxLength={1000}
                  className="w-full p-3.5 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] text-sm focus:outline-none focus:border-[var(--gv-accent)] resize-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] text-[var(--gv-text-tertiary)]">{askQuestion.length}/1000</span>
                  <button
                    type="submit"
                    disabled={!askQuestion.trim() || askingVault}
                    className="px-4 py-2 rounded-xl bg-[var(--gv-accent)] text-white hover:opacity-90 text-xs font-semibold disabled:opacity-40 transition cursor-pointer shadow-xs"
                  >
                    {askingVault ? 'Thinking…' : 'Ask Vault'}
                  </button>
                </div>
              </form>

              {askError && (
                <div className="p-3 rounded-xl bg-[var(--gv-error-muted)] border border-[var(--gv-error-border)] text-[var(--gv-error-text)] text-xs">
                  {askError}
                </div>
              )}

              {askAnswer && (
                <div className="rounded-2xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--gv-border-subtle)] flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--gv-text-tertiary)] font-semibold">Your question</div>
                      <p className="mt-1 text-sm text-[var(--gv-text-primary)] leading-relaxed whitespace-pre-wrap">{askedQuestion}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAskQuestion(askedQuestion);
                        requestAnimationFrame(() => askInputRef.current?.focus({ preventScroll: true }));
                      }}
                      className="shrink-0 text-[11px] text-[var(--gv-accent)] hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="p-4 font-serif text-[15px] leading-relaxed text-[var(--gv-text-primary)]">
                    <FormattedResponse content={askAnswer} />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
