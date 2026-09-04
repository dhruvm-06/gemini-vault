import React, { useState } from 'react';
import { AppView } from '../types';
import { DesktopNav } from './DesktopNav';
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
  children,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--gv-surface-base)] text-[var(--gv-text-primary)] font-sans flex flex-col transition-colors duration-150">
      {/* Desktop & Tablet Header */}
      <DesktopNav
        currentView={currentView}
        onNavigate={(view) => {
          setIsProfileOpen(false);
          onNavigate(view);
        }}
        activeSessionId={activeSessionId}
        user={user}
        onOpenProfile={() => setIsProfileOpen(true)}
        onSignOut={onSignOut}
      />

      {/* Navigation Error Toast Banner */}
      {navigationError && (
        <div className="fixed top-[4.5rem] right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-rose-800/70 bg-rose-950/90 px-4 py-3 text-xs text-rose-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Something went wrong</div>
              <div className="mt-1 text-rose-300/90 leading-relaxed">{navigationError}</div>
            </div>
            <button
              type="button"
              onClick={onDismissError}
              className="text-rose-400 hover:text-rose-100 text-base leading-none p-1 cursor-pointer"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main
        className={`flex-1 min-h-[calc(100vh-4rem)] ${
          activeSessionId ? '' : 'pb-16 md:pb-0'
        }`}
      >
        {children}
      </main>

      {/* Mobile Persistent Bottom Navigation */}
      <MobileNav
        currentView={currentView}
        onNavigate={(view) => {
          setIsProfileOpen(false);
          onNavigate(view);
        }}
        activeSessionId={activeSessionId}
        onOpenProfile={() => setIsProfileOpen(true)}
        isProfileOpen={isProfileOpen}
      />

      {/* Profile & Settings Drawer */}
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onSignOut={onSignOut || (() => {})}
      />
    </div>
  );
};
