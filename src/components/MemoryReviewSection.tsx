import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, ArrowRight, Loader2, AlertCircle, RefreshCw, Bookmark } from 'lucide-react';
import { Memory, MemoryCandidate } from '../types';
import { MemoryReviewCard } from './MemoryReviewCard';

interface MemoryReviewSectionProps {
  sessionId: string;
  sessionTitle?: string;
  getIdToken: () => Promise<string | null>;
  onDone: () => void;
}

export const MemoryReviewSection: React.FC<MemoryReviewSectionProps> = ({
  sessionId,
  sessionTitle,
  getIdToken,
  onDone,
}) => {
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [savedMemories, setSavedMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch candidate suggestions and existing memories
  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication token unavailable.');
        setLoading(false);
        return;
      }

      // 1. Fetch already-saved memories for this session
      try {
        const savedRes = await fetch(`/api/memories?sessionId=${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (savedRes.ok) {
          const savedData = await savedRes.json();
          if (Array.isArray(savedData.memories)) {
            setSavedMemories(savedData.memories);
          }
        }
      } catch (err) {
        console.warn('[MemoryReview] Could not fetch saved memories:', err);
      }

      // 2. Request candidate memory extraction from Vertex AI
      const extractRes = await fetch('/api/memories/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!extractRes.ok) {
        const errData = await extractRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to extract memory candidates.');
      }

      const data = await extractRes.json();
      if (Array.isArray(data.candidates)) {
        setCandidates(data.candidates);
      } else {
        setCandidates([]);
      }
    } catch (err: unknown) {
      console.error('[MemoryReview] Extraction failed:', err);
      setError(err instanceof Error ? err.message : 'Unable to extract memory suggestions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [sessionId]);

  const handleSave = async (candidate: MemoryCandidate) => {
    setSavingId(candidate.id);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          fact: candidate.fact,
          category: candidate.category,
          userNotes: candidate.userNotes || '',
          confidence: candidate.confidence,
          sourceMessageId: candidate.sourceMessageId,
          sourceSnippet: candidate.sourceSnippet,
          turnTimestamp: candidate.turnTimestamp,
          sourceModality: candidate.sourceModality || 'text',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save memory.');
      }

      const data = await res.json();
      if (data.memory) {
        setSavedMemories((prev) => [...prev, data.memory]);
      }

      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, isSaved: true } : c))
      );
    } catch (err: unknown) {
      console.error('[MemoryReview] Error saving memory:', err);
      alert(err instanceof Error ? err.message : 'Could not save memory.');
    } finally {
      setSavingId(null);
    }
  };

  const handleArbitrate = async (
    candidate: MemoryCandidate,
    action: 'supersede' | 'keep_both' | 'mark_evolved' | 'dismiss',
    conflictWithMemoryId: string,
    userNote?: string
  ) => {
    if (action === 'dismiss') {
      handleDismiss(candidate.id);
      return;
    }

    setSavingId(candidate.id);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/memories/arbitrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          candidate: {
            fact: candidate.fact,
            category: candidate.category,
            userNotes: candidate.userNotes || '',
            confidence: candidate.confidence,
            sourceMessageId: candidate.sourceMessageId,
            sourceSnippet: candidate.sourceSnippet,
            turnTimestamp: candidate.turnTimestamp,
            sourceModality: candidate.sourceModality || 'text',
          },
          action,
          conflictWithMemoryId,
          userNote,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to arbitrate memory perspective shift.');
      }

      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, isSaved: true } : c))
      );
    } catch (err: unknown) {
      console.error('[MemoryReview] Error arbitrating memory:', err);
      alert(err instanceof Error ? err.message : 'Could not arbitrate perspective shift.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDismiss = (candidateId: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
  };

  return (
    <div id="memory-review-section" className="space-y-6 pt-6 pb-12 font-sans animate-fade-in">
      {/* Section Header */}
      <div className="bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] rounded-2xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center text-[var(--gv-accent-gold)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-medium text-[var(--gv-text-primary)]">
                Worth remembering?
              </h2>
              <p className="text-xs text-[var(--gv-text-secondary)]">
                Suggestions only. Review, edit, or dismiss each before adding to your Vault.
              </p>
            </div>
          </div>

          {savedMemories.length > 0 && (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[var(--gv-success-muted)] border border-[var(--gv-success-border)] text-[var(--gv-success)] text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{savedMemories.length} memory saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 px-6 rounded-2xl bg-[var(--gv-surface-ground)]/50 border border-[var(--gv-border-subtle)] text-center space-y-3">
          <Loader2 className="w-6 h-6 text-[var(--gv-accent-gold)] animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--gv-text-primary)]">
              Analyzing reflection for durable memories...
            </p>
            <p className="text-[11px] text-[var(--gv-text-tertiary)] max-w-sm mx-auto">
              Extracting candidate goals, projects, preferences, and commitments directly supported by this conversation.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-4 rounded-xl bg-[var(--gv-error-muted)] border border-[var(--gv-error-border)] space-y-3">
          <div className="flex items-start space-x-2 text-xs text-[var(--gv-error-text)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--gv-error)]" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadSuggestions}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-subtle)] text-[var(--gv-text-primary)] text-xs font-medium transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Analysis</span>
          </button>
        </div>
      )}

      {/* Candidates List */}
      {!loading && !error && candidates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-[var(--gv-text-secondary)]">
              Candidate Suggestions ({candidates.length})
            </span>
            <span className="text-[11px] text-[var(--gv-text-tertiary)]">
              Maximum 3 candidates suggested
            </span>
          </div>

          <div className="space-y-3.5">
            {candidates.map((candidate) => (
              <MemoryReviewCard
                key={candidate.id}
                candidate={candidate}
                sessionTitle={sessionTitle}
                onSave={handleSave}
                onDismiss={handleDismiss}
                onArbitrate={handleArbitrate}
                isSaving={savingId === candidate.id}
                isSaved={!!candidate.isSaved}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Candidates Message */}
      {!loading && !error && candidates.length === 0 && (
        <div className="py-10 px-6 rounded-2xl bg-[var(--gv-surface-ground)]/40 border border-[var(--gv-border-subtle)] text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-[var(--gv-surface-raised)] flex items-center justify-center mx-auto text-[var(--gv-text-tertiary)]">
            <Bookmark className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium text-[var(--gv-text-primary)]">
            No durable memories identified in this reflection.
          </p>
          <p className="text-[11px] text-[var(--gv-text-tertiary)] max-w-md mx-auto leading-relaxed">
            That is completely normal — not every session contains long-term facts, projects, or commitments. Your session conversation is securely archived.
          </p>
        </div>
      )}

      {/* Saved Memories Summary */}
      {savedMemories.length > 0 && (
        <div className="pt-2">
          <div className="p-4 rounded-xl bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] space-y-2">
            <div className="flex items-center space-x-2 text-xs font-medium text-[var(--gv-success)]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Persisted to Vault Memories ({savedMemories.length})</span>
            </div>
            <ul className="space-y-1.5 pl-6 list-disc text-xs text-[var(--gv-text-secondary)] font-serif">
              {savedMemories.map((m) => (
                <li key={m.id} className="leading-relaxed">
                  <span className="text-[var(--gv-text-primary)] font-sans font-medium text-[11px] capitalize mr-1">
                    [{m.category.replace('_', ' ')}]:
                  </span>
                  &ldquo;{m.fact}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Completion Action */}
      <div className="pt-4 border-t border-[var(--gv-border-subtle)] flex items-center justify-between">
        <span className="text-xs text-[var(--gv-text-tertiary)]">
          This reflection is safely concluded and archived.
        </span>

        <button
          id="done-review-btn"
          onClick={onDone}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[var(--gv-accent)] hover:bg-[var(--gv-accent-hover)] text-white text-xs font-medium shadow-xs transition cursor-pointer"
        >
          <span>Done & Return to Journal</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
