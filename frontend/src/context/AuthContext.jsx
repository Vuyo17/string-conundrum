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
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { apiFetch } from '../api';
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
  // 'student' until the backend says otherwise. Used ONLY to decide whether
  // to render the Dashboard nav item -- it is not access control. Every
  // /api/admin route re-checks the role server-side (see require_admin), so
  // a student who patches this in devtools gets a nav item that 403s.
  const [role, setRole] = useState('student');

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

  // Ask the backend who this is. Guests skip it: their uid can never carry a
  // role, and the call would just be one more failed request on a screen that
  // is deliberately offline-tolerant.
  useEffect(() => {
    let cancelled = false;
    if (!user || isGuestUser(user)) {
      setRole('student');
      return undefined;
    }
    apiFetch(getApiUrl('/api/me'))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRole(data?.role ?? 'student');
      })
      // A failure here means no Dashboard item appears, which is the correct
      // way to fail: it withholds a link rather than offering a broken one.
      .catch(() => {
        if (!cancelled) setRole('student');
      });
    return () => { cancelled = true; };
  }, [user]);

  const value = {
    user,
    loading,
    emailLinkPending,
    isGuest: isGuestUser(user),
    isAuthed: Boolean(user),
    role,
    isAdmin: role === 'admin',

    signup: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    signOut: () => signOut(auth),

    canAccess: (screen) => {
      if (!user) return false;
      // The dashboard is the one screen a signed-in account can still be
      // refused, so it is checked before the blanket "signed in means yes".
      if (screen === 'Dashboard') return role === 'admin';
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

    // Username-only entry: no email, no password, no verification mail. The
    // backend derives a stable uid from the name and mints a custom token
    // carrying it as a `name` claim, so the server already knows who this is.
    //
    // updateProfile() is still needed on top of that claim: `displayName` on
    // the client User object is read from the Firebase user record, not from
    // the token, so without this write the UI would fall back to "Student"
    // even though the leaderboard had the right name. Spreading into a plain
    // object is what makes React re-render (see setDisplayName below).
    signInWithUsername: async (username) => {
      const res = await fetch(getApiUrl('/api/auth/username'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.token) {
        throw new Error(data?.error === 'invalid_username'
          ? 'invalid_username'
          : 'Could not start a session.');
      }
      await signInWithCustomToken(auth, data.token);
      await updateProfile(auth.currentUser, { displayName: data.username });
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
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

    // updateProfile() mutates the Firebase User object in place but does not
    // itself trigger onAuthStateChanged, so `user` in context would be stale
    // until the next unrelated auth event. reload() pulls the fresh profile
    // from Firebase, and spreading it into a new plain object (rather than
    // re-passing the same User instance) is what actually gets React to
    // re-render — setState bails out on an identical object reference.
    //
    // The backend's own copy of this name (users.display_name, what the
    // leaderboard actually shows) comes from the `name` claim on whatever ID
    // token a request carries, baked in at token-issue time — apiFetch()
    // reuses the cached token until it's near expiry, so without a forced
    // refresh here the backend wouldn't see the new name for up to an hour.
    // getIdToken(true) fetches a fresh token with the updated claim now, so
    // the very next authenticated request's upsert_user() picks it up.
    setDisplayName: async (name) => {
      await updateProfile(auth.currentUser, { displayName: name });
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      setUser({ ...auth.currentUser });
    },

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
