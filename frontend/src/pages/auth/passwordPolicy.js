// Rules carry translation keys rather than labels; the indicator resolves them
// so the checklist and strength wording follow the active language.

export const PASSWORD_RULES = [
  { id: 'length', labelKey: 'auth.ruleLength', test: (v) => v.length >= 8 },
  { id: 'uppercase', labelKey: 'auth.ruleUppercase', test: (v) => /[A-Z]/.test(v) },
  { id: 'number', labelKey: 'auth.ruleNumber', test: (v) => /\d/.test(v) },
  { id: 'special', labelKey: 'auth.ruleSpecial', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

// Indexed by score, so this must stay one entry longer than PASSWORD_RULES.
export const STRENGTH_LABEL_KEYS = [
  'auth.strengthTooWeak',
  'auth.strengthWeak',
  'auth.strengthFair',
  'auth.strengthGood',
  'auth.strengthStrong',
];

export function passwordScore(value) {
  return PASSWORD_RULES.filter((rule) => rule.test(value)).length;
}

export function meetsPolicy(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
