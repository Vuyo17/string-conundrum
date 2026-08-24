// Python indexing and slicing semantics, shared by the standalone Visualiser
// screen and the per-module Visualize sections so both explain the language
// the same way. Kept free of React so it can be reasoned about (and tested)
// on its own.

export function parseIndexInput(raw) {
  const trimmed = String(raw).trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

// The walk a pointer takes to resolve text[index]: forwards from 0 for a
// positive index, backwards from -1 for a negative one. `valid` is false when
// the index falls outside the string, which is Python's IndexError.
export function buildIndexWalk(text, index) {
  const length = text.length;

  if (index >= 0) {
    const target = Math.min(index, length); // length == first invalid position
    const path = [];
    for (let i = 0; i <= target && i < length; i++) path.push(i);
    return { path, valid: index < length, direction: 'forward' };
  }

  const target = Math.max(index, -length - 1);
  const path = [];
  for (let i = -1; i >= target && i >= -length; i--) path.push(length + i);
  return { path, valid: index >= -length, direction: 'backward' };
}

// Resolve an index to its non-negative position, reporting out-of-range rather
// than clamping — clamping would hide IndexError from the learner.
export function resolveIndex(text, index) {
  const length = text.length;
  const resolved = index < 0 ? length + index : index;
  return { resolved, valid: resolved >= 0 && resolved < length };
}

export function parseSlicePart(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') return { empty: true, value: null, valid: true };
  if (!/^-?\d+$/.test(trimmed)) return { empty: false, value: null, valid: false };
  return { empty: false, value: Number(trimmed), valid: true };
}

export function parseSliceNotation(notation) {
  const parts = String(notation ?? '').split(':');
  return {
    start: parseSlicePart(parts[0]),
    stop: parseSlicePart(parts[1]),
    step: parseSlicePart(parts[2]),
  };
}

// Reproduce Python slice semantics exactly, including the defaults the
// CSC1015F lectures emphasise: with a negative step, start defaults to the
// last character and stop to "before the first".
export function computeSlice(text, startRaw, stopRaw, stepRaw) {
  const length = text.length;
  const step = stepRaw.empty ? 1 : stepRaw.value;
  // `picked`/`step`/`start`/`stop` always present, error case included: every
  // caller reads `.picked` unconditionally for the character grid and output
  // text, and an object with only `{ error }` made `slice.picked.map(...)`
  // throw outright — typing a step of 0 crashed the whole visualiser instead
  // of showing the ValueError Python actually raises for `text[::0]`.
  if (step === 0) {
    return {
      error: 'step cannot be zero (Python raises ValueError)',
      picked: [], step: 0, start: 0, stop: 0,
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const normalise = (v, forNegStepDefault) => {
    if (v === null) return forNegStepDefault;
    return v < 0 ? v + length : v;
  };

  let start;
  let stop;
  // Pre-clamp values, so an out-of-range bound the student actually typed
  // (as opposed to an omitted one quietly taking its default) can be told
  // apart from one that landed in range on its own — Python doesn't error on
  // this the way indexing does, but silently accepting e.g. stop=30 on a
  // 13-character string with no visual sign anything was adjusted still
  // read as "did my input even get used?"
  let normalisedStart = null;
  let normalisedStop = null;
  if (step > 0) {
    normalisedStart = startRaw.empty ? null : normalise(startRaw.value, 0);
    normalisedStop = stopRaw.empty ? null : normalise(stopRaw.value, length);
    start = clamp(normalisedStart ?? 0, 0, length);
    stop = clamp(normalisedStop ?? length, 0, length);
  } else {
    normalisedStart = startRaw.empty ? null : normalise(startRaw.value, null);
    normalisedStop = stopRaw.empty ? null : normalise(stopRaw.value, null);
    start = startRaw.empty ? length - 1 : clamp(normalisedStart, -1, length - 1);
    stop = stopRaw.empty ? -1 : clamp(normalisedStop, -1, length - 1);
  }
  const startClamped = normalisedStart !== null && normalisedStart !== start;
  const stopClamped = normalisedStop !== null && normalisedStop !== stop;

  const picked = [];
  if (step > 0) for (let i = start; i < stop; i += step) picked.push(i);
  else for (let i = start; i > stop; i += step) picked.push(i);

  return { picked, step, start, stop, startClamped, stopClamped };
}

// Convenience wrapper for callers holding a "start:stop:step" string.
export function sliceFromNotation(text, notation) {
  const parts = parseSliceNotation(notation);
  const valid = parts.start.valid && parts.stop.valid && parts.step.valid;
  if (!valid) return { picked: [], step: 1, start: 0, stop: 0, invalid: true };
  return computeSlice(text, parts.start, parts.stop, parts.step);
}
