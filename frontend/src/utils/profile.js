// Display helpers for the signed-in account.
// Firebase users only carry `displayName`, `email` and `isAnonymous`, so every
// screen that shows a person derives the same name and initials from here
// rather than reading fields the user object does not have.

// Accounts are created through the emailed sign-up link, which never asks for a
// name, so `displayName` is usually null and the email local part is all we
// have to work with.
function nameSource(user) {
  const displayName = user?.displayName?.trim();
  if (displayName) return displayName;

  const email = user?.email?.trim();
  if (email) return email.split('@')[0];

  return '';
}

// "vuyo.mkhize" -> ["vuyo", "mkhize"], "Vuyo Mkhize" -> ["Vuyo", "Mkhize"]
function nameParts(user) {
  return nameSource(user)
    .split(/[\s._-]+/)
    .filter(Boolean);
}

export function displayNameFor(user) {
  if (user?.isAnonymous) return 'Guest';

  const parts = nameParts(user);
  if (!parts.length) return 'Student';

  return parts
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function initialsFor(user) {
  if (user?.isAnonymous) return 'G';

  const parts = nameParts(user);
  if (!parts.length) return '?';

  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
