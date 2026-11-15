import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import { UserProfile, UserSettings } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  settings: UserSettings | null;
  loading: boolean;
  authError: string | null;
  theme: 'light' | 'dark';
  setTheme: (next: 'light' | 'dark') => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
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
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      setAuthError(msg);
    }
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
        authError,
        theme,
        setTheme,
        signInWithGoogle,
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
