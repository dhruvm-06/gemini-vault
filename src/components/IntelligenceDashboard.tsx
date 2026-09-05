import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Brain,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FormattedResponse } from './FormattedResponse';
import { JournalSession, Memory } from '../types';
import { toTimestamp } from '../utils/time';

type SessionRecord = JournalSession & {
  updatedAt?: string | { seconds?: number; _seconds?: number };
};

type Signal = {
  id: string;
  kind?: string;
  title: string;
  body: string;
  actionSessionId?: string;
  actionLabel?: string;
};

const toTime = toTimestamp;

const humanizeCategory = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const CountUpNumber: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return value;
    }
    return 0;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }
    if (value === 0) {
      setDisplayValue(0);
      return;
    }
    let startTime: number | null = null;
    const duration = 500;
    const startVal = 0;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startVal + (value - startVal) * easeOut));
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };
    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <span>{displayValue}</span>;
};

interface IntelligenceDashboardProps {
  onOpenSession: (sessionId: string) => void;
}

export const IntelligenceDashboard: React.FC<IntelligenceDashboardProps> = ({ onOpenSession }) => {
  const { getIdToken, user, userProfile } = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ask, setAsk] = useState('');
  const [answer, setAnswer] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [groundingSummary, setGroundingSummary] = useState<string | null>(null);
  const [groundingItems, setGroundingItems] = useState<Array<{
    id: string;
    category: string;
    fact: string;
    loopStatus?: string | null;
    createdAt?: string | null;
    sourceSnippet?: string | null;
  }>>([]);
  const [showEvidence, setShowEvidence] = useState<boolean>(
    () => userProfile?.preferences?.evidenceVisibility === 'expanded'
  );
  const [showWhatChangedEvidence, setShowWhatChangedEvidence] = useState(false);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalPreview, setSignalPreview] = useState<Signal[]>([]);
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    if (userProfile?.preferences?.evidenceVisibility) {
      setShowEvidence(userProfile.preferences.evidenceVisibility === 'expanded');
    }
  }, [userProfile?.preferences?.evidenceVisibility]);

  const askInputRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        askInputRef.current?.focus({ preventScroll: true });
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleFocusAsk = () => {
      askInputRef.current?.focus();
      askInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('gv-focus-ask-vault', handleFocusAsk);
    return () => window.removeEventListener('gv-focus-ask-vault', handleFocusAsk);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCore = async () => {
      setLoading(true);
      try {
        const token = await getIdToken();
        if (!token) {
          setLoading(false);
          setSignalsLoading(false);
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };

        // Start enrichment immediately, in parallel with the core data requests.
        const signalPromise = fetch('/api/memories/signals', { headers })
          .then((res) => res.json().catch(() => ({})))
          .then((data) => ({
            signals: Array.isArray(data.signals) ? data.signals.slice(0, 4) : [],
          }))
          .catch((error) => {
            console.warn('[IntelligenceDashboard] Signal enrichment failed:', error);
            return { signals: [] as Signal[] };
          });

        const cachedKey = user?.uid ? `gemini-vault:signals:${user.uid}` : null;
        if (cachedKey) {
          try {
            const raw = localStorage.getItem(cachedKey);
            if (raw) {
              const cached = JSON.parse(raw) as { timestamp?: number; signals?: Signal[] };
              if (
                Array.isArray(cached.signals) &&
                typeof cached.timestamp === 'number' &&
                Date.now() - cached.timestamp < 5 * 60 * 1000 &&
                !cancelled
              ) {
                setSignals(cached.signals.slice(0, 4));
                setSignalsLoading(false);
              }
            }
          } catch {
            // Cache failures must never affect the dashboard.
          }
        }

        const [sRes, mRes] = await Promise.all([
          fetch('/api/journal/sessions', { headers }),
          fetch('/api/memories', { headers }),
        ]);

        const [sData, mData] = await Promise.all([
          sRes.json().catch(() => ({})),
          mRes.json().catch(() => ({})),
        ]);

        if (!cancelled) {
          const nextSessions = Array.isArray(sData.sessions) ? sData.sessions : [];
          const nextMemories = Array.isArray(mData.memories) ? mData.memories : [];
          setSessions(nextSessions);
          setMemories(nextMemories);

          const loop = nextMemories.find((m: Memory) =>
            (m.category === 'goal' || m.category === 'commitment') &&
            (m as Memory & { loopStatus?: string }).loopStatus !== 'resolved'
          );
          const recurring = nextMemories.find((m: Memory) => m.category === 'recurring_theme');
          const preview: Signal[] = [];

          if (loop) {
            preview.push({
              id: 'preview-loop',
              kind: 'Open intention',
              title: 'Something is still open',
              body: loop.fact,
              actionSessionId: loop.sourceSessionId || undefined,
              actionLabel: 'Revisit reflection',
            });
          }
          if (recurring) {
            preview.push({
              id: 'preview-theme',
              kind: 'Recurring theme',
              title: 'A theme is returning',
              body: recurring.fact,
              actionSessionId: recurring.sourceSessionId || undefined,
              actionLabel: 'Open source',
            });
          }

          // Never hold the main page hostage to Gemini enrichment.
          setSignalPreview(preview.slice(0, 2));
          setLoading(false);
        }

        const result = await signalPromise;
        if (!cancelled) {
          setSignals(result.signals);
          if (result.signals.length) setSignalPreview([]);

          if (cachedKey && result.signals.length) {
            try {
              localStorage.setItem(
                cachedKey,
                JSON.stringify({ timestamp: Date.now(), signals: result.signals })
              );
            } catch {
              // Best-effort cache only.
            }
          }

          setSignalsLoading(false);
        }
      } catch (error) {
        console.error('[IntelligenceDashboard] load failed', error);
        if (!cancelled) {
          setLoading(false);
          setSignalsLoading(false);
        }
      }
    };

    void loadCore();
    return () => { cancelled = true; };
  }, [user?.uid]);  const days = range === '7d' ? 7 : 30;
  const cutoff = Date.now() - days * 86400000;
  const priorCutoff = Date.now() - 2 * days * 86400000;

  const recentSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed' && toTime(s.createdAt) >= cutoff).sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
    [sessions, cutoff]
  );
  const priorSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed' && toTime(s.createdAt) >= priorCutoff && toTime(s.createdAt) < cutoff),
    [sessions, priorCutoff, cutoff]
  );

  const recentMemories = useMemo(
    () => memories.filter((m) => toTime(m.createdAt) >= cutoff),
    [memories, cutoff]
  );
  const priorMemories = useMemo(
    () => memories.filter((m) => toTime(m.createdAt) >= priorCutoff && toTime(m.createdAt) < cutoff),
    [memories, priorCutoff, cutoff]
  );

  const sessionDelta = recentSessions.length - priorSessions.length;
  const memoryDelta = recentMemories.length - priorMemories.length;
  const activityDelta = recentSessions.length >= 2 ? recentSessions.length - 1 : 0;

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    recentMemories.forEach((memory) => counts.set(memory.category, (counts.get(memory.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [recentMemories]);

  const cadencePoints = useMemo(() => {
    const now = new Date();
    const points: { label: string; count: number }[] = [];
    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
        const dayEnd = dayStart + 86400000;
        const c = recentSessions.filter((s) => {
          const t = toTime(s.createdAt);
          return t >= dayStart && t < dayEnd;
        }).length;
        points.push({ label: day.toLocaleDateString('en-US', { weekday: 'narrow' }), count: c });
      }
    } else {
      for (let i = 3; i >= 0; i--) {
        const start = Date.now() - (i + 1) * 7 * 86400000;
        const end = Date.now() - i * 7 * 86400000;
        const c = recentSessions.filter((s) => {
          const t = toTime(s.createdAt);
          return t >= start && t < end;
        }).length;
        points.push({ label: `W${4 - i}`, count: c });
      }
    }
    return points;
  }, [recentSessions, range]);

  const maxCadence = Math.max(1, ...cadencePoints.map((p) => p.count));
  const memoryContextPct = memories.length > 0 ? Math.min(100, Math.max(8, Math.round((recentMemories.length / memories.length) * 100))) : 0;

  const askVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim() || asking) return;
    setAsking(true);
    setAnswer('');
    setGroundingSummary(null);
    setGroundingItems([]);
    setShowEvidence(false);
    askInputRef.current?.blur();
    const question = ask.trim();
    setAskedQuestion(question);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');
      const res = await fetch('/api/memories/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Unable to ask your Vault.');
      setAnswer(typeof data.answer === 'string' ? data.answer : 'Your Vault did not return an answer.');
      setGroundingSummary(typeof data.groundingSummary === 'string' ? data.groundingSummary : null);
      if (Array.isArray(data.grounding)) {
        setGroundingItems(data.grounding);
      } else {
        setGroundingItems([]);
      }
      setAsk('');
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : 'Unable to answer from your Vault.');
      setGroundingSummary(null);
      setGroundingItems([]);
    } finally {
      setAsking(false);
    }
  };
  const first = recentSessions[recentSessions.length - 1];
  const last = recentSessions[0];

  return (
    <div className="min-h-full bg-[var(--gv-surface-ground)] text-[var(--gv-text-primary)] transition-colors duration-150">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gv-accent-text)]">
              <Brain className="w-4 h-4" />
              <span>Vault Intelligence</span>
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif text-[var(--gv-text-primary)] tracking-tight">Make sense of what keeps returning.</h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-[var(--gv-text-secondary)]">
              Ask questions, inspect signals, and use your reflection history to notice patterns without turning your journal into a diagnosis engine.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-1 self-start shadow-xs">
            {(['7d', '30d'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  range === value
                    ? 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)] shadow-xs border border-[var(--gv-border-subtle)]'
                    : 'text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-secondary)]'
                }`}
              >
                {value === '7d' ? 'Last 7 days' : 'Last 30 days'}
              </button>
            ))}
          </div>
        </header>

        <div className="grid xl:grid-cols-[1.25fr_0.9fr_0.8fr] gap-5">
          <section className="rounded-2xl border border-[var(--gv-accent-border)] bg-[var(--gv-surface-base)] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-[var(--gv-accent-text)]">
                <MessageCircle className="w-4 h-4" />
                <h2 className="text-base font-semibold text-[var(--gv-text-primary)]">Ask My Vault</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">Grounded exclusively in what you explicitly chose to remember.</p>
              <form onSubmit={askVault} className="mt-4">
                <textarea
                  ref={askInputRef}
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (!asking && ask.trim()) void askVault(e);
                    }
                  }}
                  rows={4}
                  maxLength={1000}
                  placeholder="What have I been trying to change lately?"
                  className="w-full rounded-2xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] p-4 text-sm sm:text-[15px] text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)] focus:ring-1 focus:ring-[var(--gv-accent)]/30 resize-none transition-colors leading-relaxed"
                />
                <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--gv-text-tertiary)]">
                  <span>Press Enter to ask · Shift+Enter for new line</span>
                  <button
                    type="submit"
                    disabled={!ask.trim() || asking}
                    className="rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-stone-950 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {asking ? 'Consulting Vault…' : 'Ask Vault'}
                  </button>
                </div>
              </form>
            </div>

            {asking && (
              <div className="mt-4 rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)]/50 p-5 shadow-xs animate-pulse">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gv-accent-text)]">
                  <Sparkles className="w-4 h-4 text-[var(--gv-accent)]" />
                  <span>Synthesizing observations from your vault…</span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-2.5 bg-[var(--gv-surface-raised)] rounded-full w-4/5" />
                  <div className="h-2.5 bg-[var(--gv-surface-raised)] rounded-full w-2/3" />
                </div>
              </div>
            )}

            {answer && !asking && (
              <div className="mt-4 rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)]/40 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2 text-xs font-semibold text-[var(--gv-accent-text)]">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
                      <span>Vault Synthesis</span>
                      <span className="text-[var(--gv-text-muted)]">·</span>
                      <span className="text-xs font-normal text-[var(--gv-text-tertiary)]">
                        {groundingSummary || 'Grounded in approved memories'}
                      </span>
                      {groundingItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowEvidence((prev) => !prev)}
                          className="ml-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-secondary)] underline decoration-dotted underline-offset-2 transition-colors cursor-pointer"
                        >
                          {showEvidence ? 'Hide evidence' : `View evidence (${groundingItems.length})`}
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm sm:text-[15px] font-serif italic text-[var(--gv-text-primary)] leading-relaxed pl-3 border-l-2 border-[var(--gv-accent)]/60">
                      &ldquo;{askedQuestion}&rdquo;
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAsk(askedQuestion);
                      requestAnimationFrame(() => askInputRef.current?.focus({ preventScroll: true }));
                    }}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] hover:border-[var(--gv-border-default)] transition cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                {showEvidence && groundingItems.length > 0 && (
                  <div className="px-5 py-3 bg-[var(--gv-surface-ground)]/60 border-b border-[var(--gv-border-subtle)] text-xs text-[var(--gv-text-secondary)] space-y-2">
                    <div className="font-semibold text-[var(--gv-text-tertiary)] uppercase tracking-wider text-[10px]">
                      Authoritative Vault Sources
                    </div>
                    <ul className="space-y-2 pl-3 border-l border-[var(--gv-border-default)]">
                      {groundingItems.slice(0, 6).map((item) => (
                        <li key={item.id} className="leading-relaxed">
                          <span className="font-medium text-[var(--gv-text-primary)]">
                            {humanizeCategory(item.category)}
                            {item.loopStatus ? ` (${item.loopStatus})` : ''}:
                          </span>{' '}
                          <span>{item.fact}</span>
                          {item.sourceSnippet && (
                            <span className="block mt-0.5 italic text-[var(--gv-text-tertiary)] text-[11px]">
                              &ldquo;{item.sourceSnippet}&rdquo;
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-5 sm:p-6 text-sm sm:text-[15px] text-[var(--gv-text-primary)] leading-relaxed">
                  <FormattedResponse content={answer} />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-[var(--gv-text-primary)]">
                <Activity className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-semibold">Reflection activity</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">Cadence and memory integration across time.</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--gv-surface-ground)]/70 border border-[var(--gv-border-subtle)] p-3.5">
                  <div className="text-xs font-medium text-[var(--gv-text-tertiary)]">{range === '7d' ? 'This week' : 'This month'}</div>
                  <div className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[var(--gv-text-primary)]">
                    <CountUpNumber value={recentSessions.length} />
                  </div>
                  <div className="mt-1 text-xs text-[var(--gv-text-tertiary)]">completed reflections</div>
                </div>
                <div className="rounded-xl bg-[var(--gv-surface-ground)]/70 border border-[var(--gv-border-subtle)] p-3.5">
                  <div className="text-xs font-medium text-[var(--gv-text-tertiary)]">New context</div>
                  <div className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[var(--gv-text-primary)]">
                    <CountUpNumber value={recentMemories.length} />
                  </div>
                  <div className="mt-1 text-xs text-[var(--gv-text-tertiary)]">saved memories</div>
                </div>
              </div>

              {/* Micro Rhythm Cadence Bars */}
              <div className="mt-4 pt-3.5 border-t border-[var(--gv-border-subtle)]">
                <div className="flex items-center justify-between text-xs text-[var(--gv-text-secondary)] mb-2">
                  <span className="font-semibold">Session cadence</span>
                  <span className="text-xs text-[var(--gv-text-tertiary)]">
                    {recentSessions.length === 0 ? 'No sessions yet' : `${recentSessions.length} in ${days}d`}
                  </span>
                </div>
                <div className="flex items-end gap-1.5 h-12 px-2.5 py-1.5 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)]">
                  {cadencePoints.map((point, idx) => {
                    const heightPct = point.count > 0 ? Math.max(20, Math.round((point.count / maxCadence) * 100)) : 8;
                    const isFilled = point.count > 0;
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                        title={`${point.label}: ${point.count} session${point.count === 1 ? '' : 's'}`}
                      >
                        <div
                          className={`w-full rounded-xs transition-all duration-300 ${
                            isFilled
                              ? 'bg-[var(--gv-accent)] hover:opacity-90'
                              : 'bg-[var(--gv-border-default)]'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-[var(--gv-text-tertiary)] font-mono mt-1.5 px-0.5">
                  <span>{cadencePoints[0]?.label}</span>
                  <span>{cadencePoints[cadencePoints.length - 1]?.label}</span>
                </div>
              </div>

              {/* Memory Context Accumulation Meter */}
              <div className="mt-3.5 pt-3.5 border-t border-[var(--gv-border-subtle)]">
                <div className="flex items-center justify-between text-xs text-[var(--gv-text-secondary)] mb-1.5">
                  <span className="font-semibold">Vault context accumulation</span>
                  <span className="font-mono text-xs font-medium text-[var(--gv-accent-text)]">
                    {recentMemories.length} / {memories.length}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-500 dark:to-amber-400 transition-all duration-500"
                    style={{ width: `${memoryContextPct}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-[var(--gv-text-tertiary)]">
                  {memories.length === 0
                    ? 'No memories saved yet'
                    : `${memoryContextPct}% of your permanent vault context active in this window.`}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-[var(--gv-border-subtle)] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--gv-text-tertiary)]">Latest</span>
                <span className="text-[var(--gv-text-secondary)] font-medium truncate max-w-[12rem]">
                  {last?.title || 'No reflection yet'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--gv-text-tertiary)]">Earliest</span>
                <span className="text-[var(--gv-text-secondary)] font-medium truncate max-w-[12rem]">
                  {first?.title || 'No reflection yet'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--gv-text-tertiary)]">Return rate</span>
                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {activityDelta > 0 ? 'Active cadence' : 'Building rhythm'}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-[var(--gv-text-primary)]">
                <CalendarDays className="w-4 h-4 text-[var(--gv-text-muted)]" />
                <h2 className="text-base font-semibold">Your recent themes</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">Derived from active memory topics.</p>

              <div className="mt-4 space-y-3">
                {categoryCounts.length ? (
                  categoryCounts.map(([category, count]) => (
                    <div key={category}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--gv-text-secondary)] font-medium">{humanizeCategory(category)}</span>
                        <span className="text-[var(--gv-text-tertiary)] font-mono text-xs font-semibold">{count}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--gv-accent)] transition-all duration-500"
                          style={{ width: `${Math.max(8, Math.min(100, (count / (recentMemories.length || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--gv-border-default)] p-4 text-center">
                    <p className="text-xs text-[var(--gv-text-tertiary)] leading-relaxed">
                      As your Vault grows, recurring themes will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[var(--gv-accent-text)]">
                <Sparkles className="w-4 h-4 text-[var(--gv-accent)]" />
                <h2 className="text-base font-semibold text-[var(--gv-text-primary)]">Vault Signals</h2>
              </div>
              <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">Small, grounded observations worth noticing.</p>
            </div>
            <span className="text-xs text-[var(--gv-text-tertiary)] font-medium">
              {signalsLoading ? 'Updating…' : `${signals.length} available`}
            </span>
          </div>

          {signalsLoading && signalPreview.length > 0 ? (
            <div className="mt-5 transition-all duration-500 ease-out">
              <div className="mb-3 text-xs text-[var(--gv-text-tertiary)]">
                A quick preview while Gemini prepares deeper observations…
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {signalPreview.map((signal) => (
                  <div
                    key={signal.id}
                    className="rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)]/60 p-4 animate-[fadeIn_.35s_ease-out] shadow-2xs"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gv-text-tertiary)]">{signal.kind}</div>
                    <h3 className="mt-2 text-sm sm:text-[15px] font-serif font-medium text-[var(--gv-text-primary)]">{signal.title}</h3>
                    <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-[var(--gv-text-secondary)]">{signal.body}</p>
                    {signal.actionSessionId && (
                      <button
                        type="button"
                        onClick={() => onOpenSession(signal.actionSessionId!)}
                        className="mt-3 text-xs text-[var(--gv-accent-text)] hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        {signal.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : signalsLoading ? (
            <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-28 rounded-xl border border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)]/50 animate-pulse"
                />
              ))}
            </div>
          ) : signals.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--gv-border-default)] p-6 text-sm font-serif text-[var(--gv-text-tertiary)] text-center">
              Keep reflecting. Signals appear once there is enough context to support them.
            </div>
          ) : (
            <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)]/60 hover:border-[var(--gv-border-strong)] p-4 transition-colors shadow-2xs"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gv-accent-text)]">
                    {signal.kind || 'Observation'}
                  </div>
                  <h3 className="mt-2 text-sm sm:text-[15px] font-serif font-medium text-[var(--gv-text-primary)]">{signal.title}</h3>
                  <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-[var(--gv-text-secondary)]">{signal.body}</p>
                  {signal.actionSessionId && (
                    <button
                      type="button"
                      onClick={() => onOpenSession(signal.actionSessionId!)}
                      className="mt-3 text-xs text-[var(--gv-accent-text)] hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <span>{signal.actionLabel || 'Open reflection'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid lg:grid-cols-[1fr_1fr] gap-5">
          <div className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[var(--gv-text-primary)]">
                  <CircleAlert className="w-4 h-4 text-amber-500" />
                  <h2 className="text-base font-semibold">What Changed?</h2>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-tertiary)]">
                  {days}d window
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">
                Longitudinal comparative shifts across reflection windows.
              </p>

              {/* Longitudinal Comparison & Insufficiency Fallback */}
              {recentSessions.length < 2 ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)]/40 p-4 text-center">
                  <p className="text-xs text-[var(--gv-text-tertiary)] leading-relaxed">
                    Insufficient longitudinal context: at least 2 completed reflections across distinct times are required to identify meaningful shifts.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-[var(--gv-surface-ground)]/60 border border-[var(--gv-border-subtle)] p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-[var(--gv-text-tertiary)]">Reflection cadence</span>
                      {priorSessions.length > 0 && (
                        <span className={`text-[11px] font-semibold ${sessionDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                          {sessionDelta > 0 ? `+${sessionDelta} vs prior ${days}d` : sessionDelta < 0 ? `${sessionDelta} vs prior ${days}d` : `steady vs prior`}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-3xl font-serif font-semibold text-[var(--gv-text-primary)]">
                      <CountUpNumber value={recentSessions.length} />
                    </div>
                    <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-[var(--gv-text-secondary)]">
                      {sessionDelta > 0
                        ? `Reflection rhythm increased with ${sessionDelta} more session${sessionDelta === 1 ? '' : 's'} than the previous ${days} days.`
                        : sessionDelta < 0
                        ? `Reflection frequency settled (${Math.abs(sessionDelta)} fewer session${Math.abs(sessionDelta) === 1 ? '' : 's'} than previous ${days} days).`
                        : `You maintained a steady rhythm of ${recentSessions.length} sessions across both periods.`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-[var(--gv-surface-ground)]/40 border border-[var(--gv-border-subtle)]">
                      <div className="text-[11px] text-[var(--gv-text-tertiary)] font-medium">New Memories</div>
                      <div className="text-lg font-serif font-semibold text-[var(--gv-text-primary)] mt-0.5">
                        +{recentMemories.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--gv-surface-ground)]/40 border border-[var(--gv-border-subtle)]">
                      <div className="text-[11px] text-[var(--gv-text-tertiary)] font-medium">Active Focus</div>
                      <div className="text-xs font-serif font-semibold text-[var(--gv-text-primary)] mt-1 truncate">
                        {categoryCounts[0] ? humanizeCategory(categoryCounts[0][0]) : 'None yet'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Supporting Evidence Drawer / List */}
            {recentSessions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--gv-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowWhatChangedEvidence((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs text-[var(--gv-accent-text)] hover:underline font-semibold cursor-pointer py-1"
                >
                  <span>{showWhatChangedEvidence ? 'Hide supporting reflections' : `Inspect supporting reflections (${recentSessions.length})`}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showWhatChangedEvidence ? 'rotate-90' : ''}`} />
                </button>

                {showWhatChangedEvidence && (
                  <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {recentSessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => onOpenSession(session.id)}
                        className="w-full text-left rounded-xl border border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)]/40 hover:bg-[var(--gv-surface-ground)] hover:border-[var(--gv-border-default)] px-3 py-2 transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span className="text-xs text-[var(--gv-text-primary)] truncate font-serif font-medium">
                          {session.title || 'Reflection'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--gv-text-tertiary)] shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 text-[var(--gv-text-primary)]">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold">Weekly Review</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">A quick, deterministic snapshot before deeper synthesis.</p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-[var(--gv-surface-ground)]/60 border border-[var(--gv-border-subtle)] p-3.5 text-center sm:text-left">
                <div className="text-xs font-medium text-[var(--gv-text-tertiary)]">Explored</div>
                <div className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[var(--gv-text-primary)]">
                  <CountUpNumber value={recentSessions.length} />
                </div>
              </div>
              <div className="rounded-xl bg-[var(--gv-surface-ground)]/60 border border-[var(--gv-border-subtle)] p-3.5 text-center sm:text-left">
                <div className="text-xs font-medium text-[var(--gv-text-tertiary)]">Remembered</div>
                <div className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[var(--gv-text-primary)]">
                  <CountUpNumber value={recentMemories.length} />
                </div>
              </div>
              <div className="rounded-xl bg-[var(--gv-surface-ground)]/60 border border-[var(--gv-border-subtle)] p-3.5 text-center sm:text-left">
                <div className="text-xs font-medium text-[var(--gv-text-tertiary)]">Signals</div>
                <div className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[var(--gv-text-primary)]">
                  <CountUpNumber value={signals.length} />
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs sm:text-[13px] leading-relaxed text-[var(--gv-text-secondary)]">
              The full AI-written weekly review will be added once the reflection summary model and grounding contract are in place.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};