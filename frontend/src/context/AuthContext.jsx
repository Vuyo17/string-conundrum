import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import { getApiUrl } from '../config/api';

const AuthContext = createContext(null);
const GUEST_SCREENS = ['Visualiser', 'Code Space', 'Docs', 'Settings'];

// Guests sign in via a backend-minted custom token (see /api/auth/guest),
// not signInAnonymously() — that needs the "Anonymous" provider switched on
// in the Firebase console, which it isn't for this project. A custom-token
// session doesn't get Firebase's built-in `isAnonymous` flag the way an
// anonymous one would, so a guest is recognised by its uid prefix instead.
function isGuestUser(u) {
  return Boolean(u?.isAnonymous || u?.uid?.startsWith('guest-'));
}

// Firebase requires the address back on the device that opens the sign-in link.
const EMAIL_STORAGE_KEY = 'stringConundrum.signUpEmail';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Read once, before any sign-in can happen: opening a sign-in link signs the
  // student in immediately, and App must keep showing the auth flow until they
  // have finished choosing a password.
  const [emailLinkPending, setEmailLinkPending] = useState(
    () => isSignInWithEmailLink(auth, window.location.href),
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    user,
    loading,
    emailLinkPending,
    isGuest: isGuestUser(user),
    isAuthed: Boolean(user),

    signup: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    signOut: () => signOut(auth),

    canAccess: (screen) => {
      if (!user) return false;
      if (!isGuestUser(user)) return true;
      return GUEST_SCREENS.includes(screen);
    },

    continueAsGuest: async () => {
      const res = await fetch(getApiUrl('/api/auth/guest'), { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.token) {
        throw new Error('Could not start a guest session.');
      }
      return signInWithCustomToken(auth, data.token);
    },

    sendSignUpLink: async (email) => {
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.origin,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    },
    storedSignUpEmail: () => window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? '',
    completeSignUpLink: async (email) => {
      const credential = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      return credential;
    },
    setAccountPassword: (password) => updatePassword(auth.currentUser, password),

    // Clears the link out of the address bar and hands control back to the app.
    finishEmailLinkFlow: () => {
      window.history.replaceState({}, document.title, window.location.pathname);
      setEmailLinkPending(false);
    },

    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
