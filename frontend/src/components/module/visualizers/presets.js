// ─────────────────────────────────────────────────────────────────────────────
// Exam question → visualizer preset.
//
// When a student gets a question wrong, the review card offers to replay it in
// the module's visualizer. That only works if we can recover the concrete
// values the question was built from, so each supported module gets a reader
// that pulls them back out of the prompt.
//
// Returning null is the ordinary "no button for this one" answer: the caller
// hides the affordance rather than opening a visualizer with nothing in it.
//
// Readers are keyed by the module's VISUALIZER TYPE, not its id, so every
// module sharing a visualizer gets the replay affordance for free — the reader
// only has to recover values that visualizer can actually display.
// ─────────────────────────────────────────────────────────────────────────────

import { getModuleContent } from '../../../data/moduleContent';

const ASSIGNED_STRING = /(\w+)\s*=\s*(["'])(.*?)\2/;

// A string literal measured in place, e.g. `print(len("banana"))`. These
// questions never name a variable, so ASSIGNED_STRING cannot see them.
const LEN_LITERAL = /len\(\s*(["'])(.*?)\1\s*\)/;

// The value of a numeric assignment the prompt made earlier, e.g. "i = 3".
function assignedInt(prompt, name) {
  const match = prompt.match(new RegExp(`\\b${name}\\s*=\\s*(-?\\d+)\\b`));
  return match ? Number(match[1]) : null;
}

// The expression inside `name[...]`, e.g. "text[-1]" → "-1". Without a name,
// the first pair of brackets anywhere wins, which is what option strings want.
function bracketToken(source, name) {
  const pattern = name ? `\\b${name}\\s*\\[([^\\]]*)\\]` : `\\[([^\\]]*)\\]`;
  const match = source.match(new RegExp(pattern));
  return match ? match[1] : null;
}

// Turn that expression into a number: a literal, `len(s)`, or a variable the
// prompt assigned earlier. Anything else is out of scope and yields null.
function resolveIndex(token, prompt, text) {
  const trimmed = (token ?? '').trim();
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^len\(\s*\w+\s*\)$/.test(trimmed)) return text.length; // the off-by-one trap
  if (/^\w+$/.test(trimmed)) return assignedInt(prompt, trimmed);
  return null;
}

function indexingPreset(exercise, answer) {
  const prompt = exercise.prompt ?? '';
  const declared = prompt.match(ASSIGNED_STRING);

  // A `len("word")` question has no variable to index, but it is the classic
  // off-by-one trap: replaying it at index len shows the IndexError that
  // proves len is a count, not a last index.
  if (!declared) {
    const measured = prompt.match(LEN_LITERAL);
    const literal = measured?.[2];
    return literal ? { text: literal, index: literal.length } : null;
  }

  const [, varName, , text] = declared;
  if (!text) return null;

  // "Select all the indices that raise an IndexError" lists whole expressions.
  // Replay the first one the student judged wrongly: that is the misconception
  // actually worth watching, not the ones they already had right.
  if (exercise.type === 'select_all') {
    const correct = exercise.answers ?? [];
    const chosen = answer?.selected ?? [];
    const misjudged = (exercise.options ?? []).find(
      (option) => correct.includes(option) !== chosen.includes(option),
    );
    if (!misjudged) return null;
    const index = resolveIndex(bracketToken(misjudged), prompt, text);
    return index === null ? null : { text, index };
  }

  // A fill-in-the-blank hides the index behind `__`, so the marked answer is it.
  if (exercise.type === 'fill_blank') {
    const index = resolveIndex(exercise.answer, prompt, text);
    return index === null ? null : { text, index };
  }

  const index = resolveIndex(bracketToken(prompt, varName), prompt, text);
  return index === null ? null : { text, index };
}

// ─── slicing ─────────────────────────────────────────────────────────────────

// Split "7:12" / "::-1" / "4:" into the three dials the Slice Machine drives.
// Anything that is not a slice expression (a bare index, a method call) is out
// of scope: the visualizer has nowhere to put it.
function sliceDials(token) {
  if (token === null || token === undefined) return null;
  const trimmed = token.trim();
  if (!trimmed.includes(':')) return null;

  const parts = trimmed.split(':');
  if (parts.length > 3) return null;

  const [start = '', stop = '', step = ''] = parts.map((p) => p.trim());
  const usable = (p) => p === '' || /^-?\d+$/.test(p);
  if (![start, stop, step].every(usable)) return null;

  return { start, stop, step };
}

function slicingPreset(exercise, answer) {
  const prompt = exercise.prompt ?? '';
  const declared = prompt.match(ASSIGNED_STRING);
  if (!declared) return null;

  const [, varName, , text] = declared;
  if (!text) return null;

  // "Select all the expressions that produce X" lists whole slice expressions.
  // Replay the first one the student judged wrongly — the misconception that
  // actually needs watching, not the ones they already had right.
  if (exercise.type === 'select_all') {
    const correct = exercise.answers ?? [];
    const chosen = answer?.selected ?? [];
    const misjudged = (exercise.options ?? []).find(
      (option) => correct.includes(option) !== chosen.includes(option),
    );
    if (!misjudged) return null;
    const dials = sliceDials(bracketToken(misjudged));
    return dials ? { text, ...dials } : null;
  }

  // A fill-in-the-blank hides one dial behind `__`; the marked answer is it.
  const raw = bracketToken(prompt, varName);
  if (raw === null) return null;
  const filled = exercise.type === 'fill_blank'
    ? raw.replace('__', String(exercise.answer ?? '').trim())
    : raw;

  const dials = sliceDials(filled);
  return dials ? { text, ...dials } : null;
}

// Keyed by visualizer type — see the header note.
const READERS = {
  indexing: indexingPreset,
  slicing: slicingPreset,
};

// `answer` is the student's own attempt; some readers need it to pick which
// part of a multi-part question to replay.
export function presetForExercise(exercise, answer) {
  if (!exercise) return null;
  const type = getModuleContent(exercise.module_id)?.visualizer?.type;
  const read = type ? READERS[type] : null;
  return read ? read(exercise, answer) : null;
}
