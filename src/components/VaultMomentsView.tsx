import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Calendar,
  MapPin,
  Trash2,
  Brain,
  MessageSquare,
  ArrowRight,
  X,
  Check,
  BookOpen,
  ChevronRight,
  AlertCircle,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VaultMoment, Memory, JournalSession } from '../types';

interface VaultMomentsViewProps {
  onOpenSession: (sessionId: string) => void;
}

export const VaultMomentsView: React.FC<VaultMomentsViewProps> = ({ onOpenSession }) => {
  const { getIdToken } = useAuth();

  const [moments, setMoments] = useState<VaultMoment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMoment, setSelectedMoment] = useState<VaultMoment | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Available sources for creating a moment
  const [availableMemories, setAvailableMemories] = useState<Memory[]>([]);
  const [availableSessions, setAvailableSessions] = useState<JournalSession[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);

  // Form state
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [momentTitle, setMomentTitle] = useState<string>('');
  const [momentNotes, setMomentNotes] = useState<string>('');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Fetch moments list
  const fetchMoments = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/moments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMoments(Array.isArray(data.moments) ? data.moments : []);
      }
    } catch (err) {
      console.error('[VaultMomentsView] Error fetching moments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoments();
  }, []);

  // Fetch sources when opening create modal
  const openCreateModal = async () => {
    setIsCreating(true);
    setCreationError(null);
    setSelectedMemoryIds([]);
    setSelectedSessionIds([]);
    setMomentTitle('');
    setMomentNotes('');

    try {
      setLoadingSources(true);
      const token = await getIdToken();
      if (!token) return;

      const [mRes, sRes] = await Promise.all([
        fetch('/api/memories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/journal/sessions', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setAvailableMemories(Array.isArray(mData.memories) ? mData.memories : []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setAvailableSessions(Array.isArray(sData.sessions) ? sData.sessions : []);
      }
    } catch (err) {
      console.error('[VaultMomentsView] Error loading sources:', err);
    } finally {
      setLoadingSources(false);
    }
  };

  // Submit create moment
  const handleCreateMoment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemoryIds.length === 0 && selectedSessionIds.length === 0 && !momentNotes.trim()) {
      setCreationError('Please select at least one memory, reflection, or enter reflection notes.');
      return;
    }

    try {
      setIsSynthesizing(true);
      setCreationError(null);
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/moments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: momentTitle.trim() || undefined,
          userNotes: momentNotes.trim() || undefined,
          memoryIds: selectedMemoryIds,
          reflectionIds: selectedSessionIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to synthesize moment.');
      }

      if (data.moment) {
        setMoments((prev) => [data.moment, ...prev]);
        setSelectedMoment(data.moment);
        setIsCreating(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating moment.';
      setCreationError(msg);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Delete moment
  const handleDeleteMoment = async (momentId: string) => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/moments/${momentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setMoments((prev) => prev.filter((m) => m.id !== momentId));
        if (selectedMoment?.id === momentId) {
          setSelectedMoment(null);
        }
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error('[VaultMomentsView] Error deleting moment:', err);
    }
  };

  const toggleMemorySelection = (id: string) => {
    setSelectedMemoryIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const toggleSessionSelection = (id: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const formatDate = (isoString?: string | unknown) => {
    if (!isoString || typeof isoString !== 'string') return 'Recent';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="min-h-full bg-[var(--gv-surface-ground)] text-[var(--gv-text-primary)] transition-colors duration-150">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--gv-border-subtle)] pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gv-accent-text)]">
              <Compass className="w-4 h-4" />
              <span>Personal Timeline & Arc</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-serif text-[var(--gv-text-primary)] tracking-tight">
              Vault Moments
            </h1>
            <p className="mt-1.5 max-w-xl text-xs sm:text-sm text-[var(--gv-text-secondary)] leading-relaxed">
              Grounded chapters and milestones synthesized from your approved memories and reflections.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gv-accent)] hover:opacity-90 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Moment</span>
          </button>
        </header>

        {/* Moments Archive Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3 font-sans">
            <div className="w-7 h-7 border-2 border-[var(--gv-accent)] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-[var(--gv-text-tertiary)] font-serif">Opening moments archive…</p>
          </div>
        ) : moments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--gv-border-default)] bg-[var(--gv-surface-base)]/50 p-10 sm:p-14 text-center space-y-4 max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center text-[var(--gv-accent-gold)] mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-serif font-medium text-[var(--gv-text-primary)]">
              No moments recorded yet
            </h2>
            <p className="text-xs text-[var(--gv-text-secondary)] leading-relaxed max-w-md mx-auto">
              Vault Moments weave your reflections and approved memories into enduring personal milestones.
              Create your first moment whenever you reach a meaningful shift or chapter.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-semibold transition hover:opacity-90 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Capture Your First Moment</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-5">
            {moments.map((moment) => (
              <article
                key={moment.id}
                onClick={() => setSelectedMoment(moment)}
                className="group relative rounded-2xl border border-[var(--gv-border-default)] hover:border-[var(--gv-border-strong)] bg-[var(--gv-surface-base)] p-5 sm:p-6 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-4 text-xs text-[var(--gv-text-tertiary)] mb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 font-mono font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(moment.occurredAt || moment.createdAt)}
                      </span>
                      {moment.locationContext && (
                        <span className="inline-flex items-center gap-1 text-[var(--gv-accent-text)] font-sans">
                          <MapPin className="w-3 h-3" />
                          {moment.locationContext.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] font-medium text-[var(--gv-text-secondary)]">
                        {moment.provenance?.memoryCount || 0} memories · {moment.provenance?.reflectionCount || 0} reflections
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(moment.id);
                        }}
                        className="p-1 rounded-lg text-[var(--gv-text-tertiary)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete Moment"
                        aria-label="Delete Moment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg sm:text-xl font-serif font-medium text-[var(--gv-text-primary)] group-hover:text-[var(--gv-accent-text)] transition-colors">
                    {moment.title}
                  </h3>

                  <p className="mt-2.5 text-xs sm:text-sm text-[var(--gv-text-secondary)] leading-relaxed font-sans line-clamp-3">
                    {moment.narrative}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--gv-border-subtle)] flex items-center justify-between text-xs text-[var(--gv-text-tertiary)] font-sans">
                  <span className="italic">
                    {moment.provenance?.synthesizedBy === 'manual'
                      ? 'Direct personal authoring'
                      : 'Synthesized via Gemini Vault'}
                  </span>
                  <span className="text-[var(--gv-accent-text)] inline-flex items-center gap-1 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Read chapter</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
              <h4 className="text-sm font-serif font-medium text-[var(--gv-text-primary)]">
                Delete this Vault Moment?
              </h4>
              <p className="text-xs text-[var(--gv-text-secondary)] leading-relaxed">
                This will remove the synthesized moment entry. The constituent memories and reflection sessions will remain safe in your vault.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-3 py-1.5 rounded-xl bg-[var(--gv-surface-raised)] text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMoment(deleteConfirmId)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Moment Detail Modal / Reader */}
        {selectedMoment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto">
            <div className="bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-turn-enter my-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[var(--gv-text-tertiary)] font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(selectedMoment.occurredAt || selectedMoment.createdAt)}</span>
                    {selectedMoment.locationContext && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-[var(--gv-accent-text)] font-sans">
                          <MapPin className="w-3 h-3" />
                          {selectedMoment.locationContext.label}
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-2 text-xl sm:text-2xl font-serif font-medium text-[var(--gv-text-primary)]">
                    {selectedMoment.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMoment(null)}
                  className="p-1.5 rounded-xl text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] transition"
                  aria-label="Close moment"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Narrative Text */}
              <div className="prose prose-stone dark:prose-invert max-w-none text-[15px] sm:text-[16px] font-serif leading-[1.85] text-[var(--gv-text-primary)] whitespace-pre-wrap border-y border-[var(--gv-border-subtle)] py-5">
                {selectedMoment.narrative}
              </div>

              {/* Grounded Source Evidence Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--gv-text-tertiary)]">
                  Grounded In Vault Context ({selectedMoment.provenance?.sourceRecordCount || 0} Sources)
                </h4>

                {selectedMoment.reflectionIds && selectedMoment.reflectionIds.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-[var(--gv-text-tertiary)] font-medium">Reflections:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedMoment.reflectionIds.map((refId) => (
                        <button
                          key={refId}
                          type="button"
                          onClick={() => {
                            setSelectedMoment(null);
                            onOpenSession(refId);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] border border-[var(--gv-border-subtle)] text-xs font-sans text-[var(--gv-text-primary)] transition cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3 text-[var(--gv-accent-gold)]" />
                          <span>View Reflection</span>
                          <ArrowRight className="w-3 h-3 text-[var(--gv-text-tertiary)]" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedMoment.memoryIds && selectedMoment.memoryIds.length > 0 && (
                  <div className="text-xs text-[var(--gv-text-secondary)] font-sans">
                    Anchored to {selectedMoment.memoryIds.length} approved vault {selectedMoment.memoryIds.length === 1 ? 'memory' : 'memories'}.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMoment(null)}
                  className="px-5 py-2 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-primary)] text-xs font-semibold transition cursor-pointer"
                >
                  Close Reader
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Moment Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto">
            <div className="bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-turn-enter my-auto">
              <div className="flex items-center justify-between border-b border-[var(--gv-border-subtle)] pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-serif font-medium text-[var(--gv-text-primary)]">
                    Create a Vault Moment
                  </h3>
                  <p className="text-xs text-[var(--gv-text-secondary)] mt-0.5">
                    Select anchor memories or reflections to ground a cohesive chapter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={isSynthesizing}
                  className="p-1.5 rounded-xl text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {creationError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{creationError}</span>
                </div>
              )}

              <form onSubmit={handleCreateMoment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--gv-text-secondary)] mb-1.5">
                    Optional Custom Title
                  </label>
                  <input
                    type="text"
                    value={momentTitle}
                    onChange={(e) => setMomentTitle(e.target.value)}
                    placeholder="Leave blank to let Gemini synthesize a title…"
                    disabled={isSynthesizing}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs sm:text-sm text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--gv-text-secondary)] mb-1.5">
                    Reflection Notes / Context
                  </label>
                  <textarea
                    value={momentNotes}
                    onChange={(e) => setMomentNotes(e.target.value)}
                    rows={2}
                    placeholder="What makes this point in time notable? Any reflections to weave in?"
                    disabled={isSynthesizing}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] text-xs sm:text-sm text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] focus:outline-none focus:border-[var(--gv-accent)] resize-none transition"
                  />
                </div>

                {/* Grounding Source Pickers */}
                <div className="grid sm:grid-cols-2 gap-4 pt-1">
                  {/* Memories Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--gv-text-secondary)] mb-1.5">
                      Select Approved Memories ({selectedMemoryIds.length} chosen)
                    </label>
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)]/50 p-2 space-y-1.5 text-xs">
                      {loadingSources ? (
                        <div className="py-4 text-center text-[var(--gv-text-tertiary)]">Loading memories…</div>
                      ) : availableMemories.length === 0 ? (
                        <div className="py-4 text-center text-[var(--gv-text-tertiary)]">No memories found.</div>
                      ) : (
                        availableMemories.map((m) => {
                          const isSelected = selectedMemoryIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleMemorySelection(m.id)}
                              disabled={isSynthesizing}
                              className={`w-full text-left p-2 rounded-lg border transition flex items-start gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--gv-accent-muted)] border-[var(--gv-accent-border)] text-[var(--gv-text-primary)]'
                                  : 'bg-[var(--gv-surface-base)] border-transparent hover:border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)]'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 mt-0.5 rounded flex items-center justify-center border shrink-0 ${
                                  isSelected
                                    ? 'bg-[var(--gv-accent)] border-[var(--gv-accent)] text-white'
                                    : 'border-[var(--gv-border-strong)]'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="line-clamp-2 leading-relaxed">{m.fact}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Reflections Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--gv-text-secondary)] mb-1.5">
                      Select Reflections ({selectedSessionIds.length} chosen)
                    </label>
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)]/50 p-2 space-y-1.5 text-xs">
                      {loadingSources ? (
                        <div className="py-4 text-center text-[var(--gv-text-tertiary)]">Loading reflections…</div>
                      ) : availableSessions.length === 0 ? (
                        <div className="py-4 text-center text-[var(--gv-text-tertiary)]">No reflections found.</div>
                      ) : (
                        availableSessions.map((s) => {
                          const isSelected = selectedSessionIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleSessionSelection(s.id)}
                              disabled={isSynthesizing}
                              className={`w-full text-left p-2 rounded-lg border transition flex items-start gap-2 cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--gv-accent-muted)] border-[var(--gv-accent-border)] text-[var(--gv-text-primary)]'
                                  : 'bg-[var(--gv-surface-base)] border-transparent hover:border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)]'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 mt-0.5 rounded flex items-center justify-center border shrink-0 ${
                                  isSelected
                                    ? 'bg-[var(--gv-accent)] border-[var(--gv-accent)] text-white'
                                    : 'border-[var(--gv-border-strong)]'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="line-clamp-1 font-serif">{s.title || 'Untitled Session'}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--gv-border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    disabled={isSynthesizing}
                    className="px-4 py-2 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] text-xs font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSynthesizing}
                    className="px-5 py-2.5 rounded-xl bg-[var(--gv-accent)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isSynthesizing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Synthesizing Moment…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Synthesize Moment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
