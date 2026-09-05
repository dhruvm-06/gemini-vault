import React, { useState } from 'react';
import {
  Target,
  Briefcase,
  Heart,
  Bookmark,
  Repeat,
  ShieldCheck,
  Check,
  Edit2,
  X,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { MemoryCandidate, MemoryCategory } from '../types';

interface MemoryReviewCardProps {
  candidate: MemoryCandidate;
  sessionTitle?: string;
  onSave: (candidate: MemoryCandidate) => Promise<void>;
  onDismiss: (candidateId: string) => void;
  onArbitrate?: (
    candidate: MemoryCandidate,
    action: 'supersede' | 'keep_both' | 'mark_evolved' | 'dismiss',
    conflictWithMemoryId: string,
    userNote?: string
  ) => Promise<void>;
  isSaving: boolean;
  isSaved: boolean;
}

const CATEGORY_META: Record<
  MemoryCategory,
  { label: string; icon: React.ElementType; badgeClass: string }
> = {
  goal: {
    label: 'Goal',
    icon: Target,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  },
  project: {
    label: 'Project',
    icon: Briefcase,
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
  },
  preference: {
    label: 'Preference',
    icon: Heart,
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25',
  },
  important_context: {
    label: 'Important Context',
    icon: Bookmark,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  },
  recurring_theme: {
    label: 'Recurring Theme',
    icon: Repeat,
    badgeClass: 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30',
  },
  commitment: {
    label: 'Commitment',
    icon: ShieldCheck,
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  },
};

const ALL_CATEGORIES: MemoryCategory[] = [
  'goal',
  'project',
  'preference',
  'important_context',
  'recurring_theme',
  'commitment',
];

export const MemoryReviewCard: React.FC<MemoryReviewCardProps> = ({
  candidate,
  sessionTitle,
  onSave,
  onDismiss,
  onArbitrate,
  isSaving,
  isSaved,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [factText, setFactText] = useState(candidate.fact);
  const [category, setCategory] = useState<MemoryCategory>(candidate.category);
  const [userNotes, setUserNotes] = useState(candidate.userNotes || '');

  const meta = CATEGORY_META[category] || CATEGORY_META.important_context;
  const CategoryIcon = meta.icon;

  const handleSaveEdit = () => {
    if (!factText.trim()) return;
    setIsEditing(false);
  };

  const handleTriggerSave = async () => {
    await onSave({
      ...candidate,
      fact: factText.trim(),
      category,
      userNotes: userNotes.trim(),
    });
  };

  return (
    <div
      id={`memory-card-${candidate.id}`}
      className={`rounded-2xl border transition-all duration-300 p-5 ${
        isSaved
          ? 'bg-[var(--gv-surface-ground)]/70 border-[var(--gv-success-border)] ring-1 ring-[var(--gv-success-border)]'
          : 'bg-[var(--gv-surface-base)] border-[var(--gv-border-default)] hover:border-[var(--gv-border-strong)] shadow-sm'
      }`}
    >
      {/* Header: Category Pill and Session */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${meta.badgeClass}`}
          >
            <CategoryIcon className="w-3 h-3" />
            <span>{meta.label}</span>
          </span>

          {candidate.conflictWithMemoryId && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-medium bg-[var(--gv-accent-muted)] text-[var(--gv-accent-text)] border border-[var(--gv-accent-border)]">
              <Sparkles className="w-2.5 h-2.5 text-[var(--gv-accent-gold)]" />
              <span>Perspective Shift</span>
            </span>
          )}
        </div>

        {sessionTitle && (
          <span
            className="text-[11px] text-[var(--gv-text-tertiary)] truncate max-w-[200px]"
            title={sessionTitle}
          >
            From: {sessionTitle}
          </span>
        )}
      </div>

      {/* Main Fact or Edit Form */}
      {isEditing ? (
        <div className="space-y-3.5 py-1">
          <div>
            <label className="block text-[11px] font-medium text-[var(--gv-text-tertiary)] mb-1">
              Memory Statement (Durable Fact)
            </label>
            <textarea
              value={factText}
              onChange={(e) => setFactText(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full p-2.5 bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] rounded-xl text-xs text-[var(--gv-text-primary)] focus:outline-none focus:border-[var(--gv-accent)] font-sans leading-relaxed resize-none"
              placeholder="Refine this durable memory statement..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--gv-text-tertiary)] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MemoryCategory)}
                className="w-full p-2 bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] rounded-xl text-xs text-[var(--gv-text-primary)] focus:outline-none focus:border-[var(--gv-accent)] font-sans"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--gv-text-tertiary)] mb-1">
                Personal Notes (Optional)
              </label>
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                maxLength={1000}
                placeholder="Add your own context..."
                className="w-full p-2 bg-[var(--gv-surface-ground)] border border-[var(--gv-border-default)] rounded-xl text-xs text-[var(--gv-text-primary)] focus:outline-none focus:border-[var(--gv-accent)] font-sans"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-lg bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-3 py-1.5 rounded-lg bg-[var(--gv-accent)] text-white text-xs font-medium hover:opacity-90 transition cursor-pointer"
            >
              Done Editing
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm sm:text-[15px] font-serif text-[var(--gv-text-primary)] leading-relaxed font-normal">
            &ldquo;{factText}&rdquo;
          </p>

          {userNotes && (
            <p className="text-xs text-[var(--gv-text-secondary)] italic bg-[var(--gv-surface-ground)] px-2.5 py-1.5 rounded-lg border border-[var(--gv-border-subtle)]">
              Note: {userNotes}
            </p>
          )}

          {/* Verbatim Source Provenance Quote */}
          {candidate.sourceSnippet && (
            <div className="mt-3 p-3 rounded-xl bg-[var(--gv-surface-ground)]/90 border border-[var(--gv-border-subtle)] text-xs font-sans">
              <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px] text-[var(--gv-text-tertiary)] uppercase tracking-wider font-medium">
                <span className="flex items-center gap-1.5">
                  <span>Verbatim Evidence</span>
                  {candidate.sourceModality === 'voice' && (
                    <span className="px-1.5 py-0.2 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-accent)] font-mono lowercase text-[9px]">
                      spoken turn
                    </span>
                  )}
                </span>
                {candidate.sourceMessageId && (
                  <a
                    href={`/?session=${candidate.sourceSessionId}&turn=${candidate.sourceMessageId}`}
                    className="text-[var(--gv-accent)] hover:underline inline-flex items-center gap-1 font-normal lowercase"
                    onClick={(e) => {
                      const el = document.getElementById(`turn-${candidate.sourceMessageId}`);
                      if (el) {
                        e.preventDefault();
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('gv-provenance-pulse');
                        setTimeout(() => el.classList.remove('gv-provenance-pulse'), 4500);
                      }
                    }}
                  >
                    <span>view source turn</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <p className="italic font-serif text-[var(--gv-text-secondary)] leading-relaxed text-xs">
                &ldquo;{candidate.sourceSnippet}&rdquo;
              </p>
            </div>
          )}

          {/* Perspective Shift / Contradiction Arbitration Box */}
          {candidate.conflictWithMemoryId && (
            <div className="mt-3 p-3.5 rounded-xl bg-[var(--gv-accent-muted)]/20 border border-[var(--gv-accent-border)] text-xs font-sans">
              <div className="flex items-center gap-1.5 text-[var(--gv-accent)] font-medium text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                <span>Perspective Shift Arbitration</span>
              </div>
              {candidate.conflictRationale && (
                <p className="text-[var(--gv-text-secondary)] text-xs leading-relaxed mb-3">
                  {candidate.conflictRationale}
                </p>
              )}
              {!isSaved && onArbitrate && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      onArbitrate(candidate, 'supersede', candidate.conflictWithMemoryId!)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--gv-accent)] text-white hover:opacity-90 transition text-[11px] font-medium text-center cursor-pointer disabled:opacity-50"
                    title="Archive older perspective and set this new memory as active"
                  >
                    Update Perspective
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      onArbitrate(candidate, 'mark_evolved', candidate.conflictWithMemoryId!)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-[var(--gv-text-primary)] hover:bg-[var(--gv-border-subtle)] transition text-[11px] font-medium text-center cursor-pointer disabled:opacity-50"
                    title="Keep both and record evolutionary progression"
                  >
                    Mark Evolved
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      onArbitrate(candidate, 'keep_both', candidate.conflictWithMemoryId!)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] transition text-[11px] font-medium text-center cursor-pointer disabled:opacity-50"
                    title="Retain both as valid concurrent perspectives"
                  >
                    Keep Both
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      onArbitrate(candidate, 'dismiss', candidate.conflictWithMemoryId!)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-secondary)] transition text-[11px] font-medium text-center cursor-pointer disabled:opacity-50"
                    title="Dismiss this candidate suggestion"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Footer: Save, Edit, Dismiss */}
      <div className="mt-4 pt-3.5 border-t border-[var(--gv-border-subtle)] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!isSaved && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] text-xs transition cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}

          {!isSaved && (
            <button
              type="button"
              onClick={() => onDismiss(candidate.id)}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-secondary)] hover:bg-[var(--gv-surface-raised)] text-xs transition cursor-pointer disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              <span>Dismiss</span>
            </button>
          )}
        </div>

        <div>
          {isSaved ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[var(--gv-success-muted)] border border-[var(--gv-success-border)] text-[var(--gv-success)] text-xs font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Saved to Vault</span>
            </span>
          ) : !candidate.conflictWithMemoryId ? (
            <button
              type="button"
              id={`save-memory-btn-${candidate.id}`}
              onClick={handleTriggerSave}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--gv-accent)] hover:bg-[var(--gv-accent-hover)] text-white text-xs font-medium shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                  <span>Save Memory</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
