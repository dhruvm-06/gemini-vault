import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { JournalHome } from './components/JournalHome';
import { JournalSessionView } from './components/JournalSessionView';
import { VaultDashboard } from './components/VaultDashboard';
import { IntelligenceDashboard } from './components/IntelligenceDashboard';
import { AppShell } from './components/AppShell';
import { LandingPage } from './components/LandingPage';
import { AppView } from './types';

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
      <div className="min-h-screen bg-[var(--gv-surface-ground)] text-[var(--gv-text-primary)] flex items-center justify-center transition-colors duration-200">
        <div className="text-center">
          <Shield className="w-7 h-7 text-[var(--gv-accent)] mx-auto animate-pulse" />
          <h2 className="mt-4 text-lg font-serif">Opening Gemini Vault</h2>
          <p className="mt-1 text-xs text-[var(--gv-text-tertiary)]">Authenticating your private space…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage
        onSignIn={signInWithGoogle}
        loading={loading}
        error={error}
        onClearError={clearError}
      />
    );
  }

  return (
    <AppShell
      currentView={view}
      onNavigate={navigate}
      activeSessionId={activeSessionId}
      user={user}
      onSignOut={signOutUser}
      navigationError={navigationError}
      onDismissError={() => setNavigationError(null)}
    >
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
    </AppShell>
  );
}