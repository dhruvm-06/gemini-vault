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
} from 'lucide-react';
import { MemoryCandidate, MemoryCategory } from '../types';

interface MemoryReviewCardProps {
  candidate: MemoryCandidate;
  sessionTitle?: string;
  onSave: (candidate: MemoryCandidate) => Promise<void>;
  onDismiss: (candidateId: string) => void;
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
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  project: {
    label: 'Project',
    icon: Briefcase,
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  preference: {
    label: 'Preference',
    icon: Heart,
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  important_context: {
    label: 'Important Context',
    icon: Bookmark,
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  recurring_theme: {
    label: 'Recurring Theme',
    icon: Repeat,
    badgeClass: 'bg-stone-500/15 text-stone-300 border-stone-600/30',
  },
  commitment: {
    label: 'Commitment',
    icon: ShieldCheck,
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
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
          ? 'bg-stone-900/40 border-emerald-500/30 ring-1 ring-emerald-500/20'
          : 'bg-stone-900/80 border-stone-800 hover:border-stone-700/80 shadow-lg'
      }`}
    >
      {/* Header: Category Pill and Provenance */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${meta.badgeClass}`}
          >
            <CategoryIcon className="w-3 h-3" />
            <span>{meta.label}</span>
          </span>

        </div>

        {sessionTitle && (
          <span className="text-[11px] text-stone-500 truncate max-w-[200px]" title={sessionTitle}>
            From: {sessionTitle}
          </span>
        )}
      </div>

      {/* Main Fact or Edit Form */}
      {isEditing ? (
        <div className="space-y-3.5 py-1">
          <div>
            <label className="block text-[11px] font-medium text-stone-400 mb-1">
              Memory Statement (Durable Fact)
            </label>
            <textarea
              value={factText}
              onChange={(e) => setFactText(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full p-2.5 bg-stone-950 border border-stone-700 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500/60 font-sans leading-relaxed resize-none"
              placeholder="Refine this durable memory statement..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MemoryCategory)}
                className="w-full p-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500/60 font-sans"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Personal Notes (Optional)
              </label>
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                maxLength={1000}
                placeholder="Add your own context..."
                className="w-full p-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500/60 font-sans"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-100 text-xs font-medium transition cursor-pointer"
            >
              Done Editing
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-serif text-stone-100 leading-relaxed font-normal">
            "{factText}"
          </p>

          {userNotes && (
            <p className="text-xs text-stone-400 italic bg-stone-950/40 px-2.5 py-1.5 rounded-lg border border-stone-800/80">
              Note: {userNotes}
            </p>
          )}
        </div>
      )}

      {/* Action Footer: Save, Edit, Dismiss */}
      <div className="mt-4 pt-3.5 border-t border-stone-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!isSaved && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 text-xs transition cursor-pointer"
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
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800/40 text-xs transition cursor-pointer disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              <span>Dismiss</span>
            </button>
          )}
        </div>

        <div>
          {isSaved ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Saved to Vault</span>
            </span>
          ) : (
            <button
              type="button"
              id={`save-memory-btn-${candidate.id}`}
              onClick={handleTriggerSave}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold shadow-sm hover:shadow transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Memory</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
