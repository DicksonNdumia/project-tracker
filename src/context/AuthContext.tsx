import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  auth,
  browserPopupRedirectResolver,
  firebaseAuthDomain,
  googleAuthProvider,
} from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { UserProfile, UserSettings } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  settings: UserSettings | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  authErrorCode: string | null;
  networkHint: string | null;
  theme: 'light' | 'dark';
  setTheme: (next: 'light' | 'dark') => void;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  resetServiceWorkersAndReload: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractFirebaseErrorCode(err: unknown): string | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  const msg = err instanceof Error ? err.message : '';
  const match = msg.match(/\((auth\/[^)]+)\)/);
  return match ? match[1] : null;
}

async function diagnoseAuthNetworkFailure(): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Your browser reports being offline. Check your internet connection and retry.';
  }

  const probes: Array<{ label: string; url: string }> = [
    { label: 'Google API script (apis.google.com)', url: 'https://apis.google.com/js/api.js' },
    {
      label: `Firebase Auth iframe (${firebaseAuthDomain})`,
      url: `https://${firebaseAuthDomain}/__/auth/iframe`,
    },
    {
      label: 'Firebase Identity Toolkit',
      url: 'https://identitytoolkit.googleapis.com/',
    },
  ];

  const blocked: string[] = [];
  await Promise.all(
    probes.map(async ({ label, url }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      } catch {
        blocked.push(label);
      } finally {
        clearTimeout(timer);
      }
    })
  );

  if (blocked.length > 0) {
    return `Could not reach ${blocked.join(', ')}. Check if an adblocker, Brave Shields, VPN, or browser third-party cookie/tracking protection is blocking Firebase Auth.`;
  }

  return 'The Firebase Auth popup handshake timed out or was blocked by browser third-party storage/iframe restrictions. Try disabling tracking shields for this site, clearing cached service workers, or opening the app in a new tab.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [networkHint, setNetworkHint] = useState<string | null>(null);
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');

  const applyThemeClass = (mode: 'light' | 'dark') => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const data = await apiFetch<{ user: UserProfile; settings: UserSettings }>(
        '/api/settings/profile'
      );
      setProfile(data.user);
      setSettings(data.settings);
      if (data.user?.theme === 'light' || data.user?.theme === 'dark') {
        setThemeState(data.user.theme);
        applyThemeClass(data.user.theme);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      const code = extractFirebaseErrorCode(err);
      if (code) {
        setAuthErrorCode(code);
        setAuthError(err instanceof Error ? err.message : 'Redirect sign-in failed.');
      }
    });

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setAuthError(null);
        setAuthErrorCode(null);
        setNetworkHint(null);
        await refreshProfile();
      } else {
        setProfile(null);
        setSettings(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    setAuthErrorCode(null);
    setNetworkHint(null);

    try {
      await signInWithPopup(auth, googleAuthProvider, browserPopupRedirectResolver);
    } catch (firstErr: unknown) {
      const firstCode = extractFirebaseErrorCode(firstErr);
      if (firstCode === 'auth/network-request-failed') {
        // Retry once after a short delay to overcome cold-start 5s iframe ping timeouts
        await new Promise((r) => setTimeout(r, 400));
        try {
          await signInWithPopup(auth, googleAuthProvider, browserPopupRedirectResolver);
          return;
        } catch (retryErr: unknown) {
          const retryCode = extractFirebaseErrorCode(retryErr);
          const msg = retryErr instanceof Error ? retryErr.message : 'Sign-in failed.';
          setAuthErrorCode(retryCode);
          setAuthError(msg);
          if (retryCode === 'auth/network-request-failed') {
            const hint = await diagnoseAuthNetworkFailure();
            setNetworkHint(hint);
          }
          return;
        }
      }

      const msg = firstErr instanceof Error ? firstErr.message : 'Sign-in failed.';
      setAuthErrorCode(firstCode);
      setAuthError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithGoogleRedirect = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    setAuthErrorCode(null);
    setNetworkHint(null);
    try {
      await signInWithRedirect(auth, googleAuthProvider, browserPopupRedirectResolver);
    } catch (err: unknown) {
      const code = extractFirebaseErrorCode(err);
      const msg = err instanceof Error ? err.message : 'Redirect sign-in failed.';
      setAuthErrorCode(code);
      setAuthError(msg);
      if (code === 'auth/network-request-failed') {
        const hint = await diagnoseAuthNetworkFailure();
        setNetworkHint(hint);
      }
      setSigningIn(false);
    }
  };

  const resetServiceWorkersAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore cleanup failures and reload
    }
    window.location.reload();
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setSettings(null);
  };

  const setTheme = async (next: 'light' | 'dark') => {
    setThemeState(next);
    applyThemeClass(next);
    if (auth.currentUser) {
      try {
        const data = await apiFetch<{ user: UserProfile }>('/api/settings/profile', {
          method: 'PATCH',
          body: JSON.stringify({ theme: next }),
        });
        setProfile(data.user);
      } catch {
        // ignore theme sync error
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        settings,
        loading,
        signingIn,
        authError,
        authErrorCode,
        networkHint,
        theme,
        setTheme,
        signInWithGoogle,
        signInWithGoogleRedirect,
        resetServiceWorkersAndReload,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
