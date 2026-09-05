import React from 'react';
import {
  Compass,
  Mic,
  Bookmark,
  Brain,
  FileText,
  Calendar,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { VaultBrandMark } from './VaultBrandMark';
import { AppView } from '../types';

interface SidebarProps {
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

interface NavItem {
  key: AppView;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Reflect', icon: Compass },
  { key: 'voice', label: 'Voice', icon: Mic },
  { key: 'vault', label: 'Vault', icon: Bookmark },
  { key: 'moments', label: 'Moments', icon: Sparkles },
  { key: 'intelligence', label: 'Intelligence', icon: Brain },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  activeSessionId,
  user,
  onOpenProfile,
  onSignOut,
}) => {
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Reflector';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  const photoURL = user?.photoURL;

  return (
    <aside
      className="hidden md:flex flex-col w-[230px] shrink-0 h-screen sticky top-0 border-r border-[var(--gv-border-default)] bg-[var(--gv-surface-nav)] text-[var(--gv-surface-nav-text)] select-none z-40 transition-colors duration-150"
      aria-label="Studio Primary Navigation"
    >
      {/* Top Header: Brand Logo & Title */}
      <div className="h-14 px-4.5 flex items-center gap-3 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)] rounded-lg p-1 -m-1"
        >
          <div className="w-7 h-7 rounded-lg bg-[var(--gv-accent-gold)]/10 border border-[var(--gv-accent-gold)]/25 flex items-center justify-center transition group-hover:scale-105">
            <VaultBrandMark size={18} variant="gold" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-serif text-base tracking-tight font-medium text-white">
              Gemini Vault
            </span>
          </div>
        </button>
      </div>

      {/* Navigation Links Area */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Studio Destinations">
        <div className="text-[10px] font-medium tracking-wider uppercase text-stone-500 px-2.5 pb-2">
          Studio
        </div>

        {NAV_ITEMS.map(({ key, label, icon: Icon, badge }) => {
          const isActive = !activeSessionId && currentView === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer group ${
                isActive
                  ? 'bg-stone-800/90 text-white shadow-xs border border-stone-700/60'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-stone-850/60'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition ${
                    isActive ? 'text-[var(--gv-accent-gold)]' : 'text-stone-400 group-hover:text-stone-200'
                  }`}
                />
                <span className="truncate">{label}</span>
              </div>
              {badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-400 border border-stone-700">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile & Settings Section */}
      <div className="p-3 border-t border-white/10 shrink-0 space-y-1.5">
        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-100 hover:bg-stone-850/60 transition cursor-pointer"
          aria-label="Open settings and profile"
        >
          <Settings className="w-4 h-4 shrink-0 text-stone-400" />
          <span>Settings</span>
        </button>

        {/* User Identity Chip */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-stone-900/60 border border-stone-800/80">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
          >
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-6 h-6 rounded-full object-cover border border-stone-700 shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-stone-800 border border-stone-700 text-[var(--gv-accent-gold)] text-[11px] font-medium flex items-center justify-center shrink-0">
                {initial}
              </div>
            )}
            <span className="text-xs text-stone-300 font-medium truncate group-hover:text-white">
              {displayName}
            </span>
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={() => { void onSignOut(); }}
              className="p-1 rounded-lg text-stone-400 hover:text-rose-300 hover:bg-stone-800 transition cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
