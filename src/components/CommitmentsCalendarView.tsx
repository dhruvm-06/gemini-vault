import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Plus,
  Target,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Bell,
  X,
  Loader2,
  AlertCircle,
  CalendarDays,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JournalSession, Memory } from '../types';
import {
  createGoogleCalendarUrl,
  getUpcomingPlanningOpportunities,
  PlanningOpportunity,
} from '../utils/actionHandoffs';

interface CommitmentsCalendarViewProps {
  onOpenSession?: (sessionId: string) => void;
  onNavigateToIntelligence?: () => void;
}

type FilterTab = 'all' | 'commitments' | 'snoozed' | 'resolved';

export const CommitmentsCalendarView: React.FC<CommitmentsCalendarViewProps> = ({
  onOpenSession,
  onNavigateToIntelligence,
}) => {
  const { getIdToken } = useAuth();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [sessions, setSessions] = useState<JournalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // Add commitment modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [commitmentText, setCommitmentText] = useState('');
  const [commitmentNotes, setCommitmentNotes] = useState('');
  const [isSavingCommitment, setIsSavingCommitment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Snooze modal state
  const [snoozeTargetMemory, setSnoozeTargetMemory] = useState<Memory | null>(null);
  const [snoozeDays, setSnoozeDays] = useState<number>(7);
  const [isSnoozing, setIsSnoozing] = useState(false);

  // Week summary state
  const [weekSummary, setWeekSummary] = useState<string | null>(null);
  const [isSummarizingWeek, setIsSummarizingWeek] = useState(false);
  const [weekSummaryError, setWeekSummaryError] = useState<string | null>(null);

  const handleSummarizeWeek = async () => {
    if (isSummarizingWeek) return;
    setIsSummarizingWeek(true);
    setWeekSummaryError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');
      const res = await fetch('/api/memories/calendar-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to summarize calendar week.');
      setWeekSummary(data.summary);
    } catch (err: unknown) {
      console.error('[CommitmentsCalendar] Summarize week error:', err);
      setWeekSummaryError(err instanceof Error ? err.message : 'Unable to summarize week.');
    } finally {
      setIsSummarizingWeek(false);
    }
  };

  const upcomingOpportunities = useMemo(() => {
    return getUpcomingPlanningOpportunities();
  }, []);

  // Load memories and sessions
  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      const [memRes, sessRes] = await Promise.all([
        fetch('/api/memories', { headers }),
        fetch('/api/journal/sessions', { headers }),
      ]);

      const memData = await memRes.json().catch(() => ({}));
      const sessData = await sessRes.json().catch(() => ({}));

      if (memData.success && Array.isArray(memData.memories)) {
        setMemories(memData.memories);
      } else if (Array.isArray(memData)) {
        setMemories(memData);
      }

      if (sessData.success && Array.isArray(sessData.sessions)) {
        setSessions(sessData.sessions);
      }
    } catch (err) {
      console.error('[CommitmentsCalendar] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter items into categories
  const activeCommitments = useMemo(() => {
    return memories.filter(
      (m) =>
        m.isActive !== false &&
        m.loopStatus !== 'resolved' &&
        m.loopStatus !== 'snoozed' &&
        (m.category === 'commitment' || m.category === 'goal' || m.loopStatus === 'open')
    );
  }, [memories]);

  const snoozedLoops = useMemo(() => {
    return memories.filter(
      (m) => m.isActive !== false && m.loopStatus === 'snoozed'
    );
  }, [memories]);

  const resolvedItems = useMemo(() => {
    return memories.filter((m) => m.loopStatus === 'resolved');
  }, [memories]);

  // Deterministic suggested focus: select highest importance or newest active commitment/loop
  const suggestedFocus = useMemo(() => {
    if (activeCommitments.length === 0) return null;
    return [...activeCommitments].sort((a, b) => {
      const impA = a.importance ?? 3;
      const impB = b.importance ?? 3;
      if (impB !== impA) return impB - impA;
      const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
      const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })[0];
  }, [activeCommitments]);

  // Displayed items based on filter tab
  const displayedItems = useMemo(() => {
    switch (filterTab) {
      case 'commitments':
        return activeCommitments;
      case 'snoozed':
        return snoozedLoops;
      case 'resolved':
        return resolvedItems;
      case 'all':
      default:
        return [...activeCommitments, ...snoozedLoops];
    }
  }, [filterTab, activeCommitments, snoozedLoops, resolvedItems]);

  // Save new commitment
  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commitmentText.trim();
    if (!text) return;

    setIsSavingCommitment(true);
    setActionError(null);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication expired.');

      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceType: 'manual',
          fact: text,
          category: 'commitment',
          userNotes: commitmentNotes.trim(),
          importance: 0.8,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save commitment.');

      if (data.memory) {
        setMemories((prev) => [data.memory, ...prev]);
      } else {
        await loadData();
      }

      setCommitmentText('');
      setCommitmentNotes('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('[CommitmentsCalendar] Create failed:', err);
      setActionError(err.message || 'Failed to save commitment.');
    } finally {
      setIsSavingCommitment(false);
    }
  };

  // Mark commitment/loop as resolved
  const handleResolve = async (id: string) => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/memories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          loopStatus: 'resolved',
        }),
      });

      if (res.ok) {
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? { ...m, loopStatus: 'resolved' } : m))
        );
      }
    } catch (err) {
      console.error('[CommitmentsCalendar] Resolve failed:', err);
    }
  };

  // Re-activate a snoozed or resolved loop
  const handleReactivate = async (id: string) => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/memories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          loopStatus: 'open',
          snoozedUntil: null,
        }),
      });

      if (res.ok) {
        setMemories((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, loopStatus: 'open', snoozedUntil: null } : m
          )
        );
      }
    } catch (err) {
      console.error('[CommitmentsCalendar] Reactivate failed:', err);
    }
  };

  // Snooze commitment
  const handleApplySnooze = async () => {
    if (!snoozeTargetMemory) return;

    setIsSnoozing(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + snoozeDays);

      const res = await fetch(`/api/memories/${snoozeTargetMemory.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          loopStatus: 'snoozed',
          snoozedUntil: snoozeDate.toISOString(),
        }),
      });

      if (res.ok) {
        setMemories((prev) =>
          prev.map((m) =>
            m.id === snoozeTargetMemory.id
              ? { ...m, loopStatus: 'snoozed', snoozedUntil: snoozeDate.toISOString() }
              : m
          )
        );
        setSnoozeTargetMemory(null);
      }
    } catch (err) {
      console.error('[CommitmentsCalendar] Snooze failed:', err);
    } finally {
      setIsSnoozing(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--gv-border-subtle)] pb-6">
        <div>
          <span className="text-[11px] font-medium tracking-widest uppercase text-[var(--gv-accent-gold)] px-2.5 py-1 rounded-full bg-[var(--gv-accent-gold)]/10 border border-[var(--gv-accent-gold)]/30">
            Action Alignment
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl text-[var(--gv-text-primary)] mt-3 font-medium">
            Commitments & Calendar
          </h1>
          <p className="mt-1 text-sm text-[var(--gv-text-secondary)]">
            Bridge your reflective insights into scheduled intentions, focus blocks, and loop closures.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSummarizeWeek}
            disabled={isSummarizingWeek}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] hover:border-[var(--gv-border-accent)] text-[var(--gv-text-primary)] text-xs font-medium transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
            <span>{isSummarizingWeek ? 'Summarizing...' : 'Summarize My Week'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--gv-accent)] hover:bg-[var(--gv-accent-hover)] text-white text-xs font-semibold shadow-xs transition active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add commitment</span>
          </button>
        </div>
      </div>

      {/* Week Calendar Summary Card */}
      {weekSummary && (
        <div className="mb-6 p-5 rounded-2xl bg-[var(--gv-surface-raised)] border border-[var(--gv-accent-border)] shadow-xs animate-turn-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--gv-accent)]">
              <Sparkles className="w-4 h-4 text-[var(--gv-accent-gold)]" />
              <span className="font-serif text-sm font-medium">Calendar Reflection Synthesis</span>
            </div>
            <button
              type="button"
              onClick={() => setWeekSummary(null)}
              className="text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition"
              aria-label="Dismiss week summary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2.5 font-serif text-sm text-[var(--gv-text-primary)] leading-relaxed">
            {weekSummary}
          </p>
        </div>
      )}

      {weekSummaryError && (
        <div className="mb-6 p-3 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-secondary)] flex items-center justify-between">
          <span>{weekSummaryError}</span>
          <button
            type="button"
            onClick={() => setWeekSummaryError(null)}
            className="text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] ml-2 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Suggested Focus Banner (Deterministic recommendation from existing open loops) */}
      {suggestedFocus && filterTab !== 'resolved' && (
        <div className="mb-8 p-5 rounded-2xl bg-[var(--gv-accent-muted)]/15 border border-[var(--gv-accent-border)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--gv-accent-gold)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Suggested Focus
            </span>
            <span className="text-[11px] text-[var(--gv-text-secondary)]">
              Derived from active vault loop
            </span>
          </div>
          <p className="font-serif text-base text-[var(--gv-text-primary)] font-medium leading-relaxed">
            &ldquo;{suggestedFocus.fact}&rdquo;
          </p>
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleResolve(suggestedFocus.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--gv-accent)] hover:underline cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark completed</span>
            </button>
            {suggestedFocus.sourceSessionId && onOpenSession && (
              <button
                type="button"
                onClick={() => onOpenSession(suggestedFocus.sourceSessionId!)}
                className="inline-flex items-center gap-1 text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer"
              >
                <span>View reflection</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[var(--gv-border-subtle)] pb-2">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterTab === 'all'
              ? 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)] shadow-2xs'
              : 'text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)]'
          }`}
        >
          All ({activeCommitments.length + snoozedLoops.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('commitments')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterTab === 'commitments'
              ? 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)] shadow-2xs'
              : 'text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)]'
          }`}
        >
          Open Commitments ({activeCommitments.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('snoozed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterTab === 'snoozed'
              ? 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)] shadow-2xs'
              : 'text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)]'
          }`}
        >
          Snoozed ({snoozedLoops.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('resolved')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterTab === 'resolved'
              ? 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)] shadow-2xs'
              : 'text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)]'
          }`}
        >
          Completed ({resolvedItems.length})
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--gv-accent-gold)] mx-auto" />
          <p className="text-xs text-[var(--gv-text-secondary)]">Loading commitments & calendar...</p>
        </div>
      ) : displayedItems.length === 0 ? (
        /* Empty state */
        <div className="p-12 text-center border border-dashed border-[var(--gv-border-default)] rounded-2xl bg-[var(--gv-surface-raised)]/30 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent)] flex items-center justify-center mx-auto">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif text-lg text-[var(--gv-text-primary)] font-medium">
              No commitments yet.
            </h3>
            <p className="text-xs text-[var(--gv-text-secondary)] max-w-sm mx-auto leading-relaxed">
              Turn an open loop into a commitment when you're ready, or add a deliberate intention directly.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] text-[var(--gv-text-primary)] text-xs font-medium hover:border-[var(--gv-accent)] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
              <span>+ Add commitment</span>
            </button>
          </div>
        </div>
      ) : (
        /* List of Commitments & Loops */
        <div className="space-y-3">
          {displayedItems.map((item) => {
            const isSnoozed = item.loopStatus === 'snoozed';
            const isResolved = item.loopStatus === 'resolved';
            const wakeDate = formatDate(item.snoozedUntil);
            const createdDate = formatDate(typeof item.createdAt === 'string' ? item.createdAt : null);

            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-2xl border transition text-left space-y-2.5 ${
                  isResolved
                    ? 'bg-[var(--gv-surface-raised)]/30 border-[var(--gv-border-subtle)] opacity-75'
                    : isSnoozed
                    ? 'bg-[var(--gv-surface-ground)] border-[var(--gv-border-subtle)]'
                    : 'bg-[var(--gv-surface-raised)] border-[var(--gv-border-default)] hover:border-[var(--gv-border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)]">
                      {item.category.replace(/_/g, ' ')}
                    </span>
                    {isSnoozed && wakeDate && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        Snoozed until {wakeDate}
                      </span>
                    )}
                    {isResolved && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--gv-success)] font-medium px-2 py-0.5 rounded-full bg-[var(--gv-success-muted)] border border-[var(--gv-success-border)]">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    )}
                  </div>

                  {createdDate && (
                    <span className="text-[10px] text-[var(--gv-text-tertiary)]">
                      {createdDate}
                    </span>
                  )}
                </div>

                <p className={`font-serif text-sm sm:text-base leading-relaxed ${
                  isResolved ? 'line-through text-[var(--gv-text-secondary)]' : 'text-[var(--gv-text-primary)]'
                }`}>
                  {item.fact}
                </p>

                {item.userNotes && (
                  <p className="text-xs text-[var(--gv-text-secondary)] italic leading-relaxed">
                    Note: {item.userNotes}
                  </p>
                )}

                {/* Actions Bar */}
                <div className="pt-2 flex items-center justify-between text-xs border-t border-[var(--gv-border-subtle)]">
                  <div className="flex items-center gap-2">
                    {!isResolved && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleResolve(item.id)}
                          className="inline-flex items-center gap-1 text-[var(--gv-text-secondary)] hover:text-[var(--gv-success)] transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                        <span className="text-[var(--gv-border-strong)]">•</span>
                        <button
                          type="button"
                          onClick={() => setSnoozeTargetMemory(item)}
                          className="inline-flex items-center gap-1 text-[var(--gv-text-secondary)] hover:text-amber-500 transition cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Snooze</span>
                        </button>
                        <span className="text-[var(--gv-border-strong)]">•</span>
                        <a
                          href={createGoogleCalendarUrl({
                            title: item.fact,
                            details: item.userNotes ? `${item.userNotes}\n\nFrom Gemini Vault reflection.` : 'Gemini Vault commitment.',
                            startDate: item.snoozedUntil || undefined,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--gv-text-secondary)] hover:text-[var(--gv-accent)] transition cursor-pointer"
                          title="Schedule in Google Calendar"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                          <span>Add to Calendar</span>
                        </a>
                      </>
                    )}

                    {isResolved && (
                      <button
                        type="button"
                        onClick={() => handleReactivate(item.id)}
                        className="inline-flex items-center gap-1 text-[var(--gv-text-secondary)] hover:text-[var(--gv-accent)] transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reactivate</span>
                      </button>
                    )}
                  </div>

                  {item.sourceSessionId && onOpenSession && (
                    <button
                      type="button"
                      onClick={() => onOpenSession(item.sourceSessionId!)}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--gv-accent)] hover:underline cursor-pointer"
                    >
                      <span>From reflection</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Seasonal & Holiday Planning Opportunities (External Context) */}
      <div className="mt-10 pt-8 border-t border-[var(--gv-border-subtle)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--gv-text-primary)]">
            <CalendarDays className="w-4 h-4 text-[var(--gv-accent-gold)]" />
            <h3 className="text-sm font-semibold">Upcoming Planning Opportunities</h3>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--gv-text-tertiary)] bg-[var(--gv-surface-ground)] px-2 py-0.5 rounded-full border border-[var(--gv-border-subtle)]">
            External Context
          </span>
        </div>
        <p className="text-xs text-[var(--gv-text-tertiary)] leading-relaxed">
          Public holidays and seasonal milestones providing natural windows for deep reflection, rest, or focus blocks.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {upcomingOpportunities.map((opp) => (
            <div
              key={opp.id}
              className="p-4 rounded-2xl bg-[var(--gv-surface-raised)]/60 border border-[var(--gv-border-subtle)] space-y-2 hover:border-[var(--gv-border-default)] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-serif text-sm font-medium text-[var(--gv-text-primary)]">
                  {opp.name}
                </span>
                <span className="text-[11px] font-mono text-[var(--gv-accent)] font-medium shrink-0">
                  {opp.label}
                </span>
              </div>
              <p className="text-xs text-[var(--gv-text-secondary)] leading-relaxed">
                {opp.description}
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-[var(--gv-border-subtle)]/50">
                <span className="text-[10px] uppercase tracking-wider text-[var(--gv-text-tertiary)]">
                  {opp.type.replace(/_/g, ' ')}
                </span>
                <a
                  href={createGoogleCalendarUrl({
                    title: opp.name,
                    details: opp.description,
                    startDate: opp.dateStr,
                    isAllDay: true,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-accent)] transition cursor-pointer"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                  <span>Add to Calendar</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Commitment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gv-accent-gold)]">
                New Commitment
              </span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCommitment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--gv-text-primary)] mb-1">
                  Commitment Statement
                </label>
                <textarea
                  value={commitmentText}
                  onChange={(e) => setCommitmentText(e.target.value)}
                  placeholder="What intention or commitment are you making?"
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--gv-text-primary)] mb-1">
                  Personal Notes (Optional)
                </label>
                <input
                  type="text"
                  value={commitmentNotes}
                  onChange={(e) => setCommitmentNotes(e.target.value)}
                  placeholder="Context, focus block, or deadline hint..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)]"
                />
              </div>

              {actionError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!commitmentText.trim() || isSavingCommitment}
                  className="px-4 py-2 rounded-xl bg-[var(--gv-accent)] hover:bg-[var(--gv-accent-hover)] text-white text-xs font-semibold shadow-xs transition disabled:opacity-40"
                >
                  {isSavingCommitment ? 'Saving…' : 'Save Commitment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Snooze Modal */}
      {snoozeTargetMemory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--gv-surface-raised)] border border-[var(--gv-border-strong)] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Snooze Loop
              </span>
              <button
                type="button"
                onClick={() => setSnoozeTargetMemory(null)}
                className="text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--gv-text-secondary)]">
              Pause active alerts on &ldquo;{snoozeTargetMemory.fact}&rdquo; until:
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '3 days', days: 3 },
                { label: '1 week', days: 7 },
                { label: '2 weeks', days: 14 },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setSnoozeDays(opt.days)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    snoozeDays === opt.days
                      ? 'bg-[var(--gv-accent-muted)] border-[var(--gv-accent)] text-[var(--gv-text-primary)]'
                      : 'bg-[var(--gv-surface-ground)] border-[var(--gv-border-default)] text-[var(--gv-text-secondary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSnoozeTargetMemory(null)}
                className="px-4 py-2 rounded-xl text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplySnooze}
                disabled={isSnoozing}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-xs transition disabled:opacity-40"
              >
                {isSnoozing ? 'Snoozing…' : 'Apply Snooze'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
