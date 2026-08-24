// Shared between PracticeSection.jsx and ExamMode.jsx — both run the same
// question bank through two different flows (one-at-a-time with instant
// feedback vs. answer-everything-then-submit), and used to each carry their
// own copy of this handful of pure helpers. That already cost real bugs:
// the star/stars pluralization fix and the mastery-label i18n fix each had
// to be applied twice, in two files, because nothing forced them to stay in
// sync. Anything here is not specific to either flow — it's shared exactly
// because both files needed the identical behavior, not similar behavior.

// Star value of an exercise. The bank's legacy `xp` field is stars * 10;
// newer questions carry `stars` directly. The UI speaks ONLY in stars.
export function starsOf(exercise) {
  return exercise?.stars ?? Math.max(1, Math.round((exercise?.xp ?? 10) / 10));
}

export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Shuffled index order for an option-bearing exercise's `options` array, so
// the correct answer isn't always in the same position (cycle-1 usability
// feedback). Callers memoize this per question — recomputing it every render
// would shuffle the choices out from under a student mid-click.
//
// Letters (A, B, C...) are assigned strictly by rendered POSITION, never by
// content: index 0 of the returned order is always "A", regardless of which
// original option shuffled into that slot. Grading is unaffected either way
// — it always compares the raw English option VALUE the student clicked,
// never its position or letter.
export function optionOrder(exercise) {
  return shuffle((exercise?.options ?? []).map((_, i) => i));
}

export function splitPrompt(prompt) {
  const [first, ...rest] = prompt.split('\n');
  return { title: first, code: rest.join('\n') };
}

// Text shown for each option, in the student's language. The VALUE used for
// selection state and submission is always `exercise.options[i]` (English) —
// grading compares against that verbatim, so only the label may translate.
// `lang` is required, not optional: keying off "a translation exists" alone
// rendered isiXhosa option labels to English readers, because the API ships
// options_xh alongside the English options in both languages.
export function displayOptionsOf(exercise, lang) {
  const { options, options_xh } = exercise;
  if (lang !== 'xh') return options;
  return options_xh?.length === options.length ? options_xh : options;
}

// A blank answer shape for a fresh question, keyed by exercise type. Guards
// a missing exercise (PracticeSection can call this before its bank has
// loaded) — ExamMode's call sites always pass a real exercise, so the guard
// is simply never hit there, not a behavior change for either caller.
export function defaultAnswer(exercise) {
  if (!exercise) return null;
  if (exercise.type === 'mcq') return { selected: null };
  if (exercise.type === 'select_all') return { selected: [] };
  if (exercise.type === 'fill_blank') return { value: '' };
  if (exercise.type === 'write_code') {
    return { code: exercise.starter_code ?? '# Write your solution here\n' };
  }
  return null;
}
