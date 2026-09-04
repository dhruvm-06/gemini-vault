import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Moon,
  Sun,
  Monitor,
  LogOut,
  Sparkles,
  BookOpen,
  Target,
  Shield,
  Check,
} from 'lucide-react';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Memory } from '../types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => Promise<void> | void;
}

interface VaultStats {
  reflectionCount: number;
  memoryCount: number;
  openLoopCount: number;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  onSignOut,
}) => {
  const { user, getIdToken } = useAuth();
  const { preference, setPreference } = useTheme();

  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus trap & restoration + Escape key handler
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Focus the close button after render
      requestAnimationFrame(() => {
        closeBtnRef.current?.focus();
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === 'Tab' && drawerRef.current) {
          const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), a[href]'
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  // Prevent background scrolling while drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Load vault stats on open without new backend work
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const token = await getIdToken();
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const [sessionRes, memRes] = await Promise.all([
          fetch('/api/journal/sessions', { headers }).catch(() => null),
          fetch('/api/memories', { headers }).catch(() => null),
        ]);

        let reflectionCount = 0;
        let memoryCount = 0;
        let openLoopCount = 0;

        if (sessionRes && sessionRes.ok) {
          const sData = await sessionRes.json().catch(() => ({}));
          if (Array.isArray(sData.sessions)) {
            reflectionCount = sData.sessions.length;
          }
        }

        if (memRes && memRes.ok) {
          const mData = await memRes.json().catch(() => ({}));
          if (Array.isArray(mData.memories)) {
            memoryCount = mData.memories.length;
            openLoopCount = mData.memories.filter(
              (m: Memory & { loopStatus?: string }) =>
                m.loopStatus === 'open' ||
                (!m.loopStatus && (m.category === 'goal' || m.category === 'commitment'))
            ).length;
          }
        }

        if (isMounted) {
          setStats({ reflectionCount, memoryCount, openLoopCount });
        }
      } catch (err) {
        console.error('[ProfileDrawer] Error loading stats:', err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    void loadStats();
    return () => {
      isMounted = false;
    };
  }, [isOpen, getIdToken]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onSignOut();
      onClose();
    } catch (error) {
      console.error('[ProfileDrawer] Sign out error:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!isOpen) return null;

  const displayName = user?.displayName || 'Vault User';
  const email = user?.email || 'Private Workspace';
  const photoURL = user?.photoURL;
  const initial = (displayName || email).charAt(0).toUpperCase();

  const themeOptions: {
    id: ThemePreference;
    name: string;
    description: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'night',
      name: 'Night Vault',
      description: 'Deep charcoal canvas with warm amber intelligence',
      icon: Moon,
    },
    {
      id: 'morning',
      name: 'Morning Vault',
      description: 'Warm editorial ivory with crisp contrast',
      icon: Sun,
    },
    {
      id: 'system',
      name: 'System Default',
      description: 'Synchronize dynamically with device appearance',
      icon: Monitor,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
        className="relative z-10 w-full max-w-sm h-full flex flex-col justify-between overflow-y-auto bg-[var(--gv-surface-ground)] border-l border-[var(--gv-border-default)] shadow-2xl p-6 transition-transform duration-200"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--gv-border-subtle)]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--gv-accent)]" />
              <h2
                id="profile-drawer-title"
                className="font-serif text-base font-medium text-[var(--gv-text-primary)]"
              >
                Vault Profile
              </h2>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close profile drawer"
              className="p-1.5 rounded-lg text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:bg-[var(--gv-surface-raised)] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Information */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[var(--gv-surface-raised)]/60 border border-[var(--gv-border-subtle)]">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover border border-[var(--gv-border-strong)] shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] text-[var(--gv-accent)] font-serif text-lg font-medium flex items-center justify-center shrink-0">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--gv-text-primary)] truncate">
                {displayName}
              </div>
              <div className="text-xs text-[var(--gv-text-secondary)] truncate">
                {email}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--gv-accent-muted)] text-[var(--gv-accent)] border border-[var(--gv-accent-border)]">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Verified Firebase UID</span>
              </div>
            </div>
          </div>

          {/* Appearance / Theme Switching */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gv-text-tertiary)]">
                Appearance
              </span>
              <span className="text-[11px] text-[var(--gv-text-muted)]">
                Theme tokens
              </span>
            </div>

            <div className="space-y-2" role="radiogroup" aria-label="Theme selection">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = preference === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setPreference(opt.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--gv-surface-raised)] border-[var(--gv-accent)] text-[var(--gv-text-primary)] shadow-sm'
                        : 'bg-transparent border-[var(--gv-border-subtle)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] hover:border-[var(--gv-border-strong)] hover:bg-[var(--gv-surface-raised)]/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 ${
                          isSelected
                            ? 'bg-[var(--gv-accent-muted)] text-[var(--gv-accent)]'
                            : 'bg-[var(--gv-surface-raised)] text-[var(--gv-text-secondary)]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[var(--gv-text-primary)]">
                          {opt.name}
                        </div>
                        <div className="text-[11px] text-[var(--gv-text-muted)] mt-0.5 leading-snug">
                          {opt.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-[var(--gv-accent)] text-[var(--gv-surface-ground)] flex items-center justify-center shrink-0 mt-1">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vault Longitudinal Summary Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gv-text-tertiary)]">
                Vault Summary
              </span>
              <span className="text-[11px] text-[var(--gv-text-muted)]">
                Isolated to your UID
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-[var(--gv-surface-raised)]/50 border border-[var(--gv-border-subtle)] text-center">
                <div className="flex justify-center mb-1 text-[var(--gv-text-secondary)]">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-semibold text-[var(--gv-text-primary)]">
                  {loadingStats ? (
                    <span className="animate-pulse">--</span>
                  ) : (
                    stats?.reflectionCount ?? 0
                  )}
                </div>
                <div className="text-[10px] text-[var(--gv-text-muted)] mt-0.5">
                  Reflections
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--gv-surface-raised)]/50 border border-[var(--gv-border-subtle)] text-center">
                <div className="flex justify-center mb-1 text-[var(--gv-accent)]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-semibold text-[var(--gv-text-primary)]">
                  {loadingStats ? (
                    <span className="animate-pulse">--</span>
                  ) : (
                    stats?.memoryCount ?? 0
                  )}
                </div>
                <div className="text-[10px] text-[var(--gv-text-muted)] mt-0.5">
                  Memories
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--gv-surface-raised)]/50 border border-[var(--gv-border-subtle)] text-center">
                <div className="flex justify-center mb-1 text-emerald-400">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <div className="text-base font-semibold text-[var(--gv-text-primary)]">
                  {loadingStats ? (
                    <span className="animate-pulse">--</span>
                  ) : (
                    stats?.openLoopCount ?? 0
                  )}
                </div>
                <div className="text-[10px] text-[var(--gv-text-muted)] mt-0.5">
                  Open Loops
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Guarantee Notice */}
          <div className="p-3 rounded-xl bg-[var(--gv-surface-raised)]/30 border border-[var(--gv-border-subtle)] text-[11px] text-[var(--gv-text-tertiary)] leading-relaxed flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-[var(--gv-accent)] shrink-0 mt-0.5" />
            <span>
              All reflections, memories, and intelligence artifacts are scoped strictly to your verified identity. Zero telemetry tracking.
            </span>
          </div>
        </div>

        {/* Footer / Sign out */}
        <div className="pt-6 mt-6 border-t border-[var(--gv-border-subtle)]">
          <button
            type="button"
            id="drawer-signout-btn"
            disabled={isSigningOut}
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-rose-800/50 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{isSigningOut ? 'Signing out...' : 'Sign Out of Vault'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
