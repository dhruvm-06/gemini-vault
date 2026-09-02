import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  AuthError,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { UserProfile } from '../types';
import { sanitizeFirestorePayload } from '../utils/sanitize';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  profileError: { code?: string; message: string } | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<UserProfile | null>;
  clearError: () => void;
  clearProfileError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<{ code?: string; message: string } | null>(null);

  const loadUserProfile = async (currentUser: User): Promise<UserProfile | null> => {
    console.log('[AuthContext] loadUserProfile started for UID:', currentUser.uid);
    setProfileLoading(true);
    setProfileError(null);

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      console.log('[AuthContext] Executing getDoc for /users/' + currentUser.uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        const rawData = docSnap.data();
        console.log('[AuthContext] Existing document found. Raw keys:', Object.keys(rawData || {}));
        const profile: UserProfile = {
          id: rawData.id || currentUser.uid,
          email: rawData.email || currentUser.email || '',
          displayName: rawData.displayName || currentUser.displayName || 'Vault Keeper',
          photoURL: rawData.photoURL || currentUser.photoURL || '',
          preferences: rawData.preferences || { theme: 'dark', reflectionReminder: true },
          createdAt: rawData.createdAt,
          lastLoginAt: rawData.lastLoginAt,
        };
        console.log('[AuthContext] Setting userProfile state from existing doc');
        setUserProfile(profile);
        setProfileError(null);
        return profile;
      } else {
        console.log('[AuthContext] No document found. Initializing /users/' + currentUser.uid);
        const initialProfile: UserProfile = {
          id: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Vault Keeper',
          photoURL: currentUser.photoURL || '',
          preferences: { theme: 'dark', reflectionReminder: true },
          createdAt: serverTimestamp(),
        };

        const cleanPayload = sanitizeFirestorePayload(initialProfile);
        await setDoc(userDocRef, cleanPayload);
        console.log('[AuthContext] setDoc completed. Verifying write...');

        const verifySnap = await getDoc(userDocRef);
        const verifiedData = (verifySnap.exists() ? verifySnap.data() : initialProfile) as UserProfile;
        const profile: UserProfile = {
          id: verifiedData.id || currentUser.uid,
          email: verifiedData.email || currentUser.email || '',
          displayName: verifiedData.displayName || currentUser.displayName || 'Vault Keeper',
          photoURL: verifiedData.photoURL || currentUser.photoURL || '',
          preferences: verifiedData.preferences || { theme: 'dark', reflectionReminder: true },
          createdAt: verifiedData.createdAt,
          lastLoginAt: verifiedData.lastLoginAt,
        };
        console.log('[AuthContext] Setting userProfile state from newly created doc');
        setUserProfile(profile);
        setProfileError(null);
        return profile;
      }
    } catch (err: unknown) {
      console.error('[AuthContext] Error in loadUserProfile:', err);
      const fsErr = err as { code?: string; message?: string };
      setUserProfile(null);
      setProfileError({
        code: fsErr?.code || 'firestore/unknown',
        message: fsErr?.message || 'Failed to initialize or load Firestore user profile document.',
      });
      return null;
    } finally {
      console.log('[AuthContext] Setting profileLoading to false');
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('[AuthContext] onAuthStateChanged fired. User:', currentUser ? currentUser.uid : 'null');
      setLoading(true);
      setError(null);

      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
        await loadUserProfile(currentUser);
      } else {
        setUser(null);
        setUserProfile(null);
        setProfileLoading(false);
        setProfileError(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    setProfileError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[AuthContext] signInWithPopup resolved for:', result.user?.uid);
      if (result.user) {
        setUser(result.user);
        await loadUserProfile(result.user);
      }
    } catch (err: unknown) {
      const authErr = err as AuthError;
      console.warn('[AuthContext] Sign in error code:', authErr?.code, authErr?.message);
      if (authErr?.code === 'auth/popup-closed-by-user') {
        setError('Sign-in window was closed. Please try again.');
      } else if (authErr?.code === 'auth/cancelled-popup-request') {
        setError('Sign-in request was cancelled.');
      } else if (authErr?.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site.');
      } else if (authErr?.code === 'auth/network-request-failed') {
        setError('Network error occurred. Please check your internet connection.');
      } else {
        setError(authErr?.message || 'Failed to authenticate with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    setError(null);
    setProfileError(null);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: unknown) {
      const authErr = err as AuthError;
      setError(authErr?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
      setProfileLoading(false);
    }
  };

  const getIdToken = useCallback(
    async (forceRefresh: boolean = false): Promise<string | null> => {
      if (!auth.currentUser) return null;
      try {
        return await auth.currentUser.getIdToken(forceRefresh);
      } catch (err) {
        console.error('[AuthContext] Failed to acquire ID token:', err);
        return null;
      }
    },
    []
  );

  const refreshProfile = async (): Promise<UserProfile | null> => {
    const activeUser = auth.currentUser || user;
    if (activeUser) {
      return await loadUserProfile(activeUser);
    }
    return null;
  };

  const clearError = () => setError(null);
  const clearProfileError = () => setProfileError(null);

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
