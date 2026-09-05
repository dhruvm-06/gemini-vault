import React from 'react';
import { Home, Vault, Brain, Sun, Moon, LogOut, Search, Sparkles, FileText } from 'lucide-react';
import { VaultBrandMark } from './VaultBrandMark';
import { AppView } from '../types';
import { useTheme } from '../context/ThemeContext';

interface DesktopNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  activeSessionId: string | null;
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  onOpenProfile: () => void;
  onSignOut?: () => Promise<void> | void;
}

const NAV_ITEMS: { key: AppView; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'home', label: 'Reflect', icon: Home },
  { key: 'vault', label: 'Vault', icon: Vault },
  { key: 'moments', label: 'Moments', icon: Sparkles },
  { key: 'intelligence', label: 'Intelligence', icon: Brain },
  { key: 'documents', label: 'Documents', icon: FileText },
];

export const DesktopNav: React.FC<DesktopNavProps> = ({
  currentView,
  onNavigate,
  activeSessionId,
  user,
  onOpenProfile,
  onSignOut,
}) => {
  const { theme, toggle } = useTheme();

  const displayName = user?.displayName || user?.email || 'User';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  const photoURL = user?.photoURL;

  return (
    <header className="h-16 border-b border-[var(--gv-border-default)] bg-[var(--gv-surface-ground)]/95 backdrop-blur-xl sticky top-0 z-40 transition-colors duration-150">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Brand + Desktop Links */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 shrink-0 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)] rounded-lg p-1 -m-1"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center transition group-hover:scale-105">
              <VaultBrandMark size={20} variant="gold" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-serif text-lg leading-tight font-medium text-[var(--gv-text-primary)]">
                Gemini Vault
              </span>
            </div>
          </button>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1.5 ml-4" aria-label="Main Navigation">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const isActive = !activeSessionId && currentView === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-primary)] border border-[var(--gv-border-strong)] shadow-sm'
                      : 'text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)]/60 border border-transparent'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Search indicator, Theme quick toggle, Profile avatar, Sign out */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--gv-text-tertiary)] px-2.5 py-1 rounded-lg bg-[var(--gv-surface-raised)]/40 border border-[var(--gv-border-subtle)]">
            <Search className="w-3 h-3 text-[var(--gv-accent)]" />
            <span>Private workspace</span>
          </div>

          {/* Theme Quick Toggle */}
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-xl text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] bg-[var(--gv-surface-raised)]/50 hover:bg-[var(--gv-surface-raised)] border border-[var(--gv-border-subtle)] transition cursor-pointer"
            title={`Active theme: ${theme}. Click to switch.`}
            aria-label={`Switch theme (currently ${theme})`}
          >
            {theme === 'morning' ? (
              <Moon className="w-4 h-4 text-[var(--gv-accent)]" />
            ) : (
              <Sun className="w-4 h-4 text-[var(--gv-accent)]" />
            )}
          </button>

          {/* Profile Trigger Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-[var(--gv-border-subtle)] hover:border-[var(--gv-border-strong)] bg-[var(--gv-surface-raised)]/50 hover:bg-[var(--gv-surface-raised)] transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)]"
            aria-label="Open profile and settings drawer"
          >
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-6 h-6 rounded-full object-cover border border-[var(--gv-border-subtle)]"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] text-[11px] font-medium flex items-center justify-center">
                {initial}
              </div>
            )}
            <span className="hidden sm:inline text-xs text-[var(--gv-text-secondary)] font-medium max-w-[100px] truncate">
              {displayName}
            </span>
          </button>

          {/* Sign Out Button (preserved for desktop) */}
          {onSignOut && (
            <button
              type="button"
              id="header-signout-btn"
              onClick={() => { void onSignOut(); }}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--gv-border-subtle)] bg-[var(--gv-surface-raised)]/50 hover:bg-[var(--gv-surface-raised)] px-2.5 sm:px-3 py-1.5 text-xs text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:border-[var(--gv-border-strong)] transition cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
