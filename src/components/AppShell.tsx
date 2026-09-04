import React, { useState, useEffect } from 'react';
import { AppView, ContextRailItem } from '../types';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ContextRail } from './ContextRail';
import { MobileNav } from './MobileNav';
import { ProfileDrawer } from './ProfileDrawer';

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
  children,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRailOpen, setIsRailOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1280;
    }
    return true;
  });

  // Automatically close profile drawer when navigating
  const handleNavigate = (view: AppView) => {
    setIsProfileOpen(false);
    onNavigate(view);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--gv-surface-base)] text-[var(--gv-text-primary)] font-sans antialiased select-auto">
      {/* 1. Persistent Left Sidebar (Desktop & Tablet Wide) */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        activeSessionId={activeSessionId}
        user={user}
        onOpenProfile={() => setIsProfileOpen(true)}
        onSignOut={onSignOut}
      />

      {/* 2. Primary Workspace Column: Topbar + Central Canvas + Context Rail */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Slim Topbar Context Bar */}
        <Topbar
          currentView={currentView}
          activeSessionId={activeSessionId}
          isRailOpen={isRailOpen}
          onToggleRail={() => setIsRailOpen((prev) => !prev)}
          onOpenProfile={() => setIsProfileOpen(true)}
          user={user}
        />

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

          {/* Contextual Right Rail */}
          <ContextRail
            currentView={currentView}
            activeSessionId={activeSessionId}
            items={contextItems}
            isOpen={isRailOpen}
            onToggle={() => setIsRailOpen((prev) => !prev)}
            onOpenSession={onOpenSession}
          />
        </div>
      </div>

      {/* 3. Mobile Persistent Bottom Navigation */}
      <MobileNav
        currentView={currentView}
        onNavigate={handleNavigate}
        activeSessionId={activeSessionId}
        onOpenProfile={() => setIsProfileOpen(true)}
        isProfileOpen={isProfileOpen}
      />

      {/* 4. Profile & Settings Drawer */}
      {isProfileOpen && (
        <ProfileDrawer
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onSignOut={onSignOut || (() => {})}
        />
      )}
    </div>
  );
};
