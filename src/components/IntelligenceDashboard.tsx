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

interface IntelligenceDashboardProps {
  onOpenSession: (sessionId: string) => void;
}

export const IntelligenceDashboard: React.FC<IntelligenceDashboardProps> = ({ onOpenSession }) => {
  const { getIdToken, user } = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ask, setAsk] = useState('');
  const [answer, setAnswer] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalPreview, setSignalPreview] = useState<Signal[]>([]);
  const [range, setRange] = useState<'7d' | '30d'>('7d');

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
  const recentSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed' && toTime(s.createdAt) >= cutoff).sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
    [sessions, cutoff]
  );
  const recentMemories = useMemo(
    () => memories.filter((m) => toTime(m.createdAt) >= cutoff),
    [memories, cutoff]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    recentMemories.forEach((memory) => counts.set(memory.category, (counts.get(memory.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [recentMemories]);

  const askVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim() || asking) return;
    setAsking(true);
    setAnswer('');
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
      setAsk('');
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : 'Unable to answer from your Vault.');
    } finally {
      setAsking(false);
    }
  };
  const first = recentSessions[recentSessions.length - 1];
  const last = recentSessions[0];
  const activityDelta = recentSessions.length >= 2 ? recentSessions.length - 1 : 0;

  return (
    <div className="min-h-full bg-stone-900 text-stone-100">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-amber-300 font-medium">
              <Brain className="w-3.5 h-3.5" />
              Vault Intelligence
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif text-stone-100">Make sense of what keeps returning.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
              Ask questions, inspect signals, and use your reflection history to notice patterns without turning your journal into a diagnosis engine.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-stone-800 bg-stone-950 p-1 self-start">
            {(['7d', '30d'] as const).map((value) => (
              <button key={value} type="button" onClick={() => setRange(value)} className={`px-3 py-1.5 rounded-lg text-xs ${range === value ? 'bg-stone-800 text-stone-100' : 'text-stone-600 hover:text-stone-300'}`}>
                {value === '7d' ? 'Last 7 days' : 'Last 30 days'}
              </button>
            ))}
          </div>
        </header>

        <div className="grid xl:grid-cols-[1.25fr_0.9fr_0.8fr] gap-4">
          <section className="rounded-2xl border border-amber-500/20 bg-stone-950 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-amber-300">
              <MessageCircle className="w-4 h-4" />
              <h2 className="text-sm font-medium">Ask My Vault</h2>
            </div>
            <p className="mt-1 text-xs text-stone-500">Use only what you explicitly chose to remember.</p>
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
                className="w-full rounded-2xl bg-stone-900 border border-stone-800 p-4 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/40 resize-none"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-stone-600">
                <span>Enter to ask · Shift+Enter for a new line</span>
                <button type="submit" disabled={!ask.trim() || asking} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-stone-950 disabled:opacity-40">
                  {asking ? 'Thinking…' : 'Ask Vault'}
                </button>
              </div>
            </form>
            {answer && (
              <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-800/80 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-stone-600">Your question</div>
                    <p className="mt-1 text-sm text-stone-200 leading-6 whitespace-pre-wrap">{askedQuestion}</p>
                  </div>
                  <button type="button" onClick={() => { setAsk(askedQuestion); requestAnimationFrame(() => askInputRef.current?.focus({ preventScroll: true })); }} className="shrink-0 text-[11px] text-stone-500 hover:text-amber-300">Edit</button>
                </div>
                <div className="p-4 sm:p-5"><FormattedResponse content={answer} /></div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
            <div className="flex items-center gap-2 text-stone-200">
              <Activity className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-medium">Reflection activity</h2>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-3">
                <div className="text-[10px] text-stone-600">{range === '7d' ? 'This week' : 'This month'}</div>
                <div className="mt-1 text-2xl font-semibold text-stone-100">{recentSessions.length}</div>
                <div className="mt-1 text-[10px] text-stone-600">completed reflections</div>
              </div>
              <div className="rounded-xl bg-stone-900/60 border border-stone-800 p-3">
                <div className="text-[10px] text-stone-600">New context</div>
                <div className="mt-1 text-2xl font-semibold text-stone-100">{recentMemories.length}</div>
                <div className="mt-1 text-[10px] text-stone-600">saved memories</div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-xs"><span className="text-stone-500">Latest</span><span className="text-stone-300 truncate max-w-[12rem]">{last?.title || 'No reflection yet'}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-stone-500">Earliest</span><span className="text-stone-300 truncate max-w-[12rem]">{first?.title || 'No reflection yet'}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-stone-500">Return rate</span><span className="text-emerald-400 inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" />{activityDelta > 0 ? 'Active' : 'Building'}</span></div>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
            <div className="flex items-center gap-2 text-stone-200">
              <CalendarDays className="w-4 h-4 text-stone-500" />
              <h2 className="text-sm font-medium">Your recent themes</h2>
            </div>
            <div className="mt-5 space-y-3">
              {categoryCounts.length ? categoryCounts.map(([category, count]) => (
                <div key={category}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">{humanizeCategory(category)}</span>
                    <span className="text-stone-600">{count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-stone-900 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500/70" style={{ width: `${Math.max(8, Math.min(100, count * 25))}%` }} />
                  </div>
                </div>
              )) : <p className="text-xs text-stone-600">As your Vault grows, recurring themes will appear here.</p>}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-stone-800 bg-stone-950 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-300">
                <Sparkles className="w-4 h-4" />
                <h2 className="text-sm font-medium">Vault Signals</h2>
              </div>
              <p className="mt-1 text-xs text-stone-500">Small, grounded observations worth noticing.</p>
            </div>
            <span className="text-[11px] text-stone-500">{signalsLoading ? 'Updating…' : `${signals.length} available`}</span>
          </div>

          {signalsLoading && signalPreview.length > 0 ? (
            <div className="mt-5 transition-all duration-500 ease-out">
              <div className="mb-3 text-[11px] text-stone-600">A quick preview while Gemini prepares deeper observations…</div>
              <div className="grid md:grid-cols-2 gap-3">
                {signalPreview.map((signal) => (
                  <div key={signal.id} className="rounded-xl border border-stone-800 bg-stone-900/45 p-4 animate-[fadeIn_.35s_ease-out]">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-stone-600">{signal.kind}</div>
                    <h3 className="mt-2 text-sm font-medium text-stone-100">{signal.title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-stone-500">{signal.body}</p>
                    {signal.actionSessionId && <button type="button" onClick={() => onOpenSession(signal.actionSessionId!)} className="mt-3 text-[11px] text-stone-500 hover:text-amber-300">{signal.actionLabel}</button>}
                  </div>
                ))}
              </div>
            </div>
          ) : signalsLoading ? (
            <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              {[1,2,3,4].map((n) => <div key={n} className="h-28 rounded-xl border border-stone-800 bg-stone-900/45 animate-pulse" />)}
            </div>
          ) : signals.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-stone-800 p-6 text-sm font-serif text-stone-500">
              Keep reflecting. Signals appear once there is enough context to support them.
            </div>
          ) : (
            <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              {signals.map((signal) => (
                <div key={signal.id} className="rounded-xl border border-stone-800 bg-stone-900/45 p-4">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-amber-300/80">{signal.kind || 'Observation'}</div>
                  <h3 className="mt-2 text-sm font-medium text-stone-100">{signal.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-stone-500">{signal.body}</p>
                  {signal.actionSessionId && (
                    <button type="button" onClick={() => onOpenSession(signal.actionSessionId!)} className="mt-3 text-[11px] text-stone-500 hover:text-amber-300 inline-flex items-center gap-1">
                      {signal.actionLabel || 'Open reflection'} <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid lg:grid-cols-[1fr_1fr] gap-4">
          <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
            <div className="flex items-center gap-2 text-stone-200">
              <CircleAlert className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-medium">What Changed?</h2>
            </div>
            <p className="mt-1 text-xs text-stone-500">A grounded starting point for longitudinal comparison.</p>
            <div className="mt-4 rounded-xl bg-stone-900/50 border border-stone-800 p-4">
              <div className="text-xs text-stone-500">Recent reflection cadence</div>
              <div className="mt-2 text-2xl font-semibold text-stone-100">{recentSessions.length}</div>
              <p className="mt-1.5 text-xs leading-5 text-stone-500">
                {recentSessions.length > 1
                  ? `You returned to your reflection space ${recentSessions.length} times in this ${days}-day window.`
                  : 'There is not enough recent activity to describe a meaningful shift yet.'}
              </p>
            </div>
            {recentSessions.slice(0, 3).map((session) => (
              <button key={session.id} type="button" onClick={() => onOpenSession(session.id)} className="mt-2 w-full text-left rounded-xl border border-stone-800 bg-stone-900/25 px-3 py-2.5 hover:border-stone-700 flex items-center justify-between">
                <span className="text-xs text-stone-300 truncate">{session.title || 'Reflection'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-600" />
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-950 p-5">
            <div className="flex items-center gap-2 text-stone-200">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-medium">Weekly Review</h2>
            </div>
            <p className="mt-1 text-xs text-stone-500">A quick, deterministic snapshot before we add deeper synthesis.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-stone-900/50 border border-stone-800 p-3">
                <div className="text-[10px] text-stone-600">Explored</div>
                <div className="mt-1 text-xl font-semibold">{recentSessions.length}</div>
              </div>
              <div className="rounded-xl bg-stone-900/50 border border-stone-800 p-3">
                <div className="text-[10px] text-stone-600">Remembered</div>
                <div className="mt-1 text-xl font-semibold">{recentMemories.length}</div>
              </div>
              <div className="rounded-xl bg-stone-900/50 border border-stone-800 p-3">
                <div className="text-[10px] text-stone-600">Signals</div>
                <div className="mt-1 text-xl font-semibold">{signals.length}</div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-stone-500">
              The full AI-written weekly review will be added once the reflection summary model and grounding contract are in place.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};