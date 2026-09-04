import React from 'react';
import { Shield, Sun, Moon, PanelRight, Lock, Compass, Mic, Bookmark, Brain, FileText, Calendar } from 'lucide-react';
import { AppView } from '../types';
import { useTheme } from '../context/ThemeContext';
import { VaultPresence } from './VaultPresence';

interface TopbarProps {
  currentView: AppView;
  activeSessionId: string | null;
  isRailOpen: boolean;
  onToggleRail: () => void;
  onOpenProfile: () => void;
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
    <header className="h-12 border-b border-[var(--gv-border-default)] bg-[var(--gv-surface-base)]/85 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 transition-colors duration-150 select-none">
      {/* Left: View breadcrumb / title + mobile brand */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile brand indicator (visible only below md breakpoint) */}
        <div className="flex md:hidden items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent)] flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="font-serif text-sm font-medium text-[var(--gv-text-primary)]">
            Vault
          </span>
          <span className="text-[var(--gv-text-tertiary)] text-xs">/</span>
        </div>

        {/* Current View Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--gv-text-primary)] min-w-0">
          <Icon className="w-3.5 h-3.5 text-[var(--gv-accent)] shrink-0" />
          <span className="truncate">{meta.label}</span>
          {activeSessionId && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] border border-[var(--gv-accent-border)] font-medium">
              Live
            </span>
          )}
        </div>
      </div>

      {/* Center: Micro Vault Presence Intelligence Indicator */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gv-surface-ground)]/80 border border-[var(--gv-border-subtle)] shadow-2xs">
        <VaultPresence size="micro" state="idle" label="Vault Intelligence Core Active" />
        <span className="text-[11px] tracking-wide text-[var(--gv-text-secondary)] font-serif">
          Vault Presence
        </span>
      </div>

      {/* Right: Security Badge, Theme Toggle, Context Rail Toggle, Mobile Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Workspace Security Chip */}
        <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-[var(--gv-text-tertiary)] bg-[var(--gv-surface-ground)]/60 border border-[var(--gv-border-subtle)]">
          <Lock className="w-3 h-3 text-[var(--gv-accent)]" />
          <span>Private Vault</span>
        </div>

        {/* Quick Theme Toggle */}
        <button
          type="button"
          onClick={toggle}
          className="p-1.5 rounded-lg text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] transition cursor-pointer"
          title={`Active theme: ${theme}. Click to switch.`}
          aria-label={`Switch theme (currently ${theme})`}
        >
          {theme === 'morning' ? (
            <Moon className="w-4 h-4 text-[var(--gv-accent)]" />
          ) : (
            <Sun className="w-4 h-4 text-[var(--gv-accent)]" />
          )}
        </button>

        {/* Context Rail Open/Close Toggle */}
        <button
          type="button"
          onClick={onToggleRail}
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            isRailOpen
              ? 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)] border-[var(--gv-border-strong)] shadow-2xs'
              : 'text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] border-[var(--gv-border-subtle)]'
          }`}
          title={isRailOpen ? 'Close context rail' : 'Open context rail'}
          aria-label={isRailOpen ? 'Close context rail' : 'Open context rail'}
          aria-pressed={isRailOpen}
        >
          <PanelRight className="w-4 h-4 text-[var(--gv-accent)]" />
        </button>

        {/* Mobile Profile Trigger (Visible only on mobile) */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="md:hidden p-1 rounded-full border border-[var(--gv-border-subtle)] hover:border-[var(--gv-border-strong)] transition cursor-pointer"
          aria-label="Open profile settings"
        >
          {photoURL ? (
            <img
              src={photoURL}
              alt={displayName}
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] text-[10px] font-medium flex items-center justify-center">
              {initial}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
