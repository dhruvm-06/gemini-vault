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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormattedResponse } from './FormattedResponse';
import { JournalSession, Memory } from '../types';

type SessionRecord = JournalSession & {
  rootSessionId?: string;
  continuedFromSessionId?: string | null;
  updatedAt?: string | { seconds?: number; _seconds?: number };
  endedAt?: string | { seconds?: number; _seconds?: number };
};

interface JournalHomeProps {
  onStartNewSession: (initialText?: string) => Promise<void>;
  onResumeSession: (sessionId: string) => void;
  isCreating: boolean;
}

export const JournalHome: React.FC<JournalHomeProps> = ({
  onStartNewSession,
  onResumeSession,
  isCreating,
}) => {
  const { getIdToken, user } = useAuth();
  const [initialThought, setInitialThought] = useState('');
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

  const starterPrompts = [
    'I need to make a decision.',
    'Something has been on my mind lately.',
    'I feel stuck on something.',
    'I want to plan ahead.',
    'I want to make sense of this week.',
  ];

  const useStarterPrompt = (prompt: string) => {
    setInitialThought(prompt);
    requestAnimationFrame(() => {
      document.getElementById('initial-thought')?.focus();
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
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
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

  const toTime = (value: unknown): number => {
    if (!value) return 0;
    if (typeof value === 'string') return new Date(value).getTime() || 0;
    if (typeof value === 'object' && value !== null) {
      const candidate = value as { seconds?: number; _seconds?: number };
      const seconds = candidate.seconds ?? candidate._seconds;
      return typeof seconds === 'number' ? seconds * 1000 : 0;
    }
    return 0;
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => toTime((b as SessionRecord).updatedAt || (b as SessionRecord).createdAt) -
      toTime((a as SessionRecord).updatedAt || (a as SessionRecord).createdAt)
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
        .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
        .slice(0, 2),
    }))
    .sort((a, b) => toTime(b.latest.updatedAt || b.latest.createdAt) - toTime(a.latest.updatedAt || a.latest.createdAt));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Command Center */}
      <section className="relative overflow-hidden rounded-3xl border border-stone-800 bg-stone-950 shadow-2xl">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Private Reflective Companion</span>
            </div>

            <div className="hidden sm:flex items-center gap-4 text-[11px] text-stone-500">
              <span>{activeSessions.length} active</span>
              <span>{completedThreads.length} threads</span>
              <span>{memories.length} memories</span>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-serif text-stone-100 font-normal tracking-tight leading-[1.08]">
              Think freely.
              <br />
              <span className="text-stone-400">Remember what matters.</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-stone-400 max-w-xl font-sans leading-relaxed">
              Reflect with Gemini, keep the insights you choose, and return to ideas that still matter.
            </p>
          </div>

          <form onSubmit={handleStartSubmit} className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="initial-thought" className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                Start a new reflection
              </label>
              <span className="text-xs text-stone-500">Enter to begin · Shift+Enter for a new line</span>
            </div>

            <div className="relative">
              <textarea
                id="initial-thought"
                value={initialThought}
                onChange={(e) => setInitialThought(e.target.value)}
                placeholder="What is currently on your mind?"
                rows={3}
                className="w-full p-4 pr-32 rounded-2xl bg-stone-900/80 border border-stone-800 text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition resize-none font-sans leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isCreating) {
                      onStartNewSession(initialThought.trim());
                    }
                  }
                }}
              />

              <button
                type="submit"
                disabled={isCreating || !initialThought.trim()}
                id="start-reflection-btn"
                className="absolute right-3 bottom-3 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center space-x-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
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

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[11px] text-stone-500 mr-1 py-1">Try starting with:</span>
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => useStarterPrompt(prompt)}
                  className="rounded-full border border-stone-800 bg-stone-900/60 px-3 py-1.5 text-[11px] text-stone-400 hover:text-stone-100 hover:border-stone-700 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-stone-600">
              <span>Encrypted in transit</span>
              <span>·</span>
              <span>User-isolated storage</span>
            </div>
          </form>
        </div>
      </section>

      {/* Vault Tools */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setAskOpen((prev) => !prev)}
          className="group text-left p-4 rounded-2xl border border-amber-500/25 bg-stone-950 hover:bg-stone-900 hover:border-amber-500/45 transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <Brain className="w-4 h-4" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-stone-100">Ask My Vault</h2>
            <ChevronDown className={`w-3.5 h-3.5 text-stone-600 transition-transform ${askOpen ? 'rotate-180' : ''}`} />
          </div>
          <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
            Ask what your saved memories say over time.
          </p>
        </button>

        <button
          type="button"
          onClick={() => document.getElementById('vault-memories-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="group text-left p-4 rounded-2xl border border-stone-800 bg-stone-950 hover:bg-stone-900 hover:border-stone-700 transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 flex items-center justify-center mb-3">
            <Bookmark className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-medium text-stone-100">Vault Memories</h2>
          <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
            {memories.length} saved · chosen by you.
          </p>
        </button>

        <button
          type="button"
          onClick={() => document.getElementById('reflection-threads-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="group text-left p-4 rounded-2xl border border-stone-800 bg-stone-950 hover:bg-stone-900 hover:border-stone-700 transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 flex items-center justify-center mb-3">
            <Layers3 className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-medium text-stone-100">Reflection Threads</h2>
          <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
            {completedThreads.length} connected threads.
          </p>
        </button>

        <button
          type="button"
          onClick={() => document.getElementById('open-loops-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="group text-left p-4 rounded-2xl border border-stone-800 bg-stone-950 hover:bg-stone-900 hover:border-stone-700 transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 flex items-center justify-center mb-3">
            <Target className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-medium text-stone-100">Open Loops</h2>
          <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
            Goals and commitments worth revisiting.
          </p>
        </button>
      </section>

      {/* Ask My Vault */}
      {askOpen && (
        <section className="rounded-2xl border border-amber-500/20 bg-stone-950/90 p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-stone-100">Ask My Vault</h2>
              <p className="mt-1 text-[11px] text-stone-500">
                Answers are grounded in the memories you explicitly saved.
              </p>
            </div>
          </div>

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
              className="w-full p-3.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:border-amber-500/50 resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-stone-600">{askQuestion.length}/1000</span>
              <button
                type="submit"
                disabled={!askQuestion.trim() || askingVault}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold disabled:opacity-40 transition"
              >
                {askingVault ? 'Thinking…' : 'Ask Vault'}
              </button>
            </div>
          </form>

          {askError && (
            <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
              {askError}
            </div>
          )}

          {askAnswer && (
            <div className="mt-4 rounded-2xl bg-stone-900/70 border border-stone-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-800/80 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-stone-600">Your question</div>
                  <p className="mt-1 text-sm text-stone-200 leading-6 whitespace-pre-wrap">{askedQuestion}</p>
                </div>
                <button type="button" onClick={() => { setAskQuestion(askedQuestion); requestAnimationFrame(() => askInputRef.current?.focus({ preventScroll: true })); }} className="shrink-0 text-[11px] text-stone-500 hover:text-amber-300">Edit</button>
              </div>
              <div className="p-4">
                <FormattedResponse content={askAnswer} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Active & Resumable Sessions */}
      {activeSessions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Active Reflections in Progress</span>
            </h2>
            <span className="text-xs text-stone-500">{activeSessions.length} active</span>
          </div>

          <div className="space-y-3">
            {(showAllActive ? activeSessions : activeSessions.slice(0, 3)).map((session) => (
              <div
                key={session.id}
                onClick={() => onResumeSession(session.id)}
                className="p-4 sm:p-5 rounded-xl bg-stone-950 hover:bg-stone-900 border border-amber-500/30 hover:border-amber-500/50 transition cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1.5 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <h3 className="text-sm font-medium text-stone-100 group-hover:text-amber-300 transition">
                      {session.title || 'Untitled Reflection'}
                    </h3>
                  </div>
                  {session.draftContent && (
                    <p className="text-xs text-stone-400 truncate max-w-md font-sans">
                      {session.draftContent}
                    </p>
                  )}
                  <div className="text-[11px] text-stone-500 font-sans flex items-center space-x-3">
                    <span>Active Session</span>
                    {session.wordCount ? <span>&bull; ~{session.wordCount} words</span> : null}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-medium text-amber-400 group-hover:translate-x-1 transition-transform shrink-0">
                  <span>Resume</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>

          {activeSessions.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllActive((prev) => !prev)}
              className="w-full pt-1 text-center text-[11px] font-medium text-stone-500 hover:text-amber-300 transition cursor-pointer"
            >
              {showAllActive
                ? 'Show fewer active reflections'
                : `View all ${activeSessions.length} active reflections`}
            </button>
          )}
        </section>
      )}

      {/* Vault Memories */}
      <section id="vault-memories-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Vault Memories</span>
          </h2>
          {memories.length > 0 && (
            <span className="text-xs text-stone-500">
              {memories.length} saved
            </span>
          )}
        </div>

        {loadingMemories ? (
          <div className="p-6 rounded-xl bg-stone-950/40 border border-stone-800/60 text-center text-stone-500 text-xs font-sans">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <span>Loading Vault memories...</span>
          </div>
        ) : memories.length === 0 ? (
          <div className="p-6 rounded-xl bg-stone-950/40 border border-stone-800/60 text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
              <Bookmark className="w-4 h-4" />
            </div>
            <p className="text-xs text-stone-300 font-medium">
              Your Vault is ready to remember.
            </p>
            <p className="text-[11px] text-stone-500 max-w-md mx-auto">
              After a reflection, Gemini may suggest durable goals, projects, preferences, or commitments for you to keep.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(showAllMemories ? memories : memories.slice(0, 3)).map((memory) => {
              const categoryLabel = memory.category.replace('_', ' ');

              return (
                <div
                  key={memory.id}
                  className="p-4 rounded-xl bg-stone-950 border border-stone-800 hover:border-stone-700 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-amber-400/90 font-semibold">
                        {categoryLabel}
                      </div>
                      <p className="text-sm font-serif text-stone-200 leading-relaxed">
                        {memory.fact}
                      </p>
                    </div>
                    <Bookmark className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                  </div>
                  {memory.userNotes && (
                    <p className="mt-2 text-[11px] text-stone-500 italic truncate">
                      {memory.userNotes}
                    </p>
                  )}
                </div>
              );
            })}

            {memories.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllMemories((prev) => !prev)}
                className="w-full pt-1 text-center text-[11px] font-medium text-stone-500 hover:text-amber-300 transition cursor-pointer"
              >
                {showAllMemories
                  ? 'Show recent 3 memories'
                  : `View all ${memories.length} memories`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Open Loops */}
      {memories.filter((memory) => memory.category === 'goal' || memory.category === 'commitment').length > 0 && (
        <section id="open-loops-section" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5" />
              <span>Open Loops</span>
            </h2>
            <span className="text-xs text-stone-500">
              {memories.filter((memory) => memory.category === 'goal' || memory.category === 'commitment').length} to revisit
            </span>
          </div>

          <div className="grid gap-2.5">
            {memories
              .filter((memory) => memory.category === 'goal' || memory.category === 'commitment')
              .slice(0, 3)
              .map((memory) => (
                <div key={memory.id} className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-amber-400/80 font-semibold">
                      {memory.category}
                    </div>
                    <p className="mt-1 text-sm font-serif text-stone-200 leading-relaxed">{memory.fact}</p>
                  </div>
                  <Bookmark className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Completed Reflection History */}
      <section id="reflection-threads-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Past Reflections</span>
          </h2>
          {completedThreads.length > 0 && (
            <span className="text-xs text-stone-500">
              {completedSessionRecords.length} sessions · {completedThreads.length} threads
            </span>
          )}
        </div>

        {loadError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{loadError}</span>
          </div>
        )}

        {loadingSessions ? (
          <div className="p-8 text-center text-stone-500 text-xs font-sans flex flex-col items-center justify-center space-y-2">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading reflection vault...</span>
          </div>
        ) : completedThreads.length === 0 ? (
          <div className="p-8 rounded-xl bg-stone-950/40 border border-stone-800/60 text-center space-y-2">
            <p className="text-xs text-stone-400 font-sans">No concluded reflections yet.</p>
            <p className="text-[11px] text-stone-500">
              When you conclude an active session, it will be safely archived here in your personal vault.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-stone-800/80 rounded-xl bg-stone-950 border border-stone-800 overflow-hidden">
              {(showAllCompleted ? completedThreads : completedThreads.slice(0, 5)).map((thread) => (
                <div
                  key={thread.rootSessionId}
                  className="p-4 hover:bg-stone-900/60 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => onResumeSession(thread.latest.id)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                        <h3 className="text-sm font-medium text-stone-200 hover:text-stone-100">
                          {thread.latest.title || 'Concluded Reflection'}
                        </h3>
                      </div>

                      <div className="mt-1.5 text-[11px] text-stone-500 font-sans flex flex-wrap items-center gap-x-3 gap-y-1">
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
                        <div className="mt-3 space-y-1.5">
                          {thread.memoryPreview.map((memory) => (
                            <div
                              key={memory.id}
                              className="pl-3 border-l border-stone-800 text-[11px] text-stone-400"
                            >
                              <span className="text-amber-400/80 uppercase tracking-wider text-[9px] font-semibold">
                                {memory.category.replace('_', ' ')}
                              </span>
                              <p className="mt-0.5 truncate">{memory.fact}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onResumeSession(thread.latest.id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:text-amber-300 hover:border-amber-500/40 text-xs font-medium transition cursor-pointer"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {thread.latest.id && (
                        <span className="text-[10px] text-stone-600">
                          Latest session
                        </span>
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
                className="w-full pt-1 text-center text-[11px] font-medium text-stone-500 hover:text-amber-300 transition cursor-pointer"
              >
                {showAllCompleted
                  ? 'Show recent 5 reflection threads'
                  : `View all ${completedThreads.length} reflection threads`}
              </button>
            )}
          </>
        )}
      </section>

    </div>
  );
};
