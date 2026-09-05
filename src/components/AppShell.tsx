import React, { useState, useEffect } from 'react';
import { AppView, ContextRailItem } from '../types';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ContextRail } from './ContextRail';
import { MobileNav } from './MobileNav';
import { ProfileDrawer } from './ProfileDrawer';
import { CommandPalette } from './CommandPalette';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { executeVaultExport } from '../utils/vaultExport';
import { Minimize2 } from 'lucide-react';

interface AppShellProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  activeSessionId: string | null;
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  onSignOut?: () => Promise<void> | void;
  navigationError: string | null;
  onDismissError: () => void;
  contextItems?: ContextRailItem[];
  onOpenSession?: (sessionId: string) => void;
  onStartNewReflection?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentView,
  onNavigate,
  activeSessionId,
  user,
  onSignOut,
  navigationError,
  onDismissError,
  contextItems = [],
  onOpenSession,
  onStartNewReflection,
  children,
}) => {
  const { userProfile, getIdToken } = useAuth();
  const { theme, toggle } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isRailOpen, setIsRailOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (currentView === 'vault') return false;
      if (userProfile?.preferences?.contextRailDefault === 'closed') return false;
      return window.innerWidth >= 1280;
    }
    return false;
  });

  useEffect(() => {
    if (userProfile?.preferences?.contextRailDefault === 'closed') {
      setIsRailOpen(false);
    } else if (userProfile?.preferences?.contextRailDefault === 'open' && currentView !== 'vault') {
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setIsRailOpen(true);
      }
    }
  }, [userProfile?.preferences?.contextRailDefault, currentView]);

  // Automatically close profile drawer when navigating and ensure Vault rail defaults to closed
  const handleNavigate = (view: AppView) => {
    setIsProfileOpen(false);
    if (view === 'vault') {
      setIsRailOpen(false);
    }
    onNavigate(view);
  };

  useEffect(() => {
    if (currentView === 'vault') {
      setIsRailOpen(false);
    }
  }, [currentView]);

  const handleToggleRail = () => {
    if (currentView === 'vault') {
      window.dispatchEvent(new CustomEvent('gv-toggle-vault-rail'));
      return;
    }
    setIsRailOpen((prev) => !prev);
  };

  // Global hotkeys: Cmd+K / Ctrl+K for Command Palette, Cmd+Shift+F for Focus Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd+Shift+F or Ctrl+Shift+F for Focus Mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (activeSessionId) {
          setIsFocusMode((prev) => !prev);
        }
        return;
      }

      // Escape exits Focus Mode if open and not in command palette or profile
      if (e.key === 'Escape' && isFocusMode && !isCommandPaletteOpen && !isProfileOpen) {
        setIsFocusMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSessionId, isFocusMode, isCommandPaletteOpen, isProfileOpen]);

  // Turn off focus mode when exiting an active session
  useEffect(() => {
    if (!activeSessionId) {
      setIsFocusMode(false);
    }
  }, [activeSessionId]);

  // Listen for custom event gv-toggle-focus-mode from header/composer
  useEffect(() => {
    const handleToggleEvent = () => {
      if (activeSessionId) {
        setIsFocusMode((prev) => !prev);
      }
    };
    window.addEventListener('gv-toggle-focus-mode', handleToggleEvent);
    return () => window.removeEventListener('gv-toggle-focus-mode', handleToggleEvent);
  }, [activeSessionId]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--gv-surface-base)] text-[var(--gv-text-primary)] font-sans antialiased select-auto">
      {/* 1. Persistent Left Sidebar (Desktop & Tablet Wide) */}
      {!isFocusMode && (
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          activeSessionId={activeSessionId}
          user={user}
          onOpenProfile={() => setIsProfileOpen(true)}
          onSignOut={onSignOut}
        />
      )}

      {/* 2. Primary Workspace Column: Topbar + Central Canvas + Context Rail */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Slim Topbar Context Bar or Minimal Floating Focus Pill */}
        {!isFocusMode ? (
          <Topbar
            currentView={currentView}
            activeSessionId={activeSessionId}
            isRailOpen={isRailOpen}
            onToggleRail={handleToggleRail}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            user={user}
          />
        ) : (
          /* Floating Focus Mode Banner/Button */
          <div className="absolute top-3 right-4 z-40 flex items-center gap-2 animate-in fade-in duration-150">
            <button
              type="button"
              id="exit-focus-mode-btn"
              onClick={() => setIsFocusMode(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[36px] rounded-full bg-[var(--gv-surface-raised)]/95 backdrop-blur-md border border-[var(--gv-border-strong)] text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] text-xs font-medium shadow-md hover:border-[var(--gv-border-accent)] transition cursor-pointer active:scale-95"
              title="Exit Focus Mode (Esc or ⇧⌘F)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-[var(--gv-accent)]" />
              <span>Exit Focus</span>
              <span className="font-mono text-[10px] text-[var(--gv-text-muted)] ml-1 bg-[var(--gv-surface-ground)] px-1.5 py-0.5 rounded border border-[var(--gv-border-subtle)]">ESC</span>
            </button>
          </div>
        )}

        {/* Global Navigation Error Banner */}
        {navigationError && (
          <div className="absolute top-14 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-rose-800/70 bg-rose-950/90 p-4 text-xs text-rose-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">Notice</div>
                <div className="mt-1 text-rose-300/90 leading-relaxed">{navigationError}</div>
              </div>
              <button
                type="button"
                onClick={onDismissError}
                className="text-rose-400 hover:text-rose-100 text-lg leading-none p-1 cursor-pointer"
                aria-label="Dismiss notice"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Central Workspace Horizontal Split: Studio Canvas + Context Rail */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Main Studio Area */}
          <main
            id="main-studio-canvas"
            className={`flex-1 overflow-y-auto min-w-0 h-full ${
              activeSessionId ? '' : 'pb-16 md:pb-0'
            }`}
          >
            {children}
          </main>

          {/* Contextual Right Rail (Vault uses its own content-first overlay drawer) */}
          {currentView !== 'vault' && !isFocusMode && (
            <ContextRail
              currentView={currentView}
              activeSessionId={activeSessionId}
              items={contextItems}
              isOpen={isRailOpen}
              onToggle={handleToggleRail}
              onOpenSession={onOpenSession}
            />
          )}
        </div>
      </div>

      {/* 3. Mobile Persistent Bottom Navigation */}
      {!isFocusMode && (
        <MobileNav
          currentView={currentView}
          onNavigate={handleNavigate}
          activeSessionId={activeSessionId}
          onOpenProfile={() => setIsProfileOpen(true)}
          isProfileOpen={isProfileOpen}
        />
      )}

      {/* 4. Profile & Settings Drawer */}
      {isProfileOpen && (
        <ProfileDrawer
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onSignOut={onSignOut || (() => {})}
        />
      )}

      {/* 5. Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onStartNewReflection={() => {
          if (onStartNewReflection) onStartNewReflection();
          else handleNavigate('home');
        }}
        onOpenNewMemory={() => {
          handleNavigate('vault');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('gv-open-new-memory'));
          }, 100);
        }}
        onOpenAskVault={() => {
          handleNavigate('intelligence');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('gv-focus-ask-vault'));
          }, 100);
        }}
        onExportVault={() => {
          void executeVaultExport(getIdToken, 'json');
        }}
        onOpenSettings={() => setIsProfileOpen(true)}
        onToggleTheme={toggle}
        currentTheme={theme === 'morning' ? 'morning' : 'night'}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => {
          if (activeSessionId) {
            setIsFocusMode((prev) => !prev);
          } else {
            if (onStartNewReflection) onStartNewReflection();
            else handleNavigate('home');
          }
        }}
      />
    </div>
  );
};
