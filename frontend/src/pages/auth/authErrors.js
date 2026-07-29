// Firebase error codes are developer-facing. Everything a student can trigger
// maps to a translation key here; anything unmapped falls back to a calm
// generic line rather than leaking "FirebaseError: auth/...".
//
// These helpers return keys, not sentences, so callers can hold the key in
// state and translate it at render time — a message already on screen then
// follows the language toggle instead of freezing in the language it was
// raised in.

const MESSAGE_KEYS = {
  'auth/invalid-email': 'auth.errors.invalidEmail',
  'auth/missing-email': 'auth.errors.missingEmail',
  'auth/user-not-found': 'auth.errors.badCredentials',
  'auth/wrong-password': 'auth.errors.badCredentials',
  'auth/invalid-credential': 'auth.errors.badCredentials',
  'auth/invalid-login-credentials': 'auth.errors.badCredentials',
  'auth/too-many-requests': 'auth.errors.tooManyRequests',
  'auth/network-request-failed': 'auth.errors.network',
  'auth/email-already-in-use': 'auth.errors.emailInUse',
  'auth/weak-password': 'auth.errors.weakPassword',
  'auth/user-disabled': 'auth.errors.userDisabled',
  'auth/requires-recent-login': 'auth.errors.requiresRecentLogin',
  'auth/invalid-action-code': 'auth.errors.invalidActionCode',
  'auth/expired-action-code': 'auth.errors.expiredActionCode',
  'auth/operation-not-allowed': 'auth.errors.operationNotAllowed',
  'auth/admin-restricted-operation': 'auth.errors.guestDisabled',
};

export function authErrorKey(error) {
  if (!error) return '';
  return MESSAGE_KEYS[error.code] ?? 'auth.errors.generic';
}

export const UCT_DOMAIN = '@myuct.ac.za';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailShape(email) {
  const value = email.trim();
  if (!value) return 'auth.errors.missingEmail';
  if (!EMAIL_SHAPE.test(value)) return 'auth.errors.invalidEmail';
  return '';
}

// Registration is restricted to UCT students; sign-in is not, so that existing
// and guest accounts are never locked out by a later policy change.
export function validateUctEmail(email) {
  const shapeError = validateEmailShape(email);
  if (shapeError) return shapeError;
  if (!email.trim().toLowerCase().endsWith(UCT_DOMAIN)) {
    return 'auth.errors.uctOnly';
  }
  return '';
}
