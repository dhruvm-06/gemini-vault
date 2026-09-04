import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock3,
  Edit2,
  Search,
  Target,
  X,
  RotateCcw,
  Archive,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JournalSession, Memory } from '../types';
import { toTimestamp } from '../utils/time';

type SessionRecord = JournalSession & {
  rootSessionId?: string;
  continuedFromSessionId?: string | null;
  updatedAt?: string | { seconds?: number; _seconds?: number };
};

type VaultMemory = Memory & {
  loopStatus?: 'open' | 'snoozed' | 'resolved';
  snoozedUntil?: string | null;
  updatedAt?: string | null;
};

interface VaultDashboardProps {
  onOpenSession: (sessionId: string) => void;
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'memory' | 'loop'>('all');
  const [editing, setEditing] = useState<VaultMemory | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

  const loopMemories = useMemo(
    () => memories.filter((m) =>
      (m.category === 'goal' || m.category === 'commitment') &&
      m.loopStatus !== 'resolved'
    ),
    [memories]
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'memory' && !(memory.category === 'goal' || memory.category === 'commitment')) ||
        (activeFilter === 'loop' && (memory.category === 'goal' || memory.category === 'commitment'));
      const matchesQuery = !text ||
        `${memory.fact} ${memory.category} ${memory.userNotes || ''}`.toLowerCase().includes(text);
      return matchesFilter && matchesQuery;
    });
  }, [memories, query, activeFilter]);

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
      setMemories((prev) => prev.map((item) => item.id === memory.id ? { ...item, ...(data.memory || patch) } : item));
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

  return (
    <div className="min-h-full bg-stone-900 text-stone-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-amber-400 font-medium">
                <Bookmark className="w-3.5 h-3.5" />
                Your Vault
              </div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-serif text-stone-100">Memory, context, and unfinished things.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                Everything here is grounded in what you chose to keep. Edit it, revisit its source, or close an intention when it is no longer open.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                ['Memories', memories.length],
                ['Open loops', loopMemories.length],
                ['Reflections', sessions.filter((s) => s.status === 'completed').length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 min-w-[90px]">
                  <div className="text-[10px] text-stone-600">{label}</div>
                  <div className="mt-1 text-xl font-semibold text-stone-100">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-4">
            <section className="rounded-2xl border border-stone-800 bg-stone-950 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-stone-800/80 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-serif text-stone-100">Your remembered context</h2>
                  <p className="mt-1 text-xs text-stone-500">Search and manage what your Vault carries forward.</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search memories…"
                    className="w-full rounded-xl bg-stone-900 border border-stone-800 pl-9 pr-3 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500/40"
                  />
                </div>
              </div>

              <div className="px-4 sm:px-5 py-3 border-b border-stone-800/70 flex gap-2 overflow-x-auto">
                {([
                  ['all', 'All'],
                  ['memory', 'Context'],
                  ['loop', 'Open loops'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                      activeFilter === value
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="p-10 text-center text-xs text-stone-600">Loading your Vault…</div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <Sparkles className="w-5 h-5 text-stone-700 mx-auto" />
                  <p className="mt-3 text-sm font-serif text-stone-400">Nothing matches that view.</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-800/70">
                  {filtered.map((memory) => {
                    const isLoop = memory.category === 'goal' || memory.category === 'commitment';
                    return (
                      <article key={memory.id} className="p-4 sm:p-5 hover:bg-stone-900/50 transition">
                        <div className="flex items-start gap-4">
                          <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isLoop ? 'bg-amber-500/10 text-amber-300 border border-amber-500/15' : 'bg-stone-900 text-stone-400 border border-stone-800'
                          }`}>
                            {isLoop ? <Target className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                              <span className="text-[11px] font-semibold text-amber-300">{categoryLabel(memory.category)}</span>
                              {isLoop && memory.loopStatus && (
                                <span className="text-[10px] text-stone-600 flex items-center gap-1">
                                  <Clock3 className="w-3 h-3" />
                                  {memory.loopStatus === 'open' ? 'Open' : memory.loopStatus === 'snoozed' ? 'Snoozed' : 'Resolved'}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-[15px] font-serif text-stone-100 leading-6">{memory.fact}</p>
                            {memory.userNotes && <p className="mt-2 text-xs text-stone-500">{memory.userNotes}</p>}
                            <div className="mt-3 flex flex-wrap gap-2 items-center text-[11px] text-stone-600">
                              <span>From {sessionTitle(memory.sourceSessionId)}</span>
                              <button
                                type="button"
                                onClick={() => memory.sourceSessionId && onOpenSession(memory.sourceSessionId)}
                                className="text-stone-500 hover:text-amber-300 inline-flex items-center gap-1"
                              >
                                Open source <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(memory);
                                setEditValue(memory.fact);
                              }}
                              className="p-2 rounded-lg border border-stone-800 text-stone-600 hover:text-stone-200 cursor-pointer"
                              aria-label="Edit memory"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isLoop && memory.loopStatus !== 'resolved' && (
                              <button
                                type="button"
                                onClick={() => resolveLoop(memory)}
                                className="p-2 rounded-lg border border-stone-800 text-stone-600 hover:text-emerald-300 cursor-pointer"
                                aria-label="Resolve loop"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-amber-500/20 bg-stone-950 p-4">
                <div className="flex items-center gap-2 text-amber-300">
                  <Target className="w-4 h-4" />
                  <h2 className="text-sm font-medium">Open loops</h2>
                </div>
                <p className="mt-1 text-xs text-stone-500">Intentions that are still alive.</p>
                <div className="mt-4 space-y-2.5">
                  {loopMemories.slice(0, 5).map((memory) => (
                    <div key={memory.id} className="rounded-xl border border-stone-800 bg-stone-900/50 p-3">
                      <div className="text-[10px] text-amber-300">{categoryLabel(memory.category)}</div>
                      <p className="mt-1 text-xs leading-5 text-stone-300">{memory.fact}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button type="button" onClick={() => memory.sourceSessionId && onOpenSession(memory.sourceSessionId)} className="text-[10px] text-stone-600 hover:text-amber-300">Revisit</button>
                        <button type="button" onClick={() => resolveLoop(memory)} className="text-[10px] text-stone-600 hover:text-emerald-300">Mark resolved</button>
                      </div>
                    </div>
                  ))}
                  {loopMemories.length === 0 && <p className="text-xs text-stone-600">No open intentions.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-stone-800 bg-stone-950 p-4">
                <div className="flex items-center gap-2 text-stone-200">
                  <Archive className="w-4 h-4 text-stone-500" />
                  <h2 className="text-sm font-medium">Recent sources</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {sessions.filter((s) => s.status === 'completed').slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="w-full rounded-xl border border-stone-800 bg-stone-900/40 px-3 py-2.5 hover:border-stone-700 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenSession(session.id)}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="text-xs text-stone-300 truncate">{session.title || 'Reflection'}</div>
                        <div className="mt-1 text-[10px] text-stone-600">Open reflection</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onContinueSession(session.id)}
                        className="text-[10px] text-stone-500 hover:text-amber-300 shrink-0 px-2 py-1 rounded bg-stone-900 border border-stone-800 hover:border-amber-500/30 transition cursor-pointer"
                        title="Continue this reflection"
                      >
                        Continue
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-xs text-stone-300 shadow-2xl">
          {message}
          <button type="button" onClick={() => setMessage('')} className="ml-3 text-stone-600 hover:text-stone-200">Dismiss</button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[90] bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-stone-800 bg-stone-900 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif text-stone-100">Edit memory</h2>
                <p className="mt-1 text-xs text-stone-500">Change the wording without changing its provenance.</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="p-2 rounded-lg text-stone-600 hover:text-stone-200"><X className="w-4 h-4" /></button>
            </div>
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={5} className="mt-5 w-full rounded-xl bg-stone-950 border border-stone-800 px-3.5 py-3 text-sm text-stone-100 focus:outline-none focus:border-amber-500/40 resize-y" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3.5 py-2 rounded-xl border border-stone-700 text-stone-400 text-xs">Cancel</button>
              <button type="button" disabled={saving || !editValue.trim()} onClick={saveEdit} className="px-3.5 py-2 rounded-xl bg-amber-500 text-stone-950 text-xs font-semibold disabled:opacity-50">Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};