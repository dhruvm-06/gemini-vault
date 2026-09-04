import React, { useEffect, useState } from 'react';
import { Brain, Home, LogOut, Search, Shield, Sparkles, Vault } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { JournalHome } from './components/JournalHome';
import { JournalSessionView } from './components/JournalSessionView';
import { VaultDashboard } from './components/VaultDashboard';
import { IntelligenceDashboard } from './components/IntelligenceDashboard';

type AppView = 'home' | 'vault' | 'intelligence';

export default function App() {
  const auth = useAuth();
  const { user, loading, error, signInWithGoogle, signOutUser, getIdToken, clearError } = auth;

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('session');
  });
  const [initialPromptForSession, setInitialPromptForSession] = useState<string | undefined>();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>(() => {
    const raw = new URLSearchParams(window.location.search).get('view');
    return raw === 'vault' || raw === 'intelligence' ? raw : 'home';
  });

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      const sessionParam = params.get('session');
      const viewParam = params.get('view');
      setActiveSessionId(sessionParam);
      setInitialPromptForSession(undefined);
      if (viewParam === 'vault' || viewParam === 'intelligence' || viewParam === 'home') {
        setView(viewParam);
      } else if (event.state && typeof (event.state as { returnView?: string }).returnView === 'string') {
        const returnView = (event.state as { returnView: AppView }).returnView;
        if (returnView === 'vault' || returnView === 'intelligence' || returnView === 'home') {
          setView(returnView);
        } else {
          setView('home');
        }
      } else if (!sessionParam) {
        setView('home');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (nextView: AppView) => {
    setNavigationError(null);
    setActiveSessionId(null);
    setInitialPromptForSession(undefined);
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    url.searchParams.set('view', nextView);
    window.history.pushState({ view: nextView }, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const openSession = (sessionId: string, initialPrompt?: string) => {
    setNavigationError(null);
    setInitialPromptForSession(initialPrompt);
    setActiveSessionId(sessionId);
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    url.searchParams.delete('view');
    window.history.pushState({ session: sessionId, returnView: view }, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const handleBackFromSession = () => {
    if (window.history.state && typeof (window.history.state as { returnView?: string }).returnView === 'string') {
      const returnView = (window.history.state as { returnView: AppView }).returnView;
      if (returnView === 'vault' || returnView === 'intelligence' || returnView === 'home') {
        navigate(returnView);
        return;
      }
    }
    navigate(view === 'vault' || view === 'intelligence' ? view : 'home');
  };

  const startSession = async (initialText?: string) => {
    setIsCreatingSession(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/journal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ draftContent: initialText || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create reflection.');
      const newSessionId = data.session?.id;
      if (!newSessionId) throw new Error('Reflection session was not created.');

      const starterPrompt = initialText?.trim()
        ? initialText.trim()
        : 'Begin this reflection by asking me one thoughtful, open-ended question about what is currently occupying my mind. Keep it natural and concise.';
      openSession(newSessionId, starterPrompt);
    } catch (error) {
      console.error('[App] Failed to create reflection:', error);
      setNavigationError(error instanceof Error ? error.message : 'Failed to create reflection.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const continueSession = async (sessionId: string) => {
    setIsCreatingSession(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/journal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ continuedFromSessionId: sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to continue reflection.');
      const newSessionId = data.session?.id;
      if (!newSessionId) throw new Error('Continuation session was not created.');

      openSession(
        newSessionId,
        'I want to continue and rework the ideas from this earlier reflection. Help me revisit them thoughtfully and explore what has changed.'
      );
    } catch (error) {
      console.error('[App] Failed to continue reflection:', error);
      setNavigationError(error instanceof Error ? error.message : 'Failed to continue reflection.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-7 h-7 text-amber-400 mx-auto animate-pulse" />
          <h2 className="mt-4 text-lg font-serif">Opening Gemini Vault</h2>
          <p className="mt-1 text-xs text-stone-500">Authenticating your private space…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 font-sans">
        <header className="h-16 border-b border-stone-800 bg-stone-950/90 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto h-full px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Shield className="w-4 h-4" />
              </div>
              <span className="font-serif text-lg">Gemini Vault</span>
            </div>
            <span className="hidden sm:inline text-xs text-stone-500">Private reflective intelligence</span>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-5 py-14 sm:py-20">
          {error && (
            <div className="max-w-2xl mx-auto mb-6 rounded-xl border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
              <div className="flex items-start justify-between gap-3">
                <span>{error}</span>
                <button type="button" onClick={clearError}>×</button>
              </div>
            </div>
          )}
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                <Sparkles className="w-3.5 h-3.5" />
                A private place to think
              </div>
              <h1 className="mt-7 text-5xl sm:text-7xl font-serif font-normal leading-[0.93] tracking-tight">
                Think freely.<br /><span className="text-stone-500">Remember what matters.</span>
              </h1>
              <p className="mt-6 max-w-xl text-sm sm:text-base leading-7 text-stone-400">
                Reflect with Gemini, keep the memories you choose, and return to ideas as they evolve.
              </p>
              <button onClick={signInWithGoogle} disabled={loading} id="google-signin-btn" className="mt-8 h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-semibold transition disabled:opacity-50">
                Continue with Google
              </button>
            </div>
            <div className="rounded-[2rem] border border-stone-800 bg-stone-950 p-5 sm:p-6 shadow-2xl">
              <div className="text-[10px] uppercase tracking-[0.14em] text-stone-600">Inside your Vault</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ['Reflect', 'Multi-turn Gemini dialogue'],
                  ['Remember', 'User-approved memory'],
                  ['Revisit', 'Open loops & threads'],
                  ['Notice', 'Signals and changes'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-xl border border-stone-800 bg-stone-900/50 p-4">
                    <div className="text-sm font-medium text-stone-100">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-stone-500">{body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100">
      <header className="h-16 border-b border-stone-800 bg-stone-950/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => navigate('home')} className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center"><Shield className="w-4 h-4" /></div>
              <span className="font-serif text-lg hidden sm:inline">Gemini Vault</span>
            </button>
            <nav className="hidden md:flex items-center gap-1 ml-3">
              {([
                ['home', Home, 'Reflect'],
                ['vault', Vault, 'Vault'],
                ['intelligence', Brain, 'Intelligence'],
              ] as const).map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    !activeSessionId && view === key
                      ? 'bg-stone-800 text-stone-100'
                      : 'text-stone-500 hover:text-stone-200 hover:bg-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-stone-600"><Search className="w-3 h-3" /> Private workspace</div>
            <div className="w-7 h-7 rounded-full bg-rose-500/80 text-white text-[10px] flex items-center justify-center">{(user.displayName || user.email || 'U').slice(0,1).toUpperCase()}</div>
            {signOutUser && (
              <button
                type="button"
                id="header-signout-btn"
                onClick={() => { void signOutUser(); }}
                className="flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-2.5 sm:px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100 hover:border-stone-700 transition cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {navigationError && (
        <div className="fixed top-[4.5rem] right-4 z-[100] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-rose-800/70 bg-rose-950/90 px-4 py-3 text-xs text-rose-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Something went wrong</div>
              <div className="mt-1 text-rose-300/90">{navigationError}</div>
            </div>
            <button type="button" onClick={() => setNavigationError(null)} className="text-rose-400 hover:text-rose-100" aria-label="Dismiss error">×</button>
          </div>
        </div>
      )}

      <main className="min-h-[calc(100vh-4rem)]">
        {activeSessionId ? (
          <JournalSessionView
            key={activeSessionId}
            sessionId={activeSessionId}
            onBack={handleBackFromSession}
            onContinueSession={continueSession}
            initialPrompt={initialPromptForSession}
          />
        ) : view === 'vault' ? (
          <VaultDashboard onOpenSession={openSession} onContinueSession={continueSession} />
        ) : view === 'intelligence' ? (
          <IntelligenceDashboard onOpenSession={openSession} />
        ) : (
          <JournalHome
            onStartNewSession={startSession}
            onResumeSession={openSession}
            onContinueSession={continueSession}
            isCreating={isCreatingSession}
          />
        )}
      </main>
    </div>
  );
}