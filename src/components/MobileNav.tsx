import React from 'react';
import { Compass, Mic, Bookmark, Brain, User, Sparkles } from 'lucide-react';
import { AppView } from '../types';

interface MobileNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  activeSessionId: string | null;
  onOpenProfile: () => void;
  isProfileOpen?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  onNavigate,
  activeSessionId,
  onOpenProfile,
  isProfileOpen,
}) => {
  // Must not interfere with the active reflection session composer or virtual keyboard
  if (activeSessionId) {
    return null;
  }

  const navItems: {
    key: AppView;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { key: 'home', label: 'Reflect', icon: Compass },
    { key: 'voice', label: 'Voice', icon: Mic },
    { key: 'vault', label: 'Vault', icon: Bookmark },
    { key: 'moments', label: 'Moments', icon: Sparkles },
    { key: 'intelligence', label: 'Intel', icon: Brain },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--gv-surface-nav)] text-[var(--gv-surface-nav-text)] backdrop-blur-xl border-t border-[var(--gv-border-default)] transition-colors duration-150"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-6 items-center px-1">
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = currentView === key && !isProfileOpen;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={`min-h-[48px] h-14 w-full flex flex-col items-center justify-center gap-1 transition cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)] ${
                isActive
                  ? 'text-[var(--gv-accent-gold)] font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`w-4 h-4 transition ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] tracking-wider leading-none">
                {label}
              </span>
            </button>
          );
        })}

        {/* Profile Button */}
        <button
          type="button"
          onClick={onOpenProfile}
          className={`min-h-[48px] h-14 w-full flex flex-col items-center justify-center gap-1 transition cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)] ${
            isProfileOpen
              ? 'text-[var(--gv-accent-gold)] font-semibold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
          aria-label="Open profile and appearance settings"
          aria-expanded={isProfileOpen}
        >
          <User className={`w-4 h-4 transition ${isProfileOpen ? 'scale-110' : ''}`} />
          <span className="text-[10px] tracking-wider leading-none">
            Profile
          </span>
        </button>
      </div>
    </nav>
  );
};
