import React from 'react';
import { Sun, Moon, PanelRight, Lock, Compass, Mic, Bookmark, Brain, FileText, Calendar, Search } from 'lucide-react';
import { AppView } from '../types';
import { useTheme } from '../context/ThemeContext';
import { VaultPresence } from './VaultPresence';
import { VaultBrandMark } from './VaultBrandMark';

interface TopbarProps {
  currentView: AppView;
  activeSessionId: string | null;
  isRailOpen: boolean;
  onToggleRail: () => void;
  onOpenProfile: () => void;
  onOpenCommandPalette?: () => void;
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  activeSessionId,
  isRailOpen,
  onToggleRail,
  onOpenProfile,
  onOpenCommandPalette,
  user,
}) => {
  const { theme, toggle } = useTheme();

  const getViewMeta = () => {
    if (activeSessionId) {
      return {
        label: 'Active Reflection',
        icon: Compass,
      };
    }
    switch (currentView) {
      case 'home':
        return { label: 'Reflection Studio', icon: Compass };
      case 'voice':
        return { label: 'Voice Studio', icon: Mic };
      case 'vault':
        return { label: 'Vault & Memories', icon: Bookmark };
      case 'intelligence':
        return { label: 'Vault Intelligence', icon: Brain };
      case 'documents':
        return { label: 'Documents & Grounding', icon: FileText };
      case 'calendar':
        return { label: 'Calendar & Commitments', icon: Calendar };
      default:
        return { label: 'Workspace', icon: Compass };
    }
  };

  const meta = getViewMeta();
  const Icon = meta.icon;

  const displayName = user?.displayName || user?.email || 'User';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  const photoURL = user?.photoURL;

  return (
    <header className="h-14 border-b border-[var(--gv-border-default)] bg-[var(--gv-surface-base)]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 transition-colors duration-150 select-none">
      {/* Left: View breadcrumb / title + mobile brand */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile brand indicator (visible only below md breakpoint) */}
        <div className="flex md:hidden items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center shrink-0">
            <VaultBrandMark size={16} variant="gold" />
          </div>
          <span className="font-serif text-sm font-medium text-[var(--gv-text-primary)]">
            Vault
          </span>
          <span className="text-[var(--gv-text-tertiary)] text-xs">/</span>
        </div>

        {/* Current View Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--gv-text-primary)] min-w-0">
          <Icon className="w-4 h-4 text-[var(--gv-accent)] shrink-0" />
          <span className="truncate">{meta.label}</span>
          {activeSessionId && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] border border-[var(--gv-accent-border)] font-medium">
              Live
            </span>
          )}
        </div>
      </div>

      {/* Center: Micro Vault Presence Intelligence Indicator */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--gv-surface-ground)]/80 border border-[var(--gv-border-subtle)] shadow-2xs">
        <VaultPresence size="micro" state="idle" label="Vault Intelligence Core Active" />
        <span className="text-[11px] tracking-wide text-[var(--gv-text-secondary)] font-serif">
          Vault Presence
        </span>
      </div>

      {/* Right: Security Badge, Command Palette, Theme Toggle, Context Rail Toggle, Mobile Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Workspace Security Chip */}
        <div className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs text-[var(--gv-text-secondary)] bg-[var(--gv-surface-raised)]/60 border border-[var(--gv-border-subtle)]">
          <Lock className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
          <span>Private Vault</span>
        </div>

        {/* Command Palette Trigger (Desktop/Tablet only) — 36px hit target */}
        {onOpenCommandPalette && (
          <button
            type="button"
            id="topbar-command-palette-btn"
            onClick={onOpenCommandPalette}
            className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] bg-[var(--gv-surface-raised)]/70 hover:bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] hover:border-[var(--gv-border-strong)] transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)]"
            title="Open Command Palette (Ctrl+K or ⌘K)"
            aria-label="Open Command Palette (Ctrl+K or ⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
            <span className="font-mono text-[10px] text-[var(--gv-text-muted)] px-1.5 py-0.5 rounded bg-[var(--gv-surface-base)] border border-[var(--gv-border-subtle)] font-medium">⌘K</span>
          </button>
        )}

        {/* Quick Theme Toggle — 36px hit target */}
        <button
          type="button"
          onClick={toggle}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] bg-[var(--gv-surface-raised)]/70 hover:bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] hover:border-[var(--gv-border-strong)] transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)]"
          title={`Active theme: ${theme}. Click to switch.`}
          aria-label={`Switch theme (currently ${theme})`}
        >
          {theme === 'morning' ? (
            <Moon className="w-4 h-4 text-[var(--gv-accent)]" />
          ) : (
            <Sun className="w-4 h-4 text-[var(--gv-accent)]" />
          )}
        </button>

        {/* Context Rail Open/Close Toggle — 36px hit target */}
        <button
          type="button"
          onClick={onToggleRail}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)] ${
            isRailOpen
              ? 'bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] border border-[var(--gv-accent-border)] shadow-xs'
              : 'text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] bg-[var(--gv-surface-raised)]/70 hover:bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] hover:border-[var(--gv-border-strong)]'
          }`}
          title={isRailOpen ? 'Close context rail' : 'Open context rail'}
          aria-label={isRailOpen ? 'Close context rail' : 'Open context rail'}
          aria-pressed={isRailOpen}
        >
          <PanelRight className="w-4 h-4 text-[var(--gv-accent)]" />
        </button>

        {/* Mobile Profile Trigger (Visible only on mobile) — 36px hit target */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--gv-border-default)] hover:border-[var(--gv-border-strong)] bg-[var(--gv-surface-raised)]/70 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)]"
          aria-label="Open profile settings"
        >
          {photoURL ? (
            <img
              src={photoURL}
              alt={displayName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] text-[10px] font-medium flex items-center justify-center">
              {initial}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
