import React from 'react';
import {
  X,
  Sparkles,
  Bookmark,
  Target,
  ArrowRight,
  Clock,
  Compass,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { AppView, ContextRailItem } from '../types';

interface ContextRailProps {
  currentView: AppView;
  activeSessionId: string | null;
  items?: ContextRailItem[];
  isOpen: boolean;
  onToggle: () => void;
  onOpenSession?: (sessionId: string) => void;
}

export const ContextRail: React.FC<ContextRailProps> = ({
  currentView,
  activeSessionId,
  items = [],
  isOpen,
  onToggle,
  onOpenSession,
}) => {
  // If there are no items and it's not explicitly in a mode that has active contextual feedback,
  // collapse gracefully rather than showing a wall of empty cards.
  const hasItems = items && items.length > 0;

  // View-specific section titles and descriptions
  const getContextMeta = () => {
    switch (currentView) {
      case 'home':
        return {
          title: activeSessionId ? 'Reflection Context' : 'Suggested Directions',
          subtitle: activeSessionId
            ? 'Relevant memories & active loops'
            : 'Ideas to begin your reflection',
          emptyHint: 'No contextual memories active yet.',
        };
      case 'voice':
        return {
          title: 'Live Context',
          subtitle: 'Real-time takeaways & cues',
          emptyHint: 'Start speaking to surface context.',
        };
      case 'vault':
        return {
          title: 'Vault Overview',
          subtitle: 'Active memory distribution',
          emptyHint: 'Select a memory to view details.',
        };
      case 'intelligence':
        return {
          title: 'Evidence & Sources',
          subtitle: 'Grounded reflections & synthesis',
          emptyHint: 'Ask your Vault to view citations.',
        };
      case 'documents':
        return {
          title: 'Document Sources',
          subtitle: 'Citations and excerpts',
          emptyHint: 'Select a document to inspect citations.',
        };
      case 'calendar':
        return {
          title: 'Commitment Context',
          subtitle: 'Source reflections & deadlines',
          emptyHint: 'No upcoming commitment deadlines.',
        };
      default:
        return {
          title: 'Context',
          subtitle: 'Supporting intelligence',
          emptyHint: 'No active context.',
        };
    }
  };

  const meta = getContextMeta();

  // If collapsed or no useful items exist and not open on mobile/desktop, keep minimized
  if (!isOpen) {
    return null;
  }

  const getItemIcon = (kind: ContextRailItem['kind']) => {
    switch (kind) {
      case 'memory':
        return Bookmark;
      case 'loop':
      case 'commitment':
        return Target;
      case 'prompt':
        return Compass;
      case 'citation':
        return FileText;
      case 'evidence':
        return Sparkles;
      default:
        return Layers;
    }
  };

  return (
    <>
      {/* Mobile / Tablet Backdrop Overlay */}
      <div
        className="fixed inset-0 z-30 bg-stone-950/40 backdrop-blur-xs xl:hidden transition-opacity"
        onClick={onToggle}
        aria-hidden="true"
      />

      {/* Main ContextRail Panel */}
      <aside
        className="fixed xl:static top-0 right-0 bottom-0 z-35 w-[min(320px,calc(100vw-2rem))] xl:w-[320px] shrink-0 border-l border-[var(--gv-border-default)] bg-[var(--gv-surface-rail)] flex flex-col h-full overflow-hidden transition-transform xl:transition-none duration-200 shadow-xl xl:shadow-none"
        aria-label="Contextual Intelligence Rail"
      >
        {/* Header */}
        <div className="h-13 px-4.5 border-b border-[var(--gv-border-subtle)] flex items-center justify-between shrink-0 bg-[var(--gv-surface-rail)]/90 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-[var(--gv-accent)] shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--gv-text-primary)] truncate">
                {meta.title}
              </span>
              <span className="text-[11px] text-[var(--gv-text-tertiary)] truncate">
                {meta.subtitle}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-lg text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] transition cursor-pointer"
            aria-label="Close context rail"
            title="Close context rail"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
          {hasItems ? (
            items.map((item) => {
              const Icon = getItemIcon(item.kind);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-base)] p-3.5 shadow-xs transition hover:border-[var(--gv-border-strong)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gv-accent)]">
                      <Icon className="w-3 h-3" />
                      <span className="capitalize">{item.kind}</span>
                    </div>
                    {item.timestamp && (
                      <span className="text-[10px] text-[var(--gv-text-tertiary)] flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {item.timestamp}
                      </span>
                    )}
                  </div>

                  <h4 className="mt-1.5 font-serif text-xs sm:text-sm font-medium text-[var(--gv-text-primary)] leading-snug">
                    {item.title}
                  </h4>

                  {item.body && (
                    <p className="mt-1 text-xs text-[var(--gv-text-secondary)] leading-relaxed line-clamp-3">
                      {item.body}
                    </p>
                  )}

                  {item.actionLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        if (item.onAction) item.onAction();
                        else if (item.sourceSessionId && onOpenSession) {
                          onOpenSession(item.sourceSessionId);
                        }
                      }}
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--gv-accent)] hover:text-[var(--gv-accent-hover)] transition cursor-pointer"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 px-3 text-center">
              <div className="w-8 h-8 rounded-full bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center text-[var(--gv-accent)] mx-auto mb-2.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-xs text-[var(--gv-text-secondary)] leading-relaxed max-w-[200px] mx-auto">
                {meta.emptyHint}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
