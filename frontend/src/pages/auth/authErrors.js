// Firebase error codes are developer-facing. Everything a student can trigger
// gets a plain-language message here; anything unmapped falls back to a calm
// generic line rather than leaking "FirebaseError: auth/...".

const MESSAGES = {
  'auth/invalid-email': 'That does not look like a valid email address.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/user-not-found': 'The email or password is incorrect. Please try again.',
  'auth/wrong-password': 'The email or password is incorrect. Please try again.',
  'auth/invalid-credential': 'The email or password is incorrect. Please try again.',
  'auth/invalid-login-credentials': 'The email or password is incorrect. Please try again.',
  'auth/too-many-requests':
    'Too many failed attempts. Wait a few minutes before trying again, or reset your password.',
  'auth/network-request-failed':
    'We could not reach the server. Check your connection and try again.',
  'auth/email-already-in-use':
    'An account already exists for this email address. Try signing in instead.',
  'auth/weak-password': 'That password is too weak. Please choose a stronger one.',
  'auth/user-disabled': 'This account has been disabled. Please contact the site administrator.',
  'auth/requires-recent-login':
    'For your security, please open a fresh link from your email before setting a password.',
  'auth/invalid-action-code':
    'This link is invalid or has already been used. Request a new one to continue.',
  'auth/expired-action-code': 'This link has expired. Request a new one to continue.',
  'auth/operation-not-allowed':
    'This sign-in method is not enabled yet. Please contact the site administrator.',
  'auth/admin-restricted-operation':
    'Guest access is not enabled yet. Please sign in with your UCT email.',
};

export function friendlyAuthError(error) {
  if (!error) return '';
  return MESSAGES[error.code] ?? 'Something went wrong on our side. Please try again in a moment.';
}

export const UCT_DOMAIN = '@myuct.ac.za';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailShape(email) {
  const value = email.trim();
  if (!value) return 'Please enter your email address.';
  if (!EMAIL_SHAPE.test(value)) return 'That does not look like a valid email address.';
  return '';
}

// Registration is restricted to UCT students; sign-in is not, so that existing
// and guest accounts are never locked out by a later policy change.
export function validateUctEmail(email) {
  const shapeError = validateEmailShape(email);
  if (shapeError) return shapeError;
  if (!email.trim().toLowerCase().endsWith(UCT_DOMAIN)) {
    return `Registration is open to UCT students. Please use your ${UCT_DOMAIN} address.`;
  }
  return '';
}
