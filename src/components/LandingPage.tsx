import React from 'react';
import { Shield, Lock, CheckCircle2, Sun, Moon } from 'lucide-react';
import { VaultPresence } from './VaultPresence';
import { useTheme } from '../context/ThemeContext';

interface LandingPageProps {
  onSignIn: () => Promise<void> | void;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  loading,
  error,
  onClearError,
}) => {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--gv-surface-ground)] text-[var(--gv-text-primary)] font-sans flex flex-col transition-colors duration-200">
      {/* Top Header: Brand & Theme Toggle */}
      <header className="h-18 border-b border-[var(--gv-border-subtle)] bg-[var(--gv-surface-ground)]/90 backdrop-blur-md sticky top-0 z-30 transition-colors duration-200">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--gv-accent-muted)] border border-[var(--gv-accent-border)] flex items-center justify-center text-[var(--gv-accent)]">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-serif text-xl tracking-tight font-medium text-[var(--gv-text-primary)]">
              Gemini Vault
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-[var(--gv-text-tertiary)] font-normal">
              Private reflective studio
            </span>

            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={toggle}
              className="p-2 rounded-xl text-[var(--gv-text-secondary)] hover:text-[var(--gv-text-primary)] bg-[var(--gv-surface-raised)]/70 hover:bg-[var(--gv-surface-raised)] border border-[var(--gv-border-default)] transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)]"
              title={`Active theme: ${theme}. Click to switch.`}
              aria-label={`Switch theme (currently ${theme})`}
            >
              {theme === 'morning' ? (
                <Moon className="w-4 h-4 text-[var(--gv-accent)]" />
              ) : (
                <Sun className="w-4 h-4 text-[var(--gv-accent)]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Editorial Hero */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 sm:py-16 md:py-20 flex flex-col items-center text-center">
        {/* Error Notification Banner */}
        {error && (
          <div className="w-full max-w-lg mb-8 rounded-2xl border border-[var(--gv-error-border)] bg-[var(--gv-error-muted)] px-4 py-3 text-xs text-[var(--gv-error-text)] shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={onClearError}
                className="text-base leading-none p-1 hover:opacity-75 cursor-pointer"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Centerpiece: Vault Presence Visual Intelligence Core */}
        <div className="my-4 sm:my-6">
          <VaultPresence
            state="idle"
            size="large"
            label="Gemini Vault living intelligence presence"
          />
        </div>

        {/* Editorial Headline */}
        <h1 className="mt-4 sm:mt-6 text-4xl sm:text-6xl md:text-7xl font-serif font-normal text-[var(--gv-text-primary)] tracking-tight leading-[1.06] max-w-2xl">
          Think freely.
          <br />
          <span className="text-[var(--gv-text-tertiary)] italic font-light">
            Remember what matters.
          </span>
        </h1>

        {/* Narrative Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-[var(--gv-text-secondary)] max-w-xl leading-relaxed font-sans font-normal">
          Reflect with Gemini. Keep what matters. Notice what changes.
        </p>

        {/* Primary CTA: Continue with Google */}
        <div className="mt-8 sm:mt-10 flex flex-col items-center">
          <button
            type="button"
            id="google-signin-btn"
            onClick={() => { void onSignIn(); }}
            disabled={loading}
            className="group min-h-[52px] h-14 px-8 rounded-2xl bg-[var(--gv-text-primary)] text-[var(--gv-text-inverse)] hover:opacity-90 active:scale-[0.99] transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            {/* Google G Emblem */}
            <svg
              className="w-5 h-5 shrink-0 transition group-hover:scale-105"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span className="text-sm sm:text-base font-medium tracking-normal">
              {loading ? 'Opening your Vault...' : 'Continue with Google'}
            </span>
          </button>
        </div>

        {/* Trust & Privacy Pillars */}
        <div className="mt-12 sm:mt-14 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs text-[var(--gv-text-tertiary)]">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[var(--gv-accent)] shrink-0" />
            <span>Private by design</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[var(--gv-accent)] shrink-0" />
            <span>User-isolated memories</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--gv-accent)] shrink-0" />
            <span>Human-approved durable memory</span>
          </div>
        </div>

        {/* Editorial Reflection Preview (Authentic Studio Excerpt) */}
        <div className="w-full max-w-xl mt-14 sm:mt-18 rounded-3xl border border-[var(--gv-border-default)] bg-[var(--gv-surface-raised)]/50 p-6 sm:p-8 text-left shadow-sm">
          <div className="text-[11px] font-medium text-[var(--gv-accent)] tracking-wider uppercase">
            A quiet reflection with Gemini
          </div>
          <p className="mt-3 font-serif text-sm sm:text-base text-[var(--gv-text-primary)] leading-relaxed italic">
            “I notice myself rushing through decisions simply to feel done with them. But speed isn’t clarity.”
          </p>
          <div className="mt-4 pt-4 border-t border-[var(--gv-border-subtle)]">
            <p className="text-xs sm:text-sm text-[var(--gv-text-secondary)] leading-relaxed">
              When resolution feels urgent, patience can look like stillness. What would happen if this next choice didn’t demand an answer before tonight?
            </p>
          </div>
        </div>
      </main>

      {/* Editorial Footer */}
      <footer className="py-6 border-t border-[var(--gv-border-subtle)] text-center text-xs text-[var(--gv-text-tertiary)]">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Gemini Vault — Private reflective intelligence</span>
          <span>Google Gemini • Firebase isolated storage</span>
        </div>
      </footer>
    </div>
  );
};
