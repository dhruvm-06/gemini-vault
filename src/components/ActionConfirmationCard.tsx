import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Mail,
  CheckCircle2,
  X,
  Sparkles,
  ExternalLink,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { ActionSuggestion } from '../types';
import {
  createGoogleCalendarUrl,
  createGoogleMapsUrl,
  createGmailComposeUrl,
} from '../utils/actionHandoffs';

interface ActionConfirmationCardProps {
  action: ActionSuggestion;
  onConfirmCommitment?: (action: ActionSuggestion) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({
  action,
  onConfirmCommitment,
  onDismiss,
  className = '',
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [emailNotice, setEmailNotice] = useState(false);

  const handleOpenCalendar = () => {
    const url = createGoogleCalendarUrl({
      title: action.title,
      details: action.description || (action.sourceEvidence ? `Source reflection: "${action.sourceEvidence}"` : undefined),
      location: action.location,
      startDate: action.dateTime,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenMaps = () => {
    const query = action.location || action.title;
    const url = createGoogleMapsUrl(query);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDraftEmail = () => {
    setEmailNotice(true);
    const url = createGmailComposeUrl({
      to: action.recipient,
      subject: `Reflection Note: ${action.title}`,
      body: action.description || (action.sourceEvidence ? `Context from reflection:\n\n"${action.sourceEvidence}"` : ''),
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleConfirmCommitment = () => {
    setConfirmed(true);
    if (onConfirmCommitment) {
      onConfirmCommitment(action);
    }
  };

  return (
    <div
      className={`my-3 p-4 rounded-2xl border border-[var(--gv-accent-border)] bg-[var(--gv-surface-raised)]/90 backdrop-blur-xs shadow-xs text-xs font-sans transition-all animate-turn-enter ${className}`}
      data-action-id={action.id}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gv-accent)]">
          <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
          <span>
            {action.type === 'calendar_event' || action.type === 'location'
              ? 'Detected Plan'
              : action.type === 'email_draft'
              ? 'Suggested Outreach'
              : 'Suggested Action'}
          </span>
          {action.confidence && (
            <span className="text-[10px] text-[var(--gv-text-tertiary)] font-normal">
              · {Math.round(action.confidence * 100)}% confidence
            </span>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(action.id)}
            className="p-1 rounded-lg text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-ground)] transition cursor-pointer"
            aria-label="Dismiss suggestion"
            title="Dismiss suggestion"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2">
        <h4 className="font-serif text-sm sm:text-[15px] font-medium text-[var(--gv-text-primary)] leading-snug">
          {action.title}
        </h4>
        {action.description && (
          <p className="mt-1 text-xs text-[var(--gv-text-secondary)] leading-relaxed">
            {action.description}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--gv-text-tertiary)]">
        {action.dateTime && (
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-[var(--gv-accent)]" />
            {new Date(action.dateTime).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        )}

        {action.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[var(--gv-accent)]" />
            {action.location}
          </span>
        )}

        {action.recipient && (
          <span className="inline-flex items-center gap-1">
            <Mail className="w-3 h-3 text-[var(--gv-accent)]" />
            {action.recipient}
          </span>
        )}
      </div>

      {action.sourceEvidence && (
        <div className="mt-2.5 p-2 rounded-xl bg-[var(--gv-surface-ground)]/60 border border-[var(--gv-border-subtle)] text-[11px] italic text-[var(--gv-text-secondary)] leading-relaxed line-clamp-2">
          &ldquo;{action.sourceEvidence}&rdquo;
        </div>
      )}

      {emailNotice && (
        <div className="mt-2 text-[11px] text-[var(--gv-accent-text)] bg-[var(--gv-accent-muted)] p-2 rounded-xl border border-[var(--gv-accent-border)] animate-in fade-in duration-150">
          Opens Gmail — review before sending.
        </div>
      )}

      <div className="mt-3.5 pt-2.5 border-t border-[var(--gv-border-subtle)] flex flex-wrap items-center gap-2">
        {/* External Calendar Template Handoff */}
        {(action.type === 'calendar_event' || action.dateTime || action.type === 'commitment') && (
          <button
            type="button"
            onClick={handleOpenCalendar}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-[var(--gv-border-accent)] text-[var(--gv-text-primary)] hover:text-[var(--gv-accent)] text-xs font-medium transition cursor-pointer shadow-2xs active:scale-98"
            title="Open prefilled Google Calendar event in new tab"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
            <span>Add to Google Calendar</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </button>
        )}

        {/* External Maps Search Handoff */}
        {(action.type === 'location' || action.location) && (
          <button
            type="button"
            onClick={handleOpenMaps}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-[var(--gv-border-accent)] text-[var(--gv-text-primary)] hover:text-[var(--gv-accent)] text-xs font-medium transition cursor-pointer shadow-2xs active:scale-98"
            title="Open place search in Google Maps"
          >
            <MapPin className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
            <span>Open in Google Maps</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </button>
        )}

        {/* External Gmail Compose Handoff */}
        {action.type === 'email_draft' && (
          <button
            type="button"
            onClick={handleDraftEmail}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-surface-base)] border border-[var(--gv-border-default)] hover:border-[var(--gv-border-accent)] text-[var(--gv-text-primary)] hover:text-[var(--gv-accent)] text-xs font-medium transition cursor-pointer shadow-2xs active:scale-98"
            title="Draft email in Gmail (opens compose window)"
          >
            <Mail className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
            <span>Draft in Gmail</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </button>
        )}

        {/* Mark as Commitment in Personal Vault */}
        {onConfirmCommitment && (
          <button
            type="button"
            onClick={handleConfirmCommitment}
            disabled={confirmed}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--gv-accent)] text-white text-xs font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-60 disabled:cursor-default shadow-xs active:scale-98"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{confirmed ? 'Marked in Vault' : 'Mark as Commitment'}</span>
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(action.id)}
            className="ml-auto text-xs text-[var(--gv-text-tertiary)] hover:text-[var(--gv-text-secondary)] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
