import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile,
  signInWithCredential, GoogleAuthProvider,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const AuthContext = createContext(null);

// Inside an installed PWA (iOS standalone especially) signInWithPopup is
// unreliable — the popup opens in a detached context and the signed-in
// session never makes it back to the app. A full-page redirect does.
function isStandalonePWA() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.navigator.standalone === true
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Complete a pending redirect sign-in (the PWA Google flow). Resolves
    // to null when there's nothing pending — harmless.
    getRedirectResult(auth).catch((e) => console.warn('auth redirect result:', e?.message));
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Email/password signup. Display name is attached via updateProfile so
  // HomePage's barber-doc seed picks it up as the default businessName.
  async function signupEmail(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      try { await updateProfile(cred.user, { displayName }); } catch {}
    }
    return cred;
  }

  // Sign in to Firebase using a Google ID token obtained directly via
  // Google Identity Services (GIS). This is the path that actually works
  // inside an iOS PWA — signInWithRedirect doesn't return to the PWA
  // because iOS opens the OAuth callback in Safari, not in the home-screen
  // app, leaving the PWA forever logged out.
  async function loginGoogleCredential(idToken) {
    if (!idToken) throw new Error('Missing Google ID token');
    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(auth, credential);
  }

  const value = {
    user,
    loading,
    loginGoogle: () => (isStandalonePWA()
      ? signInWithRedirect(auth, googleProvider)
      : signInWithPopup(auth, googleProvider)),
    loginGoogleCredential,
    loginEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signupEmail,
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    logout: () => signOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
