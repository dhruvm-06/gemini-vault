import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  ArrowLeft,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  X,
  RotateCcw,
  User,
  Lock,
  Calendar,
  Bell,
  Clock,
  MapPin,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JournalSession, JournalMessage, ContextRailItem, LocationContext, ReflectionMode, ActionSuggestion } from '../types';
import { FormattedResponse } from './FormattedResponse';
import { MemoryReviewSection } from './MemoryReviewSection';
import { VaultPresence } from './VaultPresence';
import { VoiceStudioView } from './VoiceStudioView';
import { ActionConfirmationCard } from './ActionConfirmationCard';
import { createGoogleCalendarUrl, detectActionSuggestions } from '../utils/actionHandoffs';

/* ============================================================================
   Presentational Decomposition Components
   (Strictly rendering layers — all state and orchestration remain in JournalSessionView)
   ============================================================================ */

export type SessionWithContinuation = JournalSession & {
  continuedFromSessionId?: string | null;
  rootSessionId?: string | null;
  updatedAt?: unknown;
};

interface ReflectHeaderProps {
  session: SessionWithContinuation | null;
  isCompleted: boolean;
  isEditingTitle: boolean;
  editTitleValue: string;
  reflectionMode: ReflectionMode;
  onReflectionModeChange: (mode: ReflectionMode) => void;
  onBack: () => void;
  onStartEditTitle: () => void;
  onSaveTitle: () => void;
  onCancelEditTitle: () => void;
  onTitleChange: (value: string) => void;
  onOpenConcludeModal: () => void;
  onEnterVoiceMode?: () => void;
  onSummarize?: () => void;
  isSummarizing?: boolean;
  onExtractActions?: () => void;
  isExtractingActions?: boolean;
}

export const ReflectHeader: React.FC<ReflectHeaderProps> = ({
  session,
  isCompleted,
  isEditingTitle,
  editTitleValue,
  reflectionMode,
  onReflectionModeChange,
  onBack,
  onStartEditTitle,
  onSaveTitle,
  onCancelEditTitle,
  onTitleChange,
  onOpenConcludeModal,
  onEnterVoiceMode,
  onSummarize,
  isSummarizing,
  onExtractActions,
  isExtractingActions,
}) => {
  const { userProfile, updatePreferences } = useAuth();
  const isContinued = Boolean(session?.continuedFromSessionId);

  return (
    <header className="px-4 sm:px-6 py-3.5 border-b border-[var(--gv-border-subtle)] bg-[var(--gv-surface-base)]/85 backdrop-blur-md flex items-center justify-between shrink-0 z-20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="h-9 w-9 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] border border-[var(--gv-border-subtle)] flex items-center justify-center transition cursor-pointer shrink-0"
          aria-label="Back to Reflections"
          title="Back to Reflections"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {isEditingTitle ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <input
              type="text"
              value={editTitleValue}
              onChange={(e) => onTitleChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--gv-surface-raised)] border border-[var(--gv-accent)] text-[var(--gv-text-primary)] text-sm focus:outline-none font-medium min-w-[200px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveTitle();
                if (e.key === 'Escape') onCancelEditTitle();
              }}
              aria-label="Edit reflection title"
            />
            <button
              type="button"
              onClick={onSaveTitle}
              className="p-1.5 rounded-md bg-[var(--gv-accent)] text-white hover:opacity-90 transition cursor-pointer"
              aria-label="Save title"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancelEditTitle}
              className="p-1.5 rounded-md bg-[var(--gv-surface-raised)] text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer"
              aria-label="Cancel editing"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-serif text-sm sm:text-base font-medium text-[var(--gv-text-primary)] truncate max-w-xs sm:max-w-md md:max-w-lg">
                {session?.title || 'Reflection Session'}
              </h1>
              {!isCompleted && (
                <button
                  type="button"
                  onClick={onStartEditTitle}
                  className="p-1 text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer shrink-0"
                  aria-label="Edit title"
                  title="Rename reflection"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {isContinued && (
              <div className="flex items-center gap-1 text-[11px] text-[var(--gv-accent)] font-sans">
                <RotateCcw className="w-2.5 h-2.5" />
                <span className="truncate">Continued from previous reflection</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Companion Tone & Depth & Mode Contextual Selectors */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--gv-text-secondary)] border border-[var(--gv-border-subtle)] rounded-xl px-2.5 h-9 bg-[var(--gv-surface-ground)]">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--gv-text-tertiary)]">Mode</span>
          <select
            value={reflectionMode}
            onChange={(e) => onReflectionModeChange(e.target.value as ReflectionMode)}
            className="bg-transparent text-xs text-[var(--gv-text-primary)] focus:outline-none cursor-pointer py-0.5 font-medium"
            title="Reflection Mode"
            aria-label="Reflection Mode"
          >
            <option value="reflect" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Reflect</option>
            <option value="deep_reflection" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Deep</option>
            <option value="brainstorm" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Brainstorm</option>
            <option value="reframe" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Reframe</option>
            <option value="action_plan" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Action Plan</option>
            <option value="gratitude" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Gratitude</option>
            <option value="executive_summary" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Summary</option>
          </select>
          <span className="text-[var(--gv-border-strong)]">|</span>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--gv-text-tertiary)]">Tone</span>
          <select
            value={userProfile?.preferences?.conversationTone || 'empathic'}
            onChange={(e) => void updatePreferences({ conversationTone: e.target.value as any })}
            className="bg-transparent text-xs text-[var(--gv-text-primary)] focus:outline-none cursor-pointer py-0.5 font-medium"
            title="Companion reflection tone"
            aria-label="Companion reflection tone"
          >
            <option value="empathic" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Empathic</option>
            <option value="direct" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Direct</option>
            <option value="philosophical" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Philosophical</option>
          </select>
          <span className="text-[var(--gv-border-strong)]">|</span>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--gv-text-tertiary)]">Depth</span>
          <select
            value={userProfile?.preferences?.reflectionDepth || 'balanced'}
            onChange={(e) => void updatePreferences({ reflectionDepth: e.target.value as any })}
            className="bg-transparent text-xs text-[var(--gv-text-primary)] focus:outline-none cursor-pointer py-0.5 font-medium"
            title="Companion reflection depth"
            aria-label="Companion reflection depth"
          >
            <option value="concise" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Concise</option>
            <option value="balanced" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Balanced</option>
            <option value="deep" className="bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)]">Deep</option>
          </select>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] text-[var(--gv-text-tertiary)] px-2.5 h-9 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)]">
          <Lock className="w-2.5 h-2.5 text-[var(--gv-accent)]" />
          <span>Private Vault</span>
        </div>

        {isCompleted ? (
          <span className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[var(--gv-success-muted)] border border-[var(--gv-success-border)] text-[var(--gv-success)] text-xs font-sans font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Concluded</span>
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent)] text-xs font-sans font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gv-accent)] animate-pulse"></span>
              <span>Active</span>
            </span>

            {onSummarize && (
              <button
                type="button"
                onClick={onSummarize}
                disabled={isSummarizing}
                id="summarize-reflection-btn"
                className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] text-xs font-sans font-medium border border-[var(--gv-border-default)] hover:border-[var(--gv-border-accent)] transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                title="Summarize reflection takeaways"
                aria-label="Summarize reflection takeaways"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                <span>{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
              </button>
            )}

            {onExtractActions && (
              <button
                type="button"
                onClick={onExtractActions}
                disabled={isExtractingActions}
                id="extract-actions-btn"
                className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] text-xs font-sans font-medium border border-[var(--gv-border-default)] hover:border-[var(--gv-border-accent)] transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                title="Extract calendar commitments and actions"
                aria-label="Extract calendar commitments and actions"
              >
                <Calendar className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
                <span>{isExtractingActions ? 'Extracting...' : 'Actions'}</span>
              </button>
            )}

            {/* Focus Mode 36px Discoverable Button */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('gv-toggle-focus-mode'))}
              id="enter-focus-mode-btn"
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] text-xs font-sans font-medium border border-[var(--gv-border-default)] hover:border-[var(--gv-border-accent)] transition cursor-pointer shadow-2xs active:scale-95"
              title="Focus Mode (⇧⌘F / Ctrl+Shift+F)"
              aria-label="Focus Mode (⇧⌘F / Ctrl+Shift+F)"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
              <span className="hidden sm:inline">Focus</span>
            </button>

            {onEnterVoiceMode && (
              <button
                type="button"
                onClick={onEnterVoiceMode}
                id="enter-voice-mode-btn"
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-primary)] text-xs font-sans font-medium border border-[var(--gv-border-default)] transition cursor-pointer shadow-2xs active:scale-95"
                title="Enter Voice Reflection Studio"
                aria-label="Enter Voice Reflection Studio"
              >
                <VaultPresence size="micro" state="idle" />
                <span className="hidden sm:inline">Voice</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenConcludeModal}
              id="conclude-reflection-btn"
              className="h-9 px-3.5 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-primary)] text-xs font-sans font-medium border border-[var(--gv-border-default)] transition cursor-pointer shadow-2xs active:scale-95"
            >
              Conclude
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export interface CommitmentSignal {
  id: string;
  fact: string;
  deadline?: string;
}

interface CommitmentCardProps {
  commitment: CommitmentSignal;
  onAddReminder?: (commitment: CommitmentSignal) => void;
  onDismiss?: (id: string) => void;
}

export const CommitmentCard: React.FC<CommitmentCardProps> = ({
  commitment,
  onAddReminder,
  onDismiss,
}) => {
  return (
    <div className="my-4 p-4 rounded-2xl border border-[var(--gv-accent-border)] bg-[var(--gv-surface-ground)]/90 text-xs font-sans shadow-xs animate-turn-enter">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gv-accent)]">
          <Sparkles className="w-3 h-3 text-[var(--gv-accent-gold)]" />
          <span>Commitment detected</span>
        </div>
        {commitment.deadline && (
          <span className="text-[10px] text-[var(--gv-text-tertiary)] flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {commitment.deadline}
          </span>
        )}
      </div>

      <p className="mt-2 font-serif text-sm text-[var(--gv-text-primary)] leading-relaxed">
        &ldquo;{commitment.fact}&rdquo;
      </p>

      <div className="mt-3 flex items-center gap-2">
        {onAddReminder && (
          <button
            type="button"
            onClick={() => onAddReminder(commitment)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--gv-accent)] text-white text-[11px] font-medium hover:opacity-90 transition cursor-pointer"
          >
            <Bell className="w-3 h-3" />
            <span>Add reminder</span>
          </button>
        )}

        <a
          href={createGoogleCalendarUrl({
            title: commitment.fact,
            details: `Commitment from Gemini Vault reflection.\n\n"${commitment.fact}"`,
            startDate: commitment.deadline,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] text-[11px] font-medium transition cursor-pointer"
        >
          <Calendar className="w-3 h-3 text-[var(--gv-accent-gold)]" />
          <span>Add to Google Calendar</span>
        </a>

        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(commitment.id)}
            className="ml-auto text-[11px] text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-secondary)] transition cursor-pointer px-2 py-1"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

interface TurnItemProps {
  message: JournalMessage;
  isLatest: boolean;
  isHighlighted?: boolean;
  registerRef?: (node: HTMLDivElement | null) => void;
}

export const TurnItem: React.FC<TurnItemProps> = ({ message, isLatest, isHighlighted, registerRef }) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div
        id={message.id ? `turn-${message.id}` : undefined}
        data-turn-id={message.id}
        ref={registerRef}
        className={`w-full flex flex-col items-start my-6 animate-turn-enter transition-all duration-500 rounded-2xl ${
          isHighlighted
            ? 'gv-provenance-pulse p-3.5 sm:p-4 border border-[var(--gv-accent-border)] bg-[var(--gv-accent-muted)]/20'
            : ''
        }`}
      >
        <div className="w-full pl-4 sm:pl-5 border-l-2 border-[var(--gv-border-strong)] transition-colors">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--gv-text-tertiary)] font-sans uppercase tracking-wider mb-1.5">
            <User className="w-3 h-3 text-[var(--gv-text-tertiary)]" />
            <span className="font-medium">You</span>
            {message.modality === 'voice' && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-accent)] font-sans lowercase tracking-normal">
                spoken
              </span>
            )}
          </div>

          <div className="text-sm sm:text-[15px] font-sans text-[var(--gv-text-primary)] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={message.id ? `turn-${message.id}` : undefined}
      data-turn-id={message.id}
      ref={registerRef}
      className={`w-full flex flex-col items-start my-7 animate-turn-enter transition-all duration-500 rounded-2xl ${
        isHighlighted
          ? 'gv-provenance-pulse p-3.5 sm:p-4 border border-[var(--gv-accent-border)] bg-[var(--gv-accent-muted)]/20'
          : ''
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-sans text-[var(--gv-accent)] mb-2.5">
        <div className="w-5 h-5 rounded-full bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center text-[var(--gv-accent-gold)] shrink-0">
          <Sparkles className="w-3 h-3" />
        </div>
        <span className="font-serif font-medium tracking-wide text-xs text-[var(--gv-text-secondary)]">
          Gemini Vault
        </span>
        {message.modality === 'voice' && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-accent)] font-sans lowercase tracking-normal">
            spoken
          </span>
        )}
        {message.interrupted && (
          <span className="text-[10px] text-[var(--gv-text-muted)] italic font-sans lowercase tracking-normal">
            (interrupted)
          </span>
        )}
      </div>

      <div
        className={`w-full font-serif text-[15px] sm:text-[17px] leading-[1.8] ${
          isLatest ? 'text-[var(--gv-text-primary)]' : 'text-[var(--gv-text-secondary)]'
        }`}
      >
        <FormattedResponse content={message.content} />
      </div>
    </div>
  );
};

interface ReflectComposerProps {
  inputText: string;
  isSending: boolean;
  isCompleted: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onContinueSession?: () => void;
  onEnterVoiceMode?: () => void;
  locationContext?: LocationContext | null;
  onCaptureLocation?: () => void;
  onRemoveLocation?: () => void;
  isLocating?: boolean;
  locationError?: string | null;
  onDismissLocationError?: () => void;
}

export const ReflectComposer: React.FC<ReflectComposerProps> = ({
  inputText,
  isSending,
  isCompleted,
  textareaRef,
  onInputChange,
  onKeyDown,
  onSend,
  onContinueSession,
  onEnterVoiceMode,
  locationContext,
  onCaptureLocation,
  onRemoveLocation,
  isLocating,
  locationError,
  onDismissLocationError,
}) => {
  if (isCompleted) {
    return (
      <div className="p-4 rounded-2xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-center space-y-3 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--gv-success)]">
            <CheckCircle2 className="w-4 h-4" />
            <span>This reflection is concluded and archived.</span>
          </div>
          <p className="text-[11px] text-[var(--gv-text-tertiary)] font-sans">
            All messages remain securely preserved in your personal vault.
          </p>
        </div>

        {onContinueSession && (
          <div className="pt-1">
            <button
              type="button"
              id="continue-reflection-btn"
              onClick={onContinueSession}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gv-accent)] hover:opacity-90 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Continue Reflection</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Active Location Chip (One-click removal) */}
      {locationContext && (
        <div className="flex items-center gap-2 px-3 py-1.5 min-h-[36px] rounded-xl bg-[var(--gv-accent-muted)]/40 border border-[var(--gv-accent-border)] text-xs text-[var(--gv-text-primary)] max-w-fit animate-in fade-in duration-150">
          <MapPin className="w-3.5 h-3.5 text-[var(--gv-accent)] shrink-0" />
          <span className="font-medium">Location added · {locationContext.label}</span>
          {onRemoveLocation && (
            <button
              type="button"
              onClick={onRemoveLocation}
              className="p-1 hover:text-rose-400 hover:bg-[var(--gv-surface-raised)] rounded-md transition cursor-pointer ml-1 text-[var(--gv-text-tertiary)]"
              aria-label="Remove location"
              title="Remove location context"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Calm non-blocking failure notice */}
      {locationError && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[var(--gv-surface-ground)] border border-[var(--gv-border-subtle)] text-[11px] text-[var(--gv-text-tertiary)] animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-[var(--gv-accent-gold)] shrink-0" />
            <span>{locationError}</span>
          </div>
          {onDismissLocationError && (
            <button
              type="button"
              onClick={onDismissLocationError}
              className="p-1 hover:text-[var(--gv-text-primary)] text-xs cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="relative rounded-2xl bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] focus-within:border-[var(--gv-accent)] focus-within:ring-2 focus-within:ring-[var(--gv-focus-ring)] transition shadow-sm">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Continue your reflection... (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isSending}
          className="w-full p-3.5 sm:p-4 pr-20 bg-transparent text-[var(--gv-text-primary)] placeholder-[var(--gv-text-muted)] text-sm focus:outline-none resize-none font-sans leading-relaxed max-h-[220px]"
          aria-label="Reflection composer input"
        />

        {onEnterVoiceMode && (
          <button
            type="button"
            onClick={onEnterVoiceMode}
            id="composer-voice-doorway-btn"
            disabled={isSending}
            className="absolute right-11 bottom-2.5 p-2 rounded-xl text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] transition cursor-pointer"
            title="Enter Voice Reflection Studio"
            aria-label="Enter Voice Reflection Studio"
          >
            <VaultPresence size="micro" state="idle" />
          </button>
        )}

        <button
          type="button"
          onClick={onSend}
          disabled={!inputText.trim() || isSending}
          id="send-message-btn"
          className="absolute right-2.5 bottom-2.5 p-2 rounded-xl bg-[var(--gv-accent)] text-white hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          aria-label="Send message"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-[11px] text-[var(--gv-text-tertiary)] font-sans select-none">
        <div className="flex items-center gap-3">
          <span>
            Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] font-mono text-[10px]">Return</kbd> to send
          </span>
          {!locationContext && onCaptureLocation && (
            <button
              type="button"
              onClick={onCaptureLocation}
              disabled={isLocating || isSending}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] transition cursor-pointer disabled:opacity-50"
              title="Add single-shot location context to reflection"
            >
              <MapPin className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
              <span>{isLocating ? 'Locating…' : '+ Add location'}</span>
            </button>
          )}
        </div>
        <span className="hidden sm:inline">Encrypted in personal vault isolation</span>
      </div>
    </div>
  );
};

interface JournalSessionViewProps {
  sessionId: string;
  onBack: () => void;
  onContinueSession?: (sessionId: string) => Promise<void>;
  initialPrompt?: string;
  onContextItemsChange?: (items: ContextRailItem[]) => void;
  initialMode?: 'text' | 'voice';
}

export const JournalSessionView: React.FC<JournalSessionViewProps> = ({
  sessionId,
  onBack,
  onContinueSession,
  initialPrompt,
  onContextItemsChange,
  initialMode = 'text',
}) => {
  const { getIdToken, userProfile } = useAuth();

  const [studioMode, setStudioMode] = useState<'text' | 'voice'>(initialMode);
  const [locationContext, setLocationContext] = useState<LocationContext | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location access not available — continuing without location.');
      return;
    }

    const preferredMode = userProfile?.preferences?.defaultLocationMode || 'coarse';
    const isPrecise = preferredMode === 'precise';

    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = isPrecise
          ? Math.round(pos.coords.latitude * 10000) / 10000
          : Math.round(pos.coords.latitude * 10) / 10;
        const lng = isPrecise
          ? Math.round(pos.coords.longitude * 10000) / 10000
          : Math.round(pos.coords.longitude * 10) / 10;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');
        const label = isPrecise
          ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          : `${tz} (~${lat.toFixed(1)}, ${lng.toFixed(1)})`;

        setLocationContext({
          mode: isPrecise ? 'precise' : 'coarse',
          label,
          latitude: lat,
          longitude: lng,
          capturedAt: new Date().toISOString(),
        });
      },
      (err) => {
        setIsLocating(false);
        console.warn('[LocationContext] Geolocation request denied or unavailable:', err);
        setLocationError('Location access not available — continuing without location.');
      },
      {
        enableHighAccuracy: isPrecise,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    setStudioMode(initialMode);
  }, [initialMode, sessionId]);

  const [session, setSession] = useState<SessionWithContinuation | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<{
    title?: string;
    message: string;
    lastFailedText?: string;
    clientMsgId?: string;
    canReload?: boolean;
  } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [isReviewingMemories, setIsReviewingMemories] = useState(false);
  const [reflectionMode, setReflectionMode] = useState<ReflectionMode>('reflect');
  const [summaryResult, setSummaryResult] = useState<{
    summary: string;
    takeaways: string[];
    nonClinicalMoodObservation?: string;
  } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const [sessionActions, setSessionActions] = useState<ActionSuggestion[]>([]);
  const [isExtractingActions, setIsExtractingActions] = useState(false);
  const [extractActionsError, setExtractActionsError] = useState<string | null>(null);

  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('turn');
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const assistantMessageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [scrollTargetAssistantId, setScrollTargetAssistantId] = useState<string | null>(null);
  const [scrollTargetUserId, setScrollTargetUserId] = useState<string | null>(null);
  const focusAfterResponseRef = useRef(false);
  const initialPromptSentRef = useRef(false);
  const loadedSessionRef = useRef<string | null>(null);

  // Deep-linking: scroll to turn if ?turn=<turnId> is present
  useEffect(() => {
    if (!highlightedTurnId || messages.length === 0) return;

    const timer = setTimeout(() => {
      const el =
        document.getElementById(`turn-${highlightedTurnId}`) ||
        assistantMessageRefs.current.get(highlightedTurnId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);

    const clearTimer = setTimeout(() => {
      setHighlightedTurnId(null);
    }, 4500);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [highlightedTurnId, messages]);

  // Auto-scroll to latest message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Adjust textarea height dynamically
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  };

  // Clicking the quiet canvas should behave like ChatGPT-style composer focus:
  // typing can begin without requiring a click on the textarea itself.
  // Chat-style "type anywhere" behavior.
  // Use a document-level listener so it still works when the user clicks the
  // canvas/body and the textarea is no longer the active element.
  useEffect(() => {
    const handleGlobalTyping = (event: KeyboardEvent) => {
      if (
        loadingSession ||
        isSending ||
        isReviewingMemories ||
        session?.status === 'completed' ||
        !textareaRef.current ||
        event.isComposing
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1) return;

      const target = event.target as HTMLElement | null;
      const isFormControl =
        target && target instanceof Element
          ? target.closest('input, textarea, select, button, a, [contenteditable="true"]')
          : false;

      // Never hijack typing that is intentionally happening in another control.
      if (isFormControl) return;

      event.preventDefault();

      setInputText((previous) => previous + event.key);

      requestAnimationFrame(() => {
        textareaRef.current?.focus({ preventScroll: true });
      });
    };

    document.addEventListener('keydown', handleGlobalTyping);
    return () => document.removeEventListener('keydown', handleGlobalTyping);
  }, [loadingSession, isSending, isReviewingMemories, session?.status]);

  const handleSessionCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      loadingSession ||
      isSending ||
      isReviewingMemories ||
      session?.status === 'completed' ||
      !textareaRef.current
    ) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    // Do not steal focus while the user is selecting/copying conversation text.
    const selectedText = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (selectedText) {
      return;
    }

    textareaRef.current.focus({ preventScroll: true });
  };

  // Load session metadata and messages
  const loadSession = async () => {
  if (loadedSessionRef.current === sessionId) {
    return;
  }

  loadedSessionRef.current = sessionId;

  setLoadingSession(true);
  setSendError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/journal/session/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load reflection session');
      }

      const data = await res.json();
      setSession(data.session);
      setEditTitleValue(data.session?.title || '');
      setMessages(data.messages || []);

      // If initialPrompt was provided and no messages exist yet, send the initial prompt
      if (
  initialPrompt &&
  (!data.messages || data.messages.length === 0) &&
  !initialPromptSentRef.current
) {
  initialPromptSentRef.current = true;

  setTimeout(() => {
    sendMessage(initialPrompt);
  }, 100);
}
    } catch (err: unknown) {
      loadedSessionRef.current = null;
      console.error('[JournalSessionView] Error loading session:', err);
      setSendError({
        title: 'Connection Paused',
        message: 'Your saved reflections remain secure in your private vault. Attempting to reconnect…',
        canReload: true,
      });
    } finally {
      setLoadingSession(false);
      setTimeout(() => scrollToBottom('auto'), 150);
    }
  };

  useEffect(() => {
    initialPromptSentRef.current = false;
    loadedSessionRef.current = null;
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText]);

  // Initial load: place the user at the latest content once.
  useEffect(() => {
    if (!loadingSession && messages.length > 0) {
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [loadingSession, sessionId]);

  // Feed session metadata and contextual next turns to the contextual rail
  useEffect(() => {
    if (!onContextItemsChange) return;

    if (!session && messages.length === 0) {
      onContextItemsChange([]);
      return;
    }

    const items: ContextRailItem[] = [];

    // 1. Session Stream Context
    const isContinued = Boolean(session?.continuedFromSessionId);
    items.push({
      id: `ctx-session-${sessionId}`,
      kind: 'evidence',
      title: session?.title || 'Active Reflection',
      body: isContinued
        ? 'Continued from an earlier reflection thread. Vault continuity and provenance linked.'
        : `${messages.length} message${messages.length === 1 ? '' : 's'} recorded. Vault memory isolation active.`,
      timestamp: session?.clientStartedAt
        ? new Date(session.clientStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : typeof session?.createdAt === 'string'
        ? new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined,
    });

    // 2. Next suggested direction or state hint based on real conversation depth
    if (session?.status === 'completed') {
      items.push({
        id: `ctx-status-${sessionId}`,
        kind: 'memory',
        title: 'Reflection Archived',
        body: 'This reflection is preserved in your vault. You can review saved memories or start a continuation thread.',
        actionLabel: 'Review Vault Memories',
        onAction: () => setIsReviewingMemories(true),
      });
    } else if (messages.length >= 2) {
      items.push({
        id: `ctx-direction-${sessionId}`,
        kind: 'prompt',
        title: 'Deepen Perspective',
        body: 'What is the most significant insight or question that has emerged for you in this reflection so far?',
        actionLabel: 'Explore this insight',
        onAction: () => {
          setInputText('Looking at what we just discussed, the key insight that feels most important is: ');
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        },
      });
    }

    onContextItemsChange(items);

    return () => {
      onContextItemsChange([]);
    };
  }, [session, messages.length, sessionId, onContextItemsChange]);

  // When a follow-up message is sent, immediately bring the start of that
  // user turn into view while Gemini is generating the response.
  // This mirrors the conversational viewport behavior users expect from ChatGPT.
  useLayoutEffect(() => {
    const userId = scrollTargetUserId;
    if (!userId) return;

    setScrollTargetUserId(null);

    requestAnimationFrame(() => {
      const target = assistantMessageRefs.current.get(userId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [scrollTargetUserId]);

  // After Gemini actually returns, bring that exact assistant response into view
  // and return the cursor to the composer on desktop.
  useLayoutEffect(() => {
    const assistantId = scrollTargetAssistantId;
    if (!assistantId) return;

    setScrollTargetAssistantId(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = assistantMessageRefs.current.get(assistantId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          scrollToBottom('smooth');
        }

        if (focusAfterResponseRef.current) {
          focusAfterResponseRef.current = false;
          if (typeof window !== 'undefined' && window.innerWidth >= 768 && !isReviewingMemories && session?.status !== 'completed') {
            requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
          }
        }
      });
    });
  }, [scrollTargetAssistantId, isReviewingMemories, session?.status]);

  // Send message to backend Gemini endpoint
  const sendMessage = async (contentToSend?: string, existingClientMsgId?: string) => {
    const text = (contentToSend ?? inputText).trim();
    if (!text || isSending) return;

    const token = await getIdToken();
    if (!token) {
      setSendError({
        title: 'Authentication Required',
        message: 'Please sign in again to continue your reflection.',
      });
      return;
    }

    const clientMsgId = existingClientMsgId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // If it's a new message (not a retry), add user message optimistically to UI
    const optimisticUserMsg: JournalMessage = {
      id: clientMsgId,
      role: 'user',
      content: text,
      clientTimestamp: new Date().toISOString(),
    };

    if (!existingClientMsgId) {
      // For follow-up turns, scroll to the beginning of the new user message
      // immediately, before Gemini starts generating.
      if (messages.length > 0) {
        setScrollTargetUserId(clientMsgId);
      }

      setMessages((prev) => [...prev, optimisticUserMsg]);
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch('/api/journal/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          message: text,
          clientMessageId: clientMsgId,
          conversationTone: userProfile?.preferences?.conversationTone,
          reflectionDepth: userProfile?.preferences?.reflectionDepth,
          reflectionMode,
          locationContext: locationContext || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Gemini companion was unable to respond.');
      }

      // Append assistant message or update message list
      if (data.assistantMessage) {
        setScrollTargetAssistantId(data.assistantMessage.id);
        focusAfterResponseRef.current = true;

        // Opportunistically detect action suggestions in response content
        if (data.assistantMessage.content) {
          const detected = detectActionSuggestions(data.assistantMessage.content);
          if (detected.length > 0) {
            setSessionActions((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const newOnes = detected.filter((a) => !existingIds.has(a.id));
              return [...prev, ...newOnes];
            });
          }
        }

        setMessages((prev) => {
          const updated = [...prev];

          // Replace the optimistic user message with the
          // canonical server message instead of appending another one.
          const optimisticIndex = updated.findIndex((m) => m.id === clientMsgId);

          if (optimisticIndex !== -1 && data.userMessage) {
            updated[optimisticIndex] = data.userMessage;
          } else if (data.userMessage) {
            updated.push(data.userMessage);
          }

          // Prevent duplicate assistant messages.
          const assistantExists = updated.some(
            (m) => m.id === data.assistantMessage.id
          );

          if (!assistantExists) {
            updated.push(data.assistantMessage);
          }

          return updated;
        });
      }
    } catch (err: unknown) {
      console.error('[JournalSessionView] Send error:', err);
      const errMsg = err instanceof Error ? err.message : 'Unable to connect to Gemini companion.';
      setSendError({
        title: 'Reflection Paused',
        message: errMsg,
        lastFailedText: text,
        clientMsgId,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSummarizeSession = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setSummarizeError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');
      const res = await fetch(`/api/journal/session/${sessionId}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to summarize reflection.');
      setSummaryResult({
        summary: data.summary,
        takeaways: data.takeaways || [],
        nonClinicalMoodObservation: data.nonClinicalMoodObservation,
      });
    } catch (err: unknown) {
      console.error('[JournalSessionView] Summarize error:', err);
      setSummarizeError(err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleExtractActions = async () => {
    if (isExtractingActions) return;
    setIsExtractingActions(true);
    setExtractActionsError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');
      const res = await fetch(`/api/journal/session/${sessionId}/extract-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to extract actions.');
      if (Array.isArray(data.actions)) {
        setSessionActions((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const newActions = data.actions.filter((a: ActionSuggestion) => !existingIds.has(a.id));
          return [...prev, ...newActions];
        });
      }
    } catch (err: unknown) {
      console.error('[JournalSessionView] Extract actions error:', err);
      setExtractActionsError(err instanceof Error ? err.message : 'Failed to extract actions.');
    } finally {
      setIsExtractingActions(false);
    }
  };

  // Handle Enter key for sending
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Save edited session title
  const handleSaveTitle = async () => {
    const trimmed = editTitleValue.trim();
    if (!trimmed || trimmed === session?.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/journal/session/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: trimmed }),
      });

      if (res.ok) {
        setSession((prev) => (prev ? { ...prev, title: trimmed } : null));
        setIsEditingTitle(false);
      }
    } catch (err) {
      console.error('[JournalSessionView] Error saving title:', err);
    }
  };

  // Conclude the current reflection
  const handleConcludeSession = async () => {
  setIsConcluding(true);

  try {
    const token = await getIdToken();
    if (!token) return;

    const res = await fetch(`/api/journal/session/${sessionId}/conclude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to conclude reflection.');
    }

    setSession((prev) =>
      prev ? { ...prev, status: 'completed' } : null
    );

    setShowConcludeModal(false);
    if (userProfile?.preferences?.memorySuggestions === false) {
      setIsReviewingMemories(false);
    } else {
      setIsReviewingMemories(true);
    }
  } catch (err) {
    console.error('[JournalSessionView] Error concluding session:', err);
  } finally {
    setIsConcluding(false);
  }
};

  if (loadingSession) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4 font-sans">
        <div className="w-8 h-8 border-2 border-[var(--gv-accent)] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-[var(--gv-text-tertiary)] font-serif">Opening reflection session...</p>
      </div>
    );
  }

  const isCompleted = session?.status === 'completed';

  if (studioMode === 'voice' && !isCompleted) {
    return (
      <div className="flex flex-col h-full bg-[var(--gv-surface-base)] relative select-auto overflow-hidden">
        <VoiceStudioView
          sessionId={sessionId}
          sessionTitle={session?.title || 'Reflection Session'}
          messages={messages}
          getIdToken={getIdToken}
          onReturnToText={() => setStudioMode('text')}
          onTurnPersisted={(turn) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === turn.id)) return prev;
              return [...prev, turn];
            });
          }}
          onInterrupted={(turnId, finalContent) => {
            if (turnId && finalContent) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === turnId)) return prev;
                return [
                  ...prev,
                  {
                    id: turnId,
                    role: 'assistant',
                    content: finalContent,
                    modality: 'voice',
                    interrupted: true,
                  },
                ];
              });
            }
          }}
          onConcludeSession={() => {
            setStudioMode('text');
            setShowConcludeModal(true);
          }}
          onSessionTitled={(newTitle) => {
            setSession((prev) => (prev ? { ...prev, title: newTitle } : null));
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--gv-surface-base)] relative select-auto overflow-hidden">
      {/* 1. Restrained Session Header */}
      <ReflectHeader
        session={session}
        isCompleted={isCompleted}
        isEditingTitle={isEditingTitle}
        editTitleValue={editTitleValue}
        reflectionMode={reflectionMode}
        onReflectionModeChange={setReflectionMode}
        onBack={onBack}
        onStartEditTitle={() => setIsEditingTitle(true)}
        onSaveTitle={handleSaveTitle}
        onCancelEditTitle={() => setIsEditingTitle(false)}
        onTitleChange={setEditTitleValue}
        onOpenConcludeModal={() => setShowConcludeModal(true)}
        onEnterVoiceMode={() => setStudioMode('voice')}
        onSummarize={messages.length > 0 ? handleSummarizeSession : undefined}
        isSummarizing={isSummarizing}
        onExtractActions={messages.length > 0 ? handleExtractActions : undefined}
        isExtractingActions={isExtractingActions}
      />

      {/* 2. Main Studio Canvas — Dynamic Editorial Reading Measure */}
      <div
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 cursor-text"
        onClick={handleSessionCanvasClick}
        aria-label="Reflection conversation canvas"
      >
        <div className="gv-reading-measure">
          {/* Summary Result Banner */}
          {summaryResult && (
            <div className="mb-6 p-5 rounded-2xl bg-[var(--gv-surface-raised)] border border-[var(--gv-accent-border)] shadow-xs animate-turn-enter">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--gv-accent)]">
                  <Sparkles className="w-4 h-4 text-[var(--gv-accent-gold)]" />
                  <span className="font-serif text-sm font-medium">Reflection Synthesis</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSummaryResult(null)}
                  className="p-1 text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer"
                  aria-label="Dismiss summary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 font-serif text-sm text-[var(--gv-text-primary)] leading-relaxed">
                {summaryResult.summary}
              </p>
              {summaryResult.takeaways.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--gv-border-subtle)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-text-tertiary)]">
                    Key Takeaways
                  </span>
                  <ul className="mt-1.5 space-y-1 text-xs text-[var(--gv-text-secondary)]">
                    {summaryResult.takeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[var(--gv-accent)] mt-0.5">•</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {summaryResult.nonClinicalMoodObservation && (
                <p className="mt-3 text-[11px] italic text-[var(--gv-text-tertiary)]">
                  Reflective Observation: {summaryResult.nonClinicalMoodObservation}
                </p>
              )}
            </div>
          )}

          {summarizeError && (
            <div className="mb-4 p-3 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-secondary)] flex items-center justify-between">
              <span>{summarizeError}</span>
              <button
                type="button"
                onClick={() => setSummarizeError(null)}
                className="text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Action Suggestions & Calendar Handoffs */}
          {sessionActions.length > 0 && (
            <div className="my-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-[var(--gv-text-secondary)] px-1">
                <span className="flex items-center gap-1.5 text-[var(--gv-accent)]">
                  <Calendar className="w-3.5 h-3.5 text-[var(--gv-accent-gold)]" />
                  Proposed Next Actions ({sessionActions.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSessionActions([])}
                  className="text-[11px] text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] transition cursor-pointer"
                >
                  Dismiss all
                </button>
              </div>
              <div className="space-y-2">
                {sessionActions.map((action) => (
                  <ActionConfirmationCard
                    key={action.id}
                    action={action}
                    onConfirmCommitment={() => {}}
                    onDismiss={(id) => {
                      setSessionActions((prev) => prev.filter((a) => a.id !== id));
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {extractActionsError && (
            <div className="mb-4 p-3 rounded-xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-xs text-[var(--gv-text-secondary)] flex items-center justify-between">
              <span>{extractActionsError}</span>
              <button
                type="button"
                onClick={() => setExtractActionsError(null)}
                className="text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] ml-2"
              >
                Dismiss
              </button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="py-20 sm:py-24 text-center space-y-3 animate-turn-enter">
              <div className="w-10 h-10 rounded-2xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center text-[var(--gv-accent-gold)] mx-auto mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-serif font-normal text-[var(--gv-text-primary)]">
                The canvas is yours.
              </h2>
              <p className="text-xs sm:text-sm text-[var(--gv-text-secondary)] max-w-sm mx-auto leading-relaxed">
                Express whatever thoughts are present. Gemini will listen attentively and provide reflective follow-up questions.
              </p>
              <p className="text-[11px] text-[var(--gv-text-tertiary)] pt-2">
                Click anywhere in this space to start typing.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isLatest = index === messages.length - 1;
              return (
                <TurnItem
                  key={msg.id || index}
                  message={msg}
                  isLatest={isLatest}
                  isHighlighted={Boolean(msg.id && msg.id === highlightedTurnId)}
                  registerRef={(node) => {
                    const id = msg.id;
                    if (!id) return;
                    if (node) assistantMessageRefs.current.set(id, node);
                    else assistantMessageRefs.current.delete(id);
                  }}
                />
              );
            })
          )}

          {/* Active Generation Loading Indicator */}
          {isSending && (
            <div className="my-6 flex flex-col items-start space-y-2 animate-turn-enter">
              <div className="flex items-center gap-1.5 text-xs text-[var(--gv-accent)] font-sans">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-[var(--gv-accent-gold)]" />
                <span className="font-serif">Reflecting with Gemini...</span>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] flex items-center gap-2 text-[var(--gv-text-tertiary)] text-xs">
                <div className="w-2 h-2 rounded-full bg-[var(--gv-accent)] animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-[var(--gv-accent)] animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 rounded-full bg-[var(--gv-accent)] animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}

          {/* Composed Error / Retry Banner */}
          {sendError && (
            <div
              data-testid="reflection-error-banner"
              className="my-6 p-4 rounded-2xl bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] text-[var(--gv-text-secondary)] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-turn-enter shadow-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[var(--gv-accent-gold)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium block text-[var(--gv-text-primary)]">
                    {sendError.title || 'Reflection Paused'}
                  </span>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--gv-text-secondary)]">
                    {sendError.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {sendError.canReload && (
                  <button
                    type="button"
                    onClick={() => {
                      setLoadingSession(true);
                      setSendError(null);
                      loadSession();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reconnect</span>
                  </button>
                )}

                {sendError.lastFailedText && (
                  <button
                    type="button"
                    onClick={() => sendMessage(sendError.lastFailedText, sendError.clientMsgId)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Reflection</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-6" />
        </div>
      </div>

      {/* 3. Floating Persistent Composer (Anchored at Bottom with Subtle Gradient Mask) */}
      <footer className="relative shrink-0 z-20 px-4 sm:px-8 pb-4 sm:pb-6 pt-2 bg-gradient-to-t from-[var(--gv-surface-base)] via-[var(--gv-surface-base)]/95 to-transparent">
        <div className="gv-reading-measure">
          <ReflectComposer
            inputText={inputText}
            isSending={isSending}
            isCompleted={isCompleted}
            textareaRef={textareaRef}
            onInputChange={setInputText}
            onKeyDown={handleKeyDown}
            onSend={() => sendMessage()}
            onContinueSession={onContinueSession ? () => onContinueSession(sessionId) : undefined}
            onEnterVoiceMode={() => setStudioMode('voice')}
            locationContext={locationContext}
            onCaptureLocation={handleCaptureLocation}
            onRemoveLocation={() => setLocationContext(null)}
            isLocating={isLocating}
            locationError={locationError}
            onDismissLocationError={() => setLocationError(null)}
          />
        </div>
      </footer>

      {/* Immediate Post-Conclusion Vault Memory Review Modal */}
      {isReviewingMemories && session?.status === 'completed' && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Vault Memory review"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--gv-border-strong)] bg-[var(--gv-surface-base)] shadow-2xl">
            <MemoryReviewSection
              sessionId={sessionId}
              sessionTitle={session?.title || 'Reflection'}
              getIdToken={getIdToken}
              onDone={onBack}
            />
          </div>
        </div>
      )}

      {/* Conclude Session Confirmation Modal */}
      {showConcludeModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="w-10 h-10 rounded-2xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center text-[var(--gv-accent-gold)]">
              <CheckCircle2 className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-base font-serif font-medium text-[var(--gv-text-primary)]">
                Conclude this reflection?
              </h2>
              <p className="text-xs text-[var(--gv-text-secondary)] mt-1.5 leading-relaxed font-sans">
                Concluding marks the session as finished and preserves this conversation in your personal vault. You can review and continue it at any time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConcludeModal(false)}
                disabled={isConcluding}
                className="px-4 py-2 rounded-xl bg-[var(--gv-surface-raised)] hover:bg-[var(--gv-border-default)] text-[var(--gv-text-secondary)] text-xs font-medium transition cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleConcludeSession}
                disabled={isConcluding}
                id="confirm-conclude-btn"
                className="px-4 py-2 rounded-xl bg-[var(--gv-accent)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isConcluding ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Concluding...</span>
                  </>
                ) : (
                  <span>Conclude Reflection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
