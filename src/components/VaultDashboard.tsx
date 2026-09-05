import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Clock3,
  Compass,
  Edit2,
  Edit3,
  Search,
  Target,
  X,
  RotateCcw,
  Archive,
  Sparkles,
  Calendar,
  History,
  ExternalLink,
  Bell,
  Check,
  PanelRight,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JournalSession, Memory, MemoryCategory, MemoryEvolutionRecord } from '../types';
import { toTimestamp } from '../utils/time';

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

type SessionRecord = JournalSession & {
  rootSessionId?: string;
  continuedFromSessionId?: string | null;
  updatedAt?: string | { seconds?: number; _seconds?: number };
};

type VaultMemory = Memory & {
  loopStatus?: 'open' | 'snoozed' | 'resolved';
  snoozedUntil?: string | null;
  updatedAt?: string | null;
  sourceMessageId?: string | null;
  sourceSnippet?: string | null;
  sourceModality?: 'text' | 'voice';
  turnTimestamp?: string | null;
  evolutionStatus?: 'active' | 'reinforced' | 'evolved' | 'superseded';
  supersedesMemoryId?: string | null;
  supersededByMemoryId?: string | null;
  evolutionHistory?: MemoryEvolutionRecord[];
};

interface VaultDashboardProps {
  onOpenSession: (sessionId: string, turnId?: string) => void;
  onContinueSession: (sessionId: string) => Promise<void>;
}

const toTime = toTimestamp;

const categoryLabel = (category: string) =>
  category.replace(/_/g, ' ').replace(/ \w/g, (c) => c.toUpperCase());

export const VaultDashboard: React.FC<VaultDashboardProps> = ({
  onOpenSession,
  onContinueSession,
}) => {
  const { getIdToken } = useAuth();
  const [memories, setMemories] = useState<VaultMemory[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'memory' | 'loop' | 'evolution' | 'archived'>('all');
  const [loopsSubFilter, setLoopsSubFilter] = useState<'all_loops' | 'open' | 'snoozed' | 'resolved'>('open');
  const [editing, setEditing] = useState<VaultMemory | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [snoozingMemory, setSnoozingMemory] = useState<VaultMemory | null>(null);
  const [customSnoozeDate, setCustomSnoozeDate] = useState('');
  const [isRailOpen, setIsRailOpen] = useState(false);
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('preference');
  const [newUserNotes, setNewUserNotes] = useState('');
  const [newImportance, setNewImportance] = useState<number>(0.5);
  const [creatingMemory, setCreatingMemory] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleSaveNewMemory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedFact = newFact.trim();
    if (!trimmedFact) {
      setCreateError('Memory statement cannot be empty.');
      return;
    }
    if (trimmedFact.length > 500) {
      setCreateError('Memory exceeds 500 characters limit.');
      return;
    }

    setCreatingMemory(true);
    setCreateError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceType: 'manual',
          fact: trimmedFact,
          category: newCategory,
          userNotes: newUserNotes.trim(),
          importance: newImportance,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save personal memory.');
      }

      if (data.memory) {
        setMemories((prev) => [data.memory, ...prev]);
      }
      setIsCreatingMemory(false);
      setNewFact('');
      setNewCategory('preference');
      setNewUserNotes('');
      setNewImportance(0.5);
      setMessage('Personal memory saved to your vault.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      console.error('[VaultDashboard] Failed to create memory:', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to save personal memory.');
    } finally {
      setCreatingMemory(false);
    }
  };

  // Allow AppShell Topbar trigger to toggle this Vault overlay rail
  useEffect(() => {
    const handleToggle = () => setIsRailOpen((prev) => !prev);
    window.addEventListener('gv-toggle-vault-rail', handleToggle);
    return () => window.removeEventListener('gv-toggle-vault-rail', handleToggle);
  }, []);

  // Allow Command Palette or external trigger to open Direct Memory Creation Modal
  useEffect(() => {
    const handleOpenNew = () => setIsCreatingMemory(true);
    window.addEventListener('gv-open-new-memory', handleOpenNew);
    return () => window.removeEventListener('gv-open-new-memory', handleOpenNew);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRailOpen) {
        setIsRailOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRailOpen]);

  const load = async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const [memoryRes, sessionRes] = await Promise.all([
        fetch('/api/memories', { headers }),
        fetch('/api/journal/sessions', { headers }),
      ]);

      const memoryData = await memoryRes.json().catch(() => ({}));
      const sessionData = await sessionRes.json().catch(() => ({}));

      setMemories(
        (Array.isArray(memoryData.memories) ? memoryData.memories : [])
          .sort((a: VaultMemory, b: VaultMemory) => toTime(b.createdAt) - toTime(a.createdAt))
      );
      setSessions(
        (Array.isArray(sessionData.sessions) ? sessionData.sessions : [])
          .sort((a: SessionRecord, b: SessionRecord) =>
            toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt)
          )
      );
    } catch (error) {
      console.error('[VaultDashboard] load failed', error);
      setMessage('Unable to refresh your Vault right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeMemories = useMemo(
    () => memories.filter((m) => m.memoryStatus !== 'archived' && m.evolutionStatus !== 'superseded'),
    [memories]
  );

  const activeLoopMemories = useMemo(
    () => memories.filter((m) =>
      (m.category === 'goal' || m.category === 'commitment') &&
      (m.loopStatus === 'open' || (!m.loopStatus && m.memoryStatus !== 'archived'))
    ),
    [memories]
  );

  const snoozedLoopMemories = useMemo(
    () => memories.filter((m) =>
      (m.category === 'goal' || m.category === 'commitment') &&
      m.loopStatus === 'snoozed'
    ),
    [memories]
  );

  const resolvedLoopMemories = useMemo(
    () => memories.filter((m) =>
      (m.category === 'goal' || m.category === 'commitment') &&
      m.loopStatus === 'resolved'
    ),
    [memories]
  );

  const totalLoopsCount = activeLoopMemories.length + snoozedLoopMemories.length + resolvedLoopMemories.length;

  const evolvedMemories = useMemo(
    () => memories.filter((m) =>
      m.evolutionStatus === 'evolved' ||
      m.evolutionStatus === 'superseded' ||
      m.evolutionStatus === 'reinforced' ||
      Boolean(m.supersedesMemoryId) ||
      (Array.isArray(m.evolutionHistory) && m.evolutionHistory.length > 0)
    ),
    [memories]
  );

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );

  const sevenDaysAgo = useMemo(() => Date.now() - 7 * 86400000, []);

  const recentMemories7d = useMemo(
    () => activeMemories.filter((m) => toTime(m.createdAt) >= sevenDaysAgo),
    [activeMemories, sevenDaysAgo]
  );

  const recentSessions7d = useMemo(
    () => completedSessions.filter((s) => toTime(s.createdAt) >= sevenDaysAgo),
    [completedSessions, sevenDaysAgo]
  );

  const dailyReflectionCounts = useMemo(() => {
    const counts: { dayLabel: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const daySessions = completedSessions.filter((s) => {
        const t = toTime(s.createdAt);
        return t >= dayStart && t < dayEnd;
      });
      const label = day.toLocaleDateString('en-US', { weekday: 'narrow' });
      counts.push({ dayLabel: label, count: daySessions.length });
    }
    return counts;
  }, [completedSessions]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return memories.filter((memory) => {
      const isLoop = memory.category === 'goal' || memory.category === 'commitment';
      let matchesFilter = true;

      if (activeFilter === 'all') {
        matchesFilter = memory.memoryStatus !== 'archived' && memory.evolutionStatus !== 'superseded';
      } else if (activeFilter === 'memory') {
        matchesFilter = !isLoop && memory.memoryStatus !== 'archived' && memory.evolutionStatus !== 'superseded';
      } else if (activeFilter === 'loop') {
        if (!isLoop) return false;
        if (loopsSubFilter === 'open') {
          matchesFilter = memory.loopStatus === 'open' || (!memory.loopStatus && memory.memoryStatus !== 'archived');
        } else if (loopsSubFilter === 'snoozed') {
          matchesFilter = memory.loopStatus === 'snoozed';
        } else if (loopsSubFilter === 'resolved') {
          matchesFilter = memory.loopStatus === 'resolved';
        } else {
          matchesFilter = true;
        }
      } else if (activeFilter === 'evolution') {
        matchesFilter =
          memory.evolutionStatus === 'evolved' ||
          memory.evolutionStatus === 'superseded' ||
          memory.evolutionStatus === 'reinforced' ||
          Boolean(memory.supersedesMemoryId) ||
          (Array.isArray(memory.evolutionHistory) && memory.evolutionHistory.length > 0);
      } else if (activeFilter === 'archived') {
        matchesFilter = memory.memoryStatus === 'archived' || memory.evolutionStatus === 'superseded';
      }

      const matchesQuery =
        !text ||
        `${memory.fact} ${memory.category} ${memory.userNotes || ''}`.toLowerCase().includes(text);

      return matchesFilter && matchesQuery;
    });
  }, [memories, query, activeFilter, loopsSubFilter]);

  const sessionTitle = (id?: string) =>
    sessions.find((session) => session.id === id)?.title || 'Source reflection';

  const updateMemory = async (memory: VaultMemory, patch: Record<string, unknown>) => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');
      const res = await fetch(`/api/memories/${memory.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Unable to update memory.');
      setMemories((prev) =>
        prev.map((item) => (item.id === memory.id ? { ...item, ...(data.memory || patch) } : item))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update memory.');
    }
  };

  const saveEdit = async () => {
    if (!editing || !editValue.trim()) return;
    setSaving(true);
    await updateMemory(editing, { fact: editValue.trim() });
    setEditing(null);
    setSaving(false);
  };

  const resolveLoop = async (memory: VaultMemory) => {
    await updateMemory(memory, { loopStatus: 'resolved' });
  };

  const reopenLoop = async (memory: VaultMemory) => {
    await updateMemory(memory, { loopStatus: 'open', snoozedUntil: null });
  };

  const applySnooze = async (days?: number, customIso?: string) => {
    if (!snoozingMemory) return;
    let targetDate: Date;
    if (customIso) {
      targetDate = new Date(customIso);
    } else {
      targetDate = new Date(Date.now() + (days || 3) * 86400000);
    }

    await updateMemory(snoozingMemory, {
      loopStatus: 'snoozed',
      snoozedUntil: targetDate.toISOString(),
    });
    setSnoozingMemory(null);
    setCustomSnoozeDate('');
  };

  return (
    <div className="min-h-full bg-[var(--gv-surface-ground)] text-[var(--gv-text-primary)] transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-5">
          {/* Dashboard Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--gv-accent)] font-medium">
                <Bookmark className="w-3.5 h-3.5" />
                <span>Your Vault</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-serif text-[var(--gv-text-primary)]">
                Memory, context, and unfinished things.
              </h1>
              <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-6 text-[var(--gv-text-secondary)]">
                Everything here is grounded in what you chose to keep. Edit it, revisit its exact source turn, or track how your perspective has shifted over time.
              </p>
            </div>

            {/* Clear, Compact Actions */}
            <div className="flex items-center gap-2.5 self-start sm:self-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setIsCreatingMemory(true);
                }}
                id="btn-new-memory"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--gv-accent)] hover:opacity-90 text-white text-xs font-medium transition cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[36px]"
                aria-label="Create new personal memory"
              >
                <Plus className="w-4 h-4" />
                <span>New Memory</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRailOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-[var(--gv-accent-border)] hover:bg-[var(--gv-surface-raised)] text-xs font-medium text-[var(--gv-text-primary)] transition cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[36px]"
                aria-label="Open context and open loops rail"
                aria-expanded={isRailOpen}
              >
                <PanelRight className="w-4 h-4 text-[var(--gv-accent)]" />
                <span>Context & Loops</span>
                {activeLoopMemories.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--gv-accent-muted)] text-[var(--gv-accent-text)] text-[10px] font-mono font-semibold">
                    {activeLoopMemories.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Visual Indicators / Editorial Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Memory Growth */}
            <div className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-[var(--gv-border-strong)] transition duration-200">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--gv-text-secondary)]">
                  <span>Memory Growth</span>
                  <Bookmark className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[var(--gv-text-primary)] tracking-tight">
                  <CountUpNumber value={activeMemories.length} />
                  <span className="ml-2 text-xs font-sans font-normal text-[var(--gv-text-tertiary)]">
                    memories
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-[var(--gv-border-subtle)] space-y-2">
                {activeMemories.length > 0 ? (
                  <>
                    <div className="h-2 w-full bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600/90 to-amber-500 dark:from-amber-500 dark:to-amber-400 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.min(100, Math.max(8, Math.round((recentMemories7d.length / activeMemories.length) * 100)))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--gv-text-secondary)]">
                      <span>{recentMemories7d.length > 0 ? `${recentMemories7d.length} added in 7d` : 'Grounded archive steady'}</span>
                      <span className="font-mono text-xs font-medium text-[var(--gv-accent-text)]">
                        {Math.round((recentMemories7d.length / activeMemories.length) * 100)}% recent
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--gv-text-tertiary)] leading-normal italic">
                    Grounded archive begins with your next reflection.
                  </p>
                )}
              </div>
            </div>

            {/* 2. Open-Loop Pressure / Active Intentions */}
            <div className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-[var(--gv-border-strong)] transition duration-200">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--gv-text-secondary)]">
                  <span>Open-Loop Pressure</span>
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[var(--gv-text-primary)] tracking-tight">
                  <CountUpNumber value={activeLoopMemories.length} />
                  <span className="ml-2 text-xs font-sans font-normal text-[var(--gv-text-tertiary)]">
                    active
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-[var(--gv-border-subtle)] space-y-2">
                {totalLoopsCount > 0 ? (
                  <>
                    <div className="h-2 w-full bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.round((activeLoopMemories.length / totalLoopsCount) * 100)}%` }}
                        className="h-full bg-amber-500 transition-all duration-700"
                        title={`Open: ${activeLoopMemories.length}`}
                      />
                      <div
                        style={{ width: `${Math.round((snoozedLoopMemories.length / totalLoopsCount) * 100)}%` }}
                        className="h-full bg-sky-500 transition-all duration-700"
                        title={`Snoozed: ${snoozedLoopMemories.length}`}
                      />
                      <div
                        style={{ width: `${Math.round((resolvedLoopMemories.length / totalLoopsCount) * 100)}%` }}
                        className="h-full bg-emerald-500 transition-all duration-700"
                        title={`Resolved: ${resolvedLoopMemories.length}`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--gv-text-secondary)]">
                      <span>{resolvedLoopMemories.length} resolved of {totalLoopsCount}</span>
                      <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {Math.round((resolvedLoopMemories.length / totalLoopsCount) * 100)}% done
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--gv-text-tertiary)] leading-normal italic">
                    No open intentions declared yet.
                  </p>
                )}
              </div>
            </div>

            {/* 3. Reflection Rhythm */}
            <div className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-[var(--gv-border-strong)] transition duration-200">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--gv-text-secondary)]">
                  <span>Reflection Rhythm</span>
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[var(--gv-text-primary)] tracking-tight">
                  <CountUpNumber value={completedSessions.length} />
                  <span className="ml-2 text-xs font-sans font-normal text-[var(--gv-text-tertiary)]">
                    reflections
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-[var(--gv-border-subtle)] space-y-2">
                {completedSessions.length > 0 ? (
                  <>
                    <div className="h-8 w-full flex items-end gap-1.5 px-0.5">
                      {dailyReflectionCounts.map((day, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1" title={`${day.count} sessions on ${day.dayLabel}`}>
                          <div className="w-full h-5 bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] rounded-xs flex items-end p-0.5 overflow-hidden">
                            <div
                              className={`w-full rounded-2xs transition-all duration-500 ${
                                day.count > 0 ? 'bg-[var(--gv-accent)]' : 'bg-transparent'
                              }`}
                              style={{
                                height: `${
                                  day.count > 0
                                    ? Math.min(100, Math.max(30, (day.count / Math.max(1, ...dailyReflectionCounts.map((d) => d.count))) * 100))
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-[var(--gv-text-tertiary)] font-mono leading-none">
                            {day.dayLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--gv-text-secondary)]">
                      <span>{recentSessions7d.length} sessions in 7d</span>
                      <span className="text-xs font-medium text-[var(--gv-accent-text)]">
                        {recentSessions7d.length > 0 ? 'Active rhythm' : 'Building'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--gv-text-tertiary)] leading-normal italic">
                    Cadence starts with your first session.
                  </p>
                )}
              </div>
            </div>

            {/* 4. Evolution / Perspective Shifts */}
            <div className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-[var(--gv-border-strong)] transition duration-200">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--gv-text-secondary)]">
                  <span>Perspective Shifts</span>
                  <History className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-[var(--gv-text-primary)] tracking-tight">
                  <CountUpNumber value={evolvedMemories.length} />
                  <span className="ml-2 text-xs font-sans font-normal text-[var(--gv-text-tertiary)]">
                    deepened
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-[var(--gv-border-subtle)] space-y-2">
                {evolvedMemories.length > 0 ? (
                  <>
                    <div className="h-2 w-full bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600/80 dark:bg-purple-400 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, Math.max(8, Math.round((evolvedMemories.length / (activeMemories.length || 1)) * 100)))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--gv-text-secondary)]">
                      <span>{evolvedMemories.length} thoughts revised</span>
                      <span className="font-mono text-xs font-medium text-purple-600 dark:text-purple-400">
                        {Math.round((evolvedMemories.length / (activeMemories.length || 1)) * 100)}% shifted
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--gv-text-tertiary)] leading-normal italic">
                    Thoughts deepen as perspectives evolve.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="w-full">
            {/* Main Content Area */}
            <section className="w-full rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] overflow-hidden shadow-sm">
              {/* Search Bar */}
              <div className="p-4 sm:p-5 border-b border-[var(--gv-border-subtle)] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-serif text-[var(--gv-text-primary)]">Your remembered context</h2>
                  <p className="mt-0.5 text-xs text-[var(--gv-text-tertiary)]">Search and manage what your Vault carries forward.</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gv-text-tertiary)]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search memories…"
                    className="w-full rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] pl-9 pr-3 py-2 text-sm text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)] transition"
                  />
                </div>
              </div>

              {/* Primary Tabs */}
              <div className="px-4 sm:px-5 py-3 border-b border-[var(--gv-border-subtle)] flex gap-2 overflow-x-auto select-none">
                {([
                  ['all', 'All Active'],
                  ['memory', 'Context'],
                  ['loop', `Open Loops (${activeLoopMemories.length + snoozedLoopMemories.length})`],
                  ['evolution', `Shifts & Evolution (${evolvedMemories.length})`],
                  ['archived', 'Archived'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition cursor-pointer ${
                      activeFilter === value
                        ? 'bg-[var(--gv-accent-muted)] border-[var(--gv-accent-border)] text-[var(--gv-accent-text)] font-semibold'
                        : 'bg-[var(--gv-surface-ground)] border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Open Loops Sub-Filter Tabs */}
              {activeFilter === 'loop' && (
                <div className="px-4 sm:px-5 py-2.5 bg-[var(--gv-surface-ground)]/40 border-b border-[var(--gv-border-subtle)] flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-[11px] text-[var(--gv-text-tertiary)] font-medium mr-1">Triage:</span>
                  {([
                    ['open', `Open (${activeLoopMemories.length})`],
                    ['snoozed', `Snoozed (${snoozedLoopMemories.length})`],
                    ['resolved', `Resolved (${resolvedLoopMemories.length})`],
                    ['all_loops', 'All Loops'],
                  ] as const).map(([subVal, subLabel]) => (
                    <button
                      key={subVal}
                      type="button"
                      onClick={() => setLoopsSubFilter(subVal)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                        loopsSubFilter === subVal
                          ? 'bg-[var(--gv-accent)] text-white'
                          : 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] border border-[var(--gv-border-subtle)]'
                      }`}
                    >
                      {subLabel}
                    </button>
                  ))}
                </div>
              )}

              {/* Memory List Content */}
              {loading ? (
                <div className="p-12 text-center text-xs text-[var(--gv-text-tertiary)]">Loading your Vault…</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <Sparkles className="w-6 h-6 text-[var(--gv-text-muted)] mx-auto mb-2" />
                  <p className="text-sm font-serif text-[var(--gv-text-secondary)]">Nothing matches that view.</p>
                  <p className="text-xs text-[var(--gv-text-tertiary)] mt-1">
                    {activeFilter === 'evolution'
                      ? 'No perspective shifts or evolved memories recorded yet.'
                      : 'Try adjusting your search query or view filter.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--gv-border-subtle)]">
                  {filtered.map((memory) => {
                    const isLoop = memory.category === 'goal' || memory.category === 'commitment';
                    const hasShift =
                      memory.evolutionStatus === 'evolved' ||
                      memory.evolutionStatus === 'superseded' ||
                      Boolean(memory.supersedesMemoryId) ||
                      (Array.isArray(memory.evolutionHistory) && memory.evolutionHistory.length > 0);

                    return (
                      <article
                        key={memory.id}
                        className="p-4 sm:p-5 hover:bg-[var(--gv-surface-ground)]/40 transition"
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isLoop
                                ? 'bg-[var(--gv-accent-muted)] text-[var(--gv-accent-gold)] border border-[var(--gv-accent-border)]'
                                : hasShift
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-secondary)] border border-[var(--gv-border-default)]'
                            }`}
                          >
                            {isLoop ? (
                              <Target className="w-4 h-4" />
                            ) : hasShift ? (
                              <History className="w-4 h-4" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-x-2.5 gap-y-1 items-center">
                              <span className="text-[11px] font-semibold text-[var(--gv-accent-text)]">
                                {categoryLabel(memory.category)}
                              </span>

                              {isLoop && memory.loopStatus && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium ${
                                    memory.loopStatus === 'open'
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                      : memory.loopStatus === 'snoozed'
                                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                      : 'bg-[var(--gv-success-muted)] text-[var(--gv-success)] border border-[var(--gv-success-border)]'
                                  }`}
                                >
                                  <Clock3 className="w-2.5 h-2.5" />
                                  <span>
                                    {memory.loopStatus === 'open'
                                      ? 'Open'
                                      : memory.loopStatus === 'snoozed'
                                      ? `Snoozed${
                                          memory.snoozedUntil
                                            ? ` until ${new Date(memory.snoozedUntil).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                              })}`
                                            : ''
                                        }`
                                      : 'Resolved'}
                                  </span>
                                </span>
                              )}

                              {memory.evolutionStatus && memory.evolutionStatus !== 'active' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] font-medium">
                                  {memory.evolutionStatus === 'superseded'
                                    ? 'Superseded'
                                    : memory.evolutionStatus === 'evolved'
                                    ? 'Evolved Perspective'
                                    : 'Reinforced'}
                                </span>
                              )}

                              {(memory.extractedBy === 'manual' || memory.sourceType === 'manual') && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-[var(--gv-text-secondary)] font-medium">
                                  Direct Author
                                </span>
                              )}
                            </div>

                            <p className="mt-2.5 text-base sm:text-[17px] font-serif text-[var(--gv-text-primary)] leading-relaxed sm:leading-7 tracking-normal select-text">
                              &ldquo;{memory.fact}&rdquo;
                            </p>

                            {memory.userNotes && (
                              <p className="mt-2 text-xs sm:text-[13px] text-[var(--gv-text-secondary)] italic bg-[var(--gv-surface-ground)] px-3 py-1.5 rounded-lg border border-[var(--gv-border-subtle)]">
                                Note: {memory.userNotes}
                              </p>
                            )}

                            {/* Verbatim Source Turn Excerpt */}
                            {memory.sourceSnippet && (
                              <div className="mt-2.5 p-3 rounded-xl bg-[var(--gv-surface-ground)]/90 border border-[var(--gv-border-subtle)] text-xs">
                                <div className="flex items-center justify-between gap-2 text-xs text-[var(--gv-text-tertiary)] font-medium mb-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className="uppercase tracking-wider text-[10px] font-semibold">Verbatim Evidence</span>
                                    {memory.sourceModality === 'voice' && (
                                      <span className="px-1.5 py-0.2 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-accent)] lowercase text-[10px] font-mono">
                                        spoken
                                      </span>
                                    )}
                                  </span>
                                  {memory.sourceMessageId && memory.sourceSessionId && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenSession(memory.sourceSessionId!, memory.sourceMessageId!)}
                                      className="text-xs text-[var(--gv-accent)] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                                    >
                                      <span>jump to turn</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <p className="italic font-serif text-[var(--gv-text-secondary)] text-xs sm:text-[13px] leading-relaxed">
                                  &ldquo;{memory.sourceSnippet}&rdquo;
                                </p>
                              </div>
                            )}

                            {!memory.sourceSnippet && memory.sourceSessionId && (
                              <div className="mt-2 text-xs">
                                <button
                                  type="button"
                                  onClick={() => onOpenSession(memory.sourceSessionId!)}
                                  className="text-xs text-[var(--gv-accent-text)] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                                >
                                  <span>View source reflection</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* Evolution History Timeline */}
                            {Array.isArray(memory.evolutionHistory) && memory.evolutionHistory.length > 0 && (
                              <div className="mt-3 p-3 rounded-xl bg-[var(--gv-surface-ground)]/60 border border-[var(--gv-border-subtle)] text-xs space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--gv-text-secondary)]">
                                  <History className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
                                  <span>Perspective Evolution Trail</span>
                                </div>
                                <div className="space-y-1.5 pl-3 border-l border-[var(--gv-border-default)]">
                                  {memory.evolutionHistory.map((evo, idx) => (
                                    <div key={idx} className="text-xs text-[var(--gv-text-tertiary)]">
                                      <span className="font-serif italic text-[var(--gv-text-secondary)]">
                                        &ldquo;{evo.previousFact}&rdquo;
                                      </span>
                                      {evo.changeNote && (
                                        <span className="ml-1.5 text-[var(--gv-accent)] font-sans font-medium">
                                          &rarr; {evo.changeNote}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Provenance Footer */}
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 items-center text-xs text-[var(--gv-text-tertiary)]">
                              <span>From {sessionTitle(memory.sourceSessionId || undefined)}</span>
                              {!isLoop && memory.sourceSessionId && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSession(memory.sourceSessionId!, memory.sourceMessageId || undefined)}
                                  className="text-[var(--gv-text-secondary)] hover:text-[var(--gv-accent)] inline-flex items-center gap-1 cursor-pointer transition font-medium"
                                >
                                  <span>Open reflection</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Open Loop Primary Action Controls */}
                            {isLoop && (
                              <div className="mt-3.5 pt-3 border-t border-[var(--gv-border-subtle)] flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {memory.sourceSessionId && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenSession(memory.sourceSessionId!, memory.sourceMessageId || undefined)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-[var(--gv-accent-border)] hover:bg-[var(--gv-accent-muted)] text-[var(--gv-text-primary)] hover:text-[var(--gv-accent-text)] active:scale-[0.98] transition cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[34px]"
                                      title="Revisit the exact reflection turn"
                                    >
                                      <Compass className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
                                      <span>Revisit reflection</span>
                                    </button>
                                  )}

                                  {memory.loopStatus !== 'resolved' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setSnoozingMemory(memory)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-sky-500/50 hover:bg-sky-500/10 text-[var(--gv-text-secondary)] hover:text-sky-700 dark:hover:text-sky-300 active:scale-[0.98] transition cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[34px]"
                                        title="Snooze this intention"
                                      >
                                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                                        <span>Snooze</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => resolveLoop(memory)}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gv-success-muted)] border border-[var(--gv-success-border)] hover:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 active:scale-[0.98] transition cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[34px]"
                                        title="Mark intention as done / resolved"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--gv-success)]" />
                                        <span>Mark done</span>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => reopenLoop(memory)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent-text)] hover:bg-[var(--gv-accent-border)] active:scale-[0.98] transition cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[34px]"
                                      title="Reopen this intention"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
                                      <span>Reopen intention</span>
                                    </button>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditing(memory);
                                    setEditValue(memory.fact);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:border-[var(--gv-border-strong)] text-xs font-medium transition cursor-pointer min-h-[34px] shadow-2xs hover:shadow-xs active:scale-[0.98]"
                                  title="Edit wording"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-[var(--gv-text-tertiary)]" />
                                  <span>Edit</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Quick Edit icon button for non-loop memories */}
                          {!isLoop && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(memory);
                                  setEditValue(memory.fact);
                                }}
                                className="p-2 rounded-lg border border-[var(--gv-border-default)] bg-[var(--gv-surface-raised)] text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)]"
                                aria-label="Edit memory"
                                title="Edit wording"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Contextual Right Rail Overlay Drawer (zero layout width consumed when closed) */}
      {isRailOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Vault Context & Open Loops"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsRailOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="relative z-10 w-[min(400px,calc(100vw-1.5rem))] bg-[var(--gv-surface-rail)] border-l border-[var(--gv-border-default)] shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="h-14 px-5 border-b border-[var(--gv-border-subtle)] flex items-center justify-between shrink-0 bg-[var(--gv-surface-rail)]/90 backdrop-blur-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-[var(--gv-accent)] shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-[var(--gv-text-primary)] truncate font-serif">
                    Context & Loops
                  </span>
                  <span className="text-[11px] text-[var(--gv-text-tertiary)] truncate">
                    Supporting intentions & sources
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRailOpen(false)}
                className="p-1.5 rounded-lg text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)]"
                aria-label="Close contextual rail"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Quick Open Loops Widget */}
              <section className="rounded-2xl border border-[var(--gv-accent-border)] bg-[var(--gv-surface-base)] p-4 shadow-xs">
                <div className="flex items-center justify-between gap-2 text-[var(--gv-accent)]">
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Target className="w-4 h-4 text-[var(--gv-accent-gold)]" />
                    <span>Open loops</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--gv-accent-muted)] font-mono">
                    {activeLoopMemories.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">Intentions that are currently open.</p>
                <div className="mt-3.5 space-y-3">
                  {activeLoopMemories.slice(0, 5).map((memory) => (
                    <div
                      key={memory.id}
                      className="rounded-xl border border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)]/60 p-3.5 text-xs shadow-2xs"
                    >
                      <div className="text-[10px] text-[var(--gv-accent-text)] font-semibold uppercase tracking-wider">
                        {categoryLabel(memory.category)}
                      </div>
                      <p className="mt-1 font-serif text-xs leading-relaxed text-[var(--gv-text-secondary)]">
                        &ldquo;{memory.fact}&rdquo;
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--gv-border-subtle)] flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRailOpen(false);
                            if (memory.sourceSessionId) {
                              onOpenSession(memory.sourceSessionId, memory.sourceMessageId || undefined);
                            }
                          }}
                          disabled={!memory.sourceSessionId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-[var(--gv-accent-border)] hover:bg-[var(--gv-accent-muted)] text-[var(--gv-text-primary)] hover:text-[var(--gv-accent-text)] active:scale-[0.98] transition cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] disabled:opacity-40 min-h-[32px]"
                          title="Revisit reflection turn"
                        >
                          <Compass className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
                          <span>Revisit</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSnoozingMemory(memory)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-sky-500/50 hover:bg-sky-500/10 text-[var(--gv-text-secondary)] hover:text-sky-700 dark:hover:text-sky-300 active:scale-[0.98] transition cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[32px]"
                            title="Snooze intention"
                          >
                            <Clock className="w-3.5 h-3.5 text-sky-500" />
                            <span>Snooze</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => resolveLoop(memory)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gv-success-muted)] border border-[var(--gv-success-border)] hover:bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 active:scale-[0.98] transition cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--gv-focus-ring)] min-h-[32px]"
                            title="Mark resolved"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--gv-success)]" />
                            <span>Mark done</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeLoopMemories.length === 0 && (
                    <p className="text-xs text-[var(--gv-text-tertiary)] italic py-2">
                      No open intentions right now.
                    </p>
                  )}
                </div>
              </section>

              {/* Recent Sources Widget */}
              <section className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-4 shadow-xs">
                <div className="flex items-center gap-2 text-[var(--gv-text-primary)]">
                  <Archive className="w-4 h-4 text-[var(--gv-text-tertiary)]" />
                  <h2 className="text-xs font-medium">Recent sources</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {sessions
                    .filter((s) => s.status === 'completed')
                    .slice(0, 5)
                    .map((session) => (
                      <div
                        key={session.id}
                        className="w-full rounded-xl border border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)]/40 px-3 py-2.5 hover:border-[var(--gv-border-default)] flex items-center justify-between gap-2 transition"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setIsRailOpen(false);
                            onOpenSession(session.id);
                          }}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-xs text-[var(--gv-text-primary)] truncate font-serif">
                            {session.title || 'Reflection'}
                          </div>
                          <div className="mt-0.5 text-[10px] text-[var(--gv-text-tertiary)]">Open reflection</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRailOpen(false);
                            onContinueSession(session.id);
                          }}
                          className="text-[11px] text-[var(--gv-text-secondary)] hover:text-[var(--gv-accent)] shrink-0 px-2.5 py-1.5 rounded-lg bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] hover:border-[var(--gv-accent-border)] transition cursor-pointer min-h-[30px]"
                          title="Continue this reflection"
                        >
                          Continue
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}

      {/* Global Message Banner */}
      {message && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] px-4 py-3 text-xs text-[var(--gv-text-primary)] shadow-2xl">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            className="ml-3 text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Edit Memory Modal */}
      {editing && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 sm:p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-serif text-[var(--gv-text-primary)]">Edit memory</h2>
                <p className="mt-0.5 text-xs text-[var(--gv-text-tertiary)]">Change the wording without changing its provenance.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] p-3 text-sm text-[var(--gv-text-primary)] focus:outline-none focus:border-[var(--gv-accent)] resize-y font-sans"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3.5 py-2 rounded-xl border border-[var(--gv-border-default)] text-[var(--gv-text-secondary)] text-xs cursor-pointer hover:bg-[var(--gv-surface-raised)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !editValue.trim()}
                onClick={saveEdit}
                className="px-4 py-2 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-medium disabled:opacity-50 cursor-pointer hover:opacity-90 transition"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snooze Loop Modal */}
      {snoozingMemory && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 sm:p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[var(--gv-accent)] font-medium text-sm">
                <Clock3 className="w-4 h-4 text-[var(--gv-accent-gold)]" />
                <span>Snooze Open Loop</span>
              </div>
              <button
                type="button"
                onClick={() => setSnoozingMemory(null)}
                className="p-1 rounded-lg text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="font-serif text-sm text-[var(--gv-text-primary)] leading-relaxed bg-[var(--gv-surface-ground)] p-3 rounded-xl border border-[var(--gv-border-subtle)]">
              &ldquo;{snoozingMemory.fact}&rdquo;
            </p>

            <p className="mt-3 text-xs text-[var(--gv-text-secondary)]">
              When would you like this intention to resurface?
            </p>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <button
                type="button"
                onClick={() => applySnooze(3)}
                className="p-2.5 rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-subtle)] text-xs font-medium text-[var(--gv-text-primary)] text-center transition cursor-pointer"
              >
                3 Days
              </button>
              <button
                type="button"
                onClick={() => applySnooze(7)}
                className="p-2.5 rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-subtle)] text-xs font-medium text-[var(--gv-text-primary)] text-center transition cursor-pointer"
              >
                1 Week
              </button>
              <button
                type="button"
                onClick={() => applySnooze(30)}
                className="p-2.5 rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-subtle)] text-xs font-medium text-[var(--gv-text-primary)] text-center transition cursor-pointer"
              >
                1 Month
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--gv-border-subtle)] space-y-2">
              <label className="block text-[11px] text-[var(--gv-text-tertiary)] font-medium">
                Or choose a custom date:
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customSnoozeDate}
                  onChange={(e) => setCustomSnoozeDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-primary)] focus:outline-none focus:border-[var(--gv-accent)]"
                />
                <button
                  type="button"
                  disabled={!customSnoozeDate}
                  onClick={() => applySnooze(undefined, customSnoozeDate)}
                  className="px-3 py-1.5 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-medium disabled:opacity-50 cursor-pointer hover:opacity-90 transition"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Memory Creation Modal */}
      {isCreatingMemory && (
        <div
          className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-memory-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-5 sm:p-6 shadow-2xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--gv-border-subtle)]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[var(--gv-accent-muted)] text-[var(--gv-accent)]">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="new-memory-title" className="text-sm font-serif font-semibold text-[var(--gv-text-primary)]">
                    New Personal Memory
                  </h3>
                  <p className="text-[11px] text-[var(--gv-text-tertiary)]">
                    Directly authored personal context · Saved with manual provenance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!creatingMemory) {
                    setIsCreatingMemory(false);
                    setCreateError(null);
                  }
                }}
                disabled={creatingMemory}
                className="p-1.5 rounded-lg text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--gv-text-secondary)] mb-1.5">
                  Memory / Observation <span className="text-[var(--gv-accent)]">*</span>
                </label>
                <textarea
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  placeholder="e.g., I do my best architectural design work early in the morning before emails."
                  rows={3}
                  maxLength={500}
                  required
                  autoFocus
                  className="w-full rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] p-3 text-sm text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)] resize-none font-sans"
                />
                <div className="flex justify-between text-[10px] text-[var(--gv-text-tertiary)] mt-1">
                  <span>Durable insight or persistent preference</span>
                  <span>{newFact.length}/500</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--gv-text-secondary)] mb-1.5">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-primary)] focus:outline-none focus:border-[var(--gv-accent)] cursor-pointer"
                  >
                    <option value="preference">Preference</option>
                    <option value="goal">Goal</option>
                    <option value="project">Project</option>
                    <option value="important_context">Important Context</option>
                    <option value="recurring_theme">Recurring Theme</option>
                    <option value="commitment">Commitment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--gv-text-secondary)] mb-1.5">
                    Importance
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Normal', val: 0.5 },
                      { label: 'Elevated', val: 0.8 },
                      { label: 'Core', val: 1.0 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setNewImportance(opt.val)}
                        className={`px-2 py-2 rounded-xl border text-[11px] font-medium text-center transition cursor-pointer ${
                          newImportance === opt.val
                            ? 'bg-[var(--gv-accent)] text-white border-[var(--gv-accent)]'
                            : 'bg-[var(--gv-surface-ground)] border-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--gv-text-secondary)] mb-1.5">
                  Personal Notes <span className="text-[var(--gv-text-tertiary)] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newUserNotes}
                  onChange={(e) => setNewUserNotes(e.target.value)}
                  placeholder="Additional context or notes..."
                  maxLength={1000}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--gv-border-subtle)] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={creatingMemory}
                  onClick={() => {
                    setIsCreatingMemory(false);
                    setCreateError(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingMemory || !newFact.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition cursor-pointer shadow-xs"
                >
                  {creatingMemory ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Memory</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};