import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon, CheckCircle2, Play, RotateCcw, Sparkles,
} from 'lucide-react';
import m from '../../../styles/ModulePage.module.css';

const MAX_LENGTH = 14;
const TICK_MS = 460;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function parsePart(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return { empty: true, value: null, valid: true };
  if (!/^-?\d+$/.test(trimmed)) return { empty: false, value: null, valid: false };
  return { empty: false, value: Number(trimmed), valid: true };
}

// Reproduce Python slice semantics exactly, including the defaults the
// CSC1015F lectures emphasise: with a negative step, start defaults to the
// last character and stop to "before the first".
function computeSlice(text, startRaw, stopRaw, stepRaw) {
  const length = text.length;
  const step = stepRaw.empty ? 1 : stepRaw.value;
  if (step === 0) return { error: 'step cannot be zero (Python raises ValueError)' };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const normalise = (v, forNegStepDefault) => {
    if (v === null) return forNegStepDefault;
    return v < 0 ? v + length : v;
  };

  let start;
  let stop;
  if (step > 0) {
    start = clamp(normalise(startRaw.empty ? null : startRaw.value, 0) ?? 0, 0, length);
    stop = clamp(normalise(stopRaw.empty ? null : stopRaw.value, length) ?? length, 0, length);
  } else {
    start = startRaw.empty ? length - 1 : clamp(normalise(startRaw.value, null), -1, length - 1);
    stop = stopRaw.empty ? -1 : clamp(normalise(stopRaw.value, null), -1, length - 1);
  }

  const picked = [];
  if (step > 0) for (let i = start; i < stop; i += step) picked.push(i);
  else for (let i = start; i > stop; i += step) picked.push(i);

  return { picked, step };
}

export function SlicingVisualizer({ config }) {
  const [text, setText] = useState(config.defaults?.text ?? 'Jabberwocky');
  const [startIn, setStartIn] = useState(config.defaults?.start ?? '');
  const [stopIn, setStopIn] = useState(config.defaults?.stop ?? '');
  const [stepIn, setStepIn] = useState(config.defaults?.step ?? '-1');
  const [run, setRun] = useState(null);   // { text, picked, notation, error }
  const [pos, setPos] = useState(-1);     // how many picks are revealed so far
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  const parts = useMemo(() => ({
    start: parsePart(startIn), stop: parsePart(stopIn), step: parsePart(stepIn),
  }), [startIn, stopIn, stepIn]);

  const inputsValid = text.length > 0
    && parts.start.valid && parts.stop.valid && parts.step.valid;

  const notation = `[${startIn.trim()}:${stopIn.trim()}${stepIn.trim() !== '' ? `:${stepIn.trim()}` : ''}]`;

  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function reset() { setRun(null); setPos(-1); setDone(false); stopTimer(); }

  function startRun() {
    if (!inputsValid) return;
    stopTimer();
    const result = computeSlice(text, parts.start, parts.stop, parts.step);
    const nextRun = { text, notation, ...result };
    setRun(nextRun);

    if (result.error || result.picked.length === 0 || prefersReducedMotion()) {
      setPos((result.picked ?? []).length - 1);
      setDone(true);
      return;
    }
    setPos(0);
    setDone(result.picked.length === 1);
  }

  useEffect(() => {
    if (!run || done || run.error) return undefined;
    timerRef.current = setInterval(() => {
      setPos((p) => {
        if (p >= run.picked.length - 1) { stopTimer(); setDone(true); return p; }
        return p + 1;
      });
    }, TICK_MS);
    return stopTimer;
  }, [run, done]);

  useEffect(() => stopTimer, []);

  const chars = (run?.text ?? text).split('');
  const revealed = run && !run.error ? run.picked.slice(0, pos + 1) : [];
  const current = revealed.length > 0 ? revealed[revealed.length - 1] : null;
  const finished = Boolean(run) && done;
  const resultValue = run && !run.error
    ? revealed.map((i) => run.text[i]).join('')
    : '';

  return (
    <div className={m.visualizerCard}>
      <div className={m.visualizerControls}>
        <label className={m.vizField}>
          <span>String</span>
          <input
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => { setText(e.target.value); reset(); }}
            aria-label="String to slice"
          />
        </label>
        <label className={`${m.vizField} ${m.vizFieldNarrow}`}>
          <span>Start</span>
          <input value={startIn} onChange={(e) => { setStartIn(e.target.value); reset(); }} placeholder="0" inputMode="numeric" aria-label="Slice start" />
        </label>
        <label className={`${m.vizField} ${m.vizFieldNarrow}`}>
          <span>Stop</span>
          <input value={stopIn} onChange={(e) => { setStopIn(e.target.value); reset(); }} placeholder="end" inputMode="numeric" aria-label="Slice stop" />
        </label>
        <label className={`${m.vizField} ${m.vizFieldNarrow}`}>
          <span>Step</span>
          <input value={stepIn} onChange={(e) => { setStepIn(e.target.value); reset(); }} placeholder="1" inputMode="numeric" aria-label="Slice step" />
        </label>
        <button type="button" className={m.solidButton} onClick={startRun} disabled={!inputsValid}>
          {finished ? <RotateCcw size={16} /> : <Play size={16} />}
          {finished ? 'Replay' : 'Visualize'}
        </button>
      </div>

      {!inputsValid && text.length > 0 && (
        <p className={m.vizHint}>Start, stop and step must be whole numbers (or left blank for the default).</p>
      )}

      <div className={m.vizExpression}>
        <code>
          s = "{run?.text ?? text}"
          {'   '}
          s{run ? run.notation : notation} = <span className={m.vizExpressionResult}>
            {run?.error ? 'ValueError' : finished ? `'${resultValue}'` : run ? `'${resultValue}' …` : '?'}
          </span>
        </code>
      </div>

      <div className={m.vizStage}>
        <div className={m.cellGrid} style={{ '--cells': Math.max(chars.length, 1) }}>
          {chars.map((char, i) => {
            const isPicked = revealed.includes(i);
            const isCurrent = current === i && !finished;
            return (
              <div
                key={`slice-${i}`}
                className={[
                  m.cell,
                  isPicked ? m.cellActive : '',
                  isCurrent ? m.cellPointer : '',
                ].join(' ')}
              >
                <span className={m.cellChar}>{char === ' ' ? '·' : char}</span>
                <span className={m.cellIndex}>{i}</span>
                <span className={m.cellNegIndex}>{i - chars.length}</span>
                {isPicked && (
                  <span className={m.pickOrder}>{revealed.indexOf(i) + 1}</span>
                )}
              </div>
            );
          })}
        </div>
        {run && !run.error && (
          <p className={m.vizNarration} aria-live="polite">
            {!finished && current !== null && `Collecting index ${current} → '${run.text[current]}' (step ${run.step > 0 ? '+' : ''}${run.step})`}
            {finished && run.picked.length > 0 && `Collected ${run.picked.length} character${run.picked.length === 1 ? '' : 's'} in order: indices ${run.picked.join(', ')}.`}
            {finished && run.picked.length === 0 && 'No characters collected, the slice never moves from start towards stop.'}
          </p>
        )}
      </div>

      {finished && run && !run.error && (
        <div className={`${m.vizResult} ${m.vizResultOk}`}>
          <CheckCircle2 size={18} />
          <div>
            <strong>s{run.notation} → '{resultValue}'</strong>
            <p>
              {run.picked.length === 0
                ? 'An empty slice is not an error, and slicing is forgiving where indexing is strict.'
                : run.step < 0
                  ? 'A negative step walks the string from back to front. With blanks, start defaults to the last character and stop to just before the first.'
                  : 'Start is included, stop is excluded, and step controls how far each hop moves.'}
            </p>
          </div>
        </div>
      )}

      {finished && run?.error && (
        <div className={`${m.vizResult} ${m.vizResultError}`}>
          <AlertOctagon size={18} />
          <div>
            <strong>ValueError: slice step cannot be zero</strong>
            <p>{run.error}</p>
          </div>
        </div>
      )}

      {!run && (
        <div className={m.vizIdle}>
          <Sparkles size={16} />
          Leave boxes blank to use Python's defaults. Try step <code>-1</code> to reverse,
          or <code>2</code> to skip every second character.
        </div>
      )}
    </div>
  );
}
