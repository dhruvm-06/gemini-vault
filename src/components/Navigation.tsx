import React from 'react';
import { Shield, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavigationProps {
  onGoHome: () => void;
  activeSessionTitle?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ onGoHome, activeSessionTitle }) => {
  const { user, signOutUser } = useAuth();

  return (
    <header className="border-b border-stone-800 bg-stone-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onGoHome}>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-serif text-lg tracking-tight text-stone-100 font-medium">Gemini Vault</span>
            {activeSessionTitle && (
              <span className="hidden md:inline-block text-xs text-stone-400 font-sans border-l border-stone-800 pl-2 max-w-[200px] truncate">
                {activeSessionTitle}
              </span>
            )}
          </div>
        </div>

        {/* User profile & actions */}
        {user && (
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="flex items-center space-x-2.5 pr-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-stone-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-semibold flex items-center justify-center text-xs border border-amber-500/30">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
              <span className="hidden sm:inline-block text-xs text-stone-300 font-medium max-w-[140px] truncate">
                {user.displayName || 'Vault Keeper'}
              </span>
            </div>

            <button
              onClick={signOutUser}
              id="nav-signout-btn"
              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-stone-800 cursor-pointer"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
