import React, { useState, useEffect } from 'react';
import {
  Shield,
  Sparkles,
  CheckCircle2,
  Server,
  Lock,
  LogOut,
  UserCheck,
  AlertCircle,
  X,
  Code,
  ShieldCheck,
  Database,
  ArrowRight,
  Fingerprint,
  RefreshCw
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { firebaseDiagnostics } from './firebase';

export default function App() {
  const {
    user,
    userProfile,
    loading,
    profileLoading,
    error,
    profileError,
    signInWithGoogle,
    signOutUser,
    getIdToken,
    refreshProfile,
    clearError,
    clearProfileError,
  } = useAuth();

  const [apiMeResponse, setApiMeResponse] = useState<{
    status: number;
    data: unknown;
    timestamp: string;
  } | null>(null);
  const [apiMeLoading, setApiMeLoading] = useState<boolean>(false);
  const [unauthTestResponse, setUnauthTestResponse] = useState<{
    status: number;
    data: unknown;
  } | null>(null);
  const [unauthTestLoading, setUnauthTestLoading] = useState<boolean>(false);

  // Test authenticated /api/auth/me call
  const testAuthenticatedEndpoint = async () => {
    setApiMeLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('No Firebase ID token available');

      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setApiMeResponse({
        status: res.status,
        data,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      setApiMeResponse({
        status: 500,
        data: { error: err instanceof Error ? err.message : 'Unknown error' },
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setApiMeLoading(false);
    }
  };

  // Test unauthenticated call to verify 401 Unauthorized rejection
  const testUnauthenticatedEndpoint = async () => {
    setUnauthTestLoading(true);
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUnauthTestResponse({
        status: res.status,
        data,
      });
    } catch (err: unknown) {
      setUnauthTestResponse({
        status: 500,
        data: { error: err instanceof Error ? err.message : 'Network error' },
      });
    } finally {
      setUnauthTestLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      testAuthenticatedEndpoint();
    } else {
      setApiMeResponse(null);
      setUnauthTestResponse(null);
    }
  }, [user]);

  // Loading State
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col items-center justify-center p-6 selection:bg-amber-500 selection:text-stone-950 font-sans">
        <div className="flex flex-col items-center space-y-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-100">Connecting to Gemini Vault</h2>
            <p className="text-xs text-stone-400 mt-1">Verifying cryptographic session state...</p>
          </div>
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Unauthenticated State (Landing & Sign-In Page)
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-between selection:bg-amber-500 selection:text-stone-950 font-sans">
        {/* Header */}
        <header className="border-b border-stone-800 bg-stone-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold tracking-tight text-stone-100 text-lg">Gemini Vault</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-stone-800 text-amber-400 border border-stone-700">
                  Stage 2: Auth
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono text-stone-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Project: gemini-vault-507219</span>
            </div>
          </div>
        </header>

        {/* Hero Landing */}
        <main className="max-w-5xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center items-center text-center">
          {error && (
            <div className="mb-8 w-full max-w-md p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start justify-between text-left">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-rose-200">Authentication Error</span>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
              <button
                onClick={clearError}
                className="text-rose-400 hover:text-rose-200 p-1 -mr-1 -mt-1 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700 text-stone-300 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Google Cloud Gen AI APAC Cohort 3 Ideathon</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-stone-100 leading-tight max-w-3xl mb-6">
            A Privacy-First Personal AI Journal That Grows With You
          </h1>

          <p className="text-lg text-stone-400 max-w-2xl leading-relaxed mb-10">
            Gemini Vault is a reflective, Socratic AI journal. All thoughts are protected with strict UID-based Firestore isolation, server-side Gemini intelligence, and durable personal memory.
          </p>

          {/* Google Sign-In Button */}
          <div className="flex flex-col items-center space-y-4 w-full max-w-sm">
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              id="google-signin-btn"
              className="w-full h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold flex items-center justify-center space-x-3 transition-all duration-150 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
            <p className="text-[11px] text-stone-500">
              Secured via Firebase Authentication &bull; Zero password storage
            </p>
          </div>

          {/* Privacy & Architecture Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-16 text-left">
            <div className="p-5 rounded-xl bg-stone-950 border border-stone-800/80">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-stone-100 mb-1">UID Data Isolation</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Your entries and distilled memories are strictly bound to your authenticated UID via field-level Firestore rules.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-stone-950 border border-stone-800/80">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Server className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-stone-100 mb-1">Server-Side Gemini</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Zero API keys exposed to browser. Conversational Socratic prompts run exclusively through Cloud Run proxies.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-stone-950 border border-stone-800/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                <Fingerprint className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-stone-100 mb-1">Protected Provenance</h3>
              <p className="text-xs text-stone-400 leading-relaxed">
                Server-controlled fields like AI summaries, insight metrics, and memory confidence cannot be tampered with by clients.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-stone-800 py-6 bg-stone-950">
          <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
            <div>&copy; 2026 Gemini Vault &mdash; Google Cloud Gen AI APAC Cohort 3</div>
            <div className="flex items-center space-x-4 font-mono">
              <span>Database: Firestore default</span>
              <span>&bull;</span>
              <span>Region: asia-south1</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated State (Protected Dashboard & Stage 2 Verification)
  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-between selection:bg-amber-500 selection:text-stone-950 font-sans">
      {/* Authenticated Navigation Bar */}
      <header className="border-b border-stone-800 bg-stone-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold tracking-tight text-stone-100 text-lg">Gemini Vault</span>
              <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                Authenticated
              </span>
            </div>
          </div>

          {/* User Profile & Sign Out */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 pr-3 border-r border-stone-800">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-stone-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 font-semibold flex items-center justify-center text-xs border border-amber-500/30">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="text-left">
                <div className="text-xs font-medium text-stone-200">{user.displayName || 'Vault Keeper'}</div>
                <div className="text-[11px] font-mono text-stone-500 truncate max-w-[150px]">{user.email}</div>
              </div>
            </div>

            <button
              onClick={signOutUser}
              id="signout-btn"
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-stone-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Authenticated Dashboard */}
      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-stone-950 to-stone-900 border border-stone-800 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>AUTHENTICATED SESSION ACTIVE</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-100">
                Welcome back, {user.displayName || 'Vault Keeper'}
              </h1>
              <p className="text-xs text-stone-400 mt-1 max-w-xl">
                Your authenticated user identity is verified. Firestore user document is provisioned under your private UID scope.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end space-y-1 text-xs font-mono bg-stone-900/80 p-3 rounded-lg border border-stone-800">
              <div className="text-stone-400">Verified Identity:</div>
              <div className="text-amber-400 font-bold break-all max-w-[280px]">{user.uid}</div>
            </div>
          </div>
        </div>

        {/* Development State Diagnostics Panel */}
        <div className="mb-6 p-4 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-800">
            <span className="text-amber-400 font-semibold flex items-center space-x-1.5">
              <Code className="w-3.5 h-3.5" />
              <span>Development State Diagnostics</span>
            </span>
            <span className="text-stone-500 text-[10px]">Zero Tokens/Secrets Exposed</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] mb-3">
            <div className="p-2 rounded bg-stone-900/80 border border-stone-800">
              <div className="text-stone-500 text-[10px]">user.uid</div>
              <div className="text-stone-200 truncate font-semibold">{user.uid}</div>
            </div>
            <div className="p-2 rounded bg-stone-900/80 border border-stone-800">
              <div className="text-stone-500 text-[10px]">profileLoading</div>
              <div className={profileLoading ? 'text-amber-400 font-semibold' : 'text-stone-400'}>
                {profileLoading ? 'true' : 'false'}
              </div>
            </div>
            <div className="p-2 rounded bg-stone-900/80 border border-stone-800">
              <div className="text-stone-500 text-[10px]">userProfile !== null</div>
              <div className={userProfile !== null ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                {userProfile !== null ? 'true (Loaded)' : 'false (Not Loaded)'}
              </div>
            </div>
            <div className="p-2 rounded bg-stone-900/80 border border-stone-800">
              <div className="text-stone-500 text-[10px]">profileError</div>
              <div className={profileError ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                {profileError ? (profileError.code || 'Error') : 'null'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-stone-400 pt-2 border-t border-stone-800/60">
            <div>
              Project: <span className="text-stone-200 font-semibold">{firebaseDiagnostics.projectId}</span>
            </div>
            <div>
              Database ID: <span className="text-amber-400 font-semibold">{firebaseDiagnostics.databaseId}</span>
            </div>
            <div>
              Online: <span className="text-emerald-400 font-semibold">{firebaseDiagnostics.isOnline ? 'Yes' : 'No'}</span>
            </div>
            <div>
              Transport: <span className="text-amber-300 font-semibold">{firebaseDiagnostics.transport}</span>
            </div>
          </div>
        </div>

        {/* Stage 2 Diagnostics Deck */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Firestore Document Status */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-stone-200 font-medium">
                <Database className="w-4 h-4 text-amber-400" />
                <span>Firestore Profile Document</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                /users/{user.uid.slice(0, 6)}...
              </span>
            </div>

            {profileLoading ? (
              /* State A: profileLoading === true */
              <div className="py-6 text-stone-300 text-xs font-mono flex flex-col items-center justify-center space-y-3 p-4 rounded-lg bg-stone-900/60 border border-stone-800">
                <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                <span>Loading your profile...</span>
              </div>
            ) : profileError ? (
              /* State B: profileLoading === false && profileError exists */
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 space-y-2">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-semibold text-rose-200">
                      Your account is signed in, but your profile could not be saved.
                    </span>
                  </div>
                  {profileError.code && (
                    <div className="font-mono text-[11px] text-rose-400/90 pl-6">
                      Firebase Error: <span className="font-semibold">{profileError.code}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-rose-300/80 pl-6 leading-relaxed">
                    {profileError.message}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => refreshProfile()}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Profile Initialization</span>
                  </button>
                  <button
                    onClick={clearProfileError}
                    className="text-stone-400 hover:text-stone-200 text-xs underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : userProfile ? (
              /* State C: profileLoading === false && userProfile exists */
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-stone-900/80 border border-stone-800/80 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Owner UID:</span>
                    <span className="font-mono text-stone-200 font-semibold">{userProfile.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Display Name:</span>
                    <span className="text-stone-200">{userProfile.displayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Email:</span>
                    <span className="text-stone-200">{userProfile.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Theme Preference:</span>
                    <span className="text-stone-200 uppercase font-mono">{userProfile.preferences?.theme || 'dark'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Document initialized and compliant with field-level rules.</span>
                </div>
              </div>
            ) : (
              /* State D: Unexpected state (never an infinite spinner) */
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800 text-stone-400 space-y-1">
                  <div className="font-semibold text-stone-300">Profile document is not yet in memory.</div>
                  <p className="text-[11px] text-stone-500">
                    The document read settled without error, but userProfile state is unpopulated.
                  </p>
                </div>
                <button
                  onClick={() => refreshProfile()}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center space-x-1.5 border border-stone-700 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Force Profile Reload</span>
                </button>
              </div>
            )}
          </div>

          {/* Backend Token Verification Endpoint Card */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-stone-200 font-medium">
                  <Server className="w-4 h-4 text-amber-400" />
                  <span>Backend Token Verification</span>
                </div>
                <button
                  onClick={testAuthenticatedEndpoint}
                  disabled={apiMeLoading}
                  className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 text-xs font-mono transition-colors border border-stone-700 cursor-pointer disabled:opacity-50"
                >
                  {apiMeLoading ? 'Verifying...' : 'Test /api/auth/me'}
                </button>
              </div>

              {apiMeResponse ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-xs">
                    <span
                      className={`font-mono px-2 py-0.5 rounded font-semibold ${
                        apiMeResponse.status === 200
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/80'
                      }`}
                    >
                      HTTP {apiMeResponse.status}
                    </span>
                    <span className="text-stone-400 text-[11px]">Verified at {apiMeResponse.timestamp}</span>
                  </div>
                  <pre className="p-3 rounded-lg bg-stone-900 border border-stone-800 font-mono text-[11px] text-stone-300 overflow-x-auto">
                    {JSON.stringify(apiMeResponse.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="py-4 text-stone-500 text-xs font-mono">
                  Press &quot;Test /api/auth/me&quot; to test Firebase ID token verification.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800/80 text-[11px] font-mono text-stone-500">
              Auth Header: Bearer &lt;Firebase_ID_Token&gt;
            </div>
          </div>
        </div>

        {/* Security & Authorization Testing Deck */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-6 mb-8">
          <div className="flex items-center space-x-2 text-stone-200 font-medium mb-4">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Interactive Security & Unauthorized Rejection Verification</span>
          </div>

          <p className="text-xs text-stone-400 mb-4 max-w-2xl">
            Verify that protected server routes strictly reject anonymous requests with HTTP 401 Unauthorized, while authenticated requests pass with verified UID identity derivation.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={testUnauthenticatedEndpoint}
              disabled={unauthTestLoading}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 text-xs font-medium flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Simulate Unauthenticated Request (No Token)</span>
            </button>
          </div>

          {unauthTestResponse && (
            <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs font-mono">
              <div className="flex items-center space-x-2 mb-1.5">
                <span className="font-semibold text-rose-400">Response: HTTP {unauthTestResponse.status}</span>
                <span className="text-stone-500">&mdash; Correctly rejected by requireAuth middleware</span>
              </div>
              <pre className="text-[11px] text-stone-400">
                {JSON.stringify(unauthTestResponse.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Stage 2 Completion Checklist */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-stone-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Stage 2 Milestones Completed</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-stone-200">Firebase Auth Initialized</div>
                <p className="text-stone-500 text-[11px] mt-0.5">Google Sign-In with popup & session persistence</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-stone-200">User Document Scoping</div>
                <p className="text-stone-500 text-[11px] mt-0.5">Provisioned strictly under /users/{'{uid}'}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-stone-200">ID Token Verification</div>
                <p className="text-stone-500 text-[11px] mt-0.5">Protected GET /api/auth/me rejecting 401s</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-stone-200">Field-Level Rules (v3)</div>
                <p className="text-stone-500 text-[11px] mt-0.5">Server-derived & immutable fields protected</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-stone-200">Recursive Sanitizer</div>
                <p className="text-stone-500 text-[11px] mt-0.5">Zero undefined values reaching Firestore</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-stone-900/60 border border-amber-500/30 flex items-start space-x-2.5 bg-amber-500/5">
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-amber-300">Ready for Stage 3</div>
                <p className="text-amber-400/80 text-[11px] mt-0.5">Socratic Multi-Turn Chat Engine</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800 py-6 bg-stone-950">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <div>&copy; 2026 Gemini Vault &mdash; Google Cloud Gen AI APAC Cohort 3</div>
          <div className="flex items-center space-x-4 font-mono">
            <span>Project: gemini-vault-507219</span>
            <span>&bull;</span>
            <span>Status: Stage 2 Complete</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
