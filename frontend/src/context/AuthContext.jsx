import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../config/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'sc-session';

// Screens a guest is allowed to open.
export const GUEST_SCREENS = ['Visualiser', 'Code Space'];

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable — session just won't persist
    }
  }, [session]);

  async function callAuth(path, body) {
    let res;
    try {
      res = await fetch(getApiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('Cannot reach the server. Check that the backend is running.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }
    return data;
  }

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    isGuest: session?.mode === 'guest',
    isAuthed: Boolean(session),

    async signIn(email, password) {
      const data = await callAuth('/api/auth/login', { email, password });
      setSession({ mode: 'user', token: data.token, user: data.user });
    },

    async signUp(name, email, password) {
      const data = await callAuth('/api/auth/signup', { name, email, password });
      setSession({ mode: 'user', token: data.token, user: data.user });
    },

    continueAsGuest() {
      setSession({ mode: 'guest', user: { name: 'Guest', initials: 'G' } });
    },

    signOut() {
      setSession(null);
    },

    canAccess(screen) {
      if (!session) return false;
      if (session.mode === 'guest') return GUEST_SCREENS.includes(screen);
      return true;
    },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
