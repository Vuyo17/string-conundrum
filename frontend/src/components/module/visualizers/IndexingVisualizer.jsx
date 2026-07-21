import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon, CheckCircle2, Play, RotateCcw, Sparkles,
} from 'lucide-react';
import m from '../../../styles/ModulePage.module.css';

const MAX_LENGTH = 14;
const TICK_MS = 420;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Build the walk the pointer takes to resolve text[index].
// Positive index: walk forwards from 0. Negative: walk backwards from -1.
function buildWalk(text, index) {
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

export function IndexingVisualizer({ config }) {
  const [text, setText] = useState(config.defaults?.text ?? 'python');
  const [indexInput, setIndexInput] = useState(config.defaults?.index ?? '0');
  const [run, setRun] = useState(null);       // { text, index, walk }
  const [walkPos, setWalkPos] = useState(-1); // position within walk.path
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  const parsedIndex = useMemo(() => {
    const trimmed = indexInput.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    return Number(trimmed);
  }, [indexInput]);

  const canVisualize = text.length > 0 && parsedIndex !== null;

  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startRun() {
    if (!canVisualize) return;
    stopTimer();

    const walk = buildWalk(text, parsedIndex);
    const nextRun = { text, index: parsedIndex, walk };
    setRun(nextRun);

    if (prefersReducedMotion() || walk.path.length === 0) {
      setWalkPos(walk.path.length - 1);
      setDone(true);
      return;
    }

    setWalkPos(0);
    setDone(walk.path.length === 1);
  }

  // advance the pointer on a timer
  useEffect(() => {
    if (!run || done) return undefined;
    timerRef.current = setInterval(() => {
      setWalkPos((pos) => {
        if (pos >= run.walk.path.length - 1) {
          stopTimer();
          setDone(true);
          return pos;
        }
        return pos + 1;
      });
    }, TICK_MS);
    return stopTimer;
  }, [run, done]);

  useEffect(() => stopTimer, []);

  const chars = (run?.text ?? text).split('');
  const pointerCell = run && walkPos >= 0 ? run.walk.path[walkPos] : null;
  const finished = Boolean(run) && done;
  const success = finished && run.walk.valid;
  const failure = finished && !run.walk.valid;
  const resultChar = success ? run.text[run.walk.path[run.walk.path.length - 1]] : null;

  const stepsTaken = run && walkPos >= 0
    ? (run.index >= 0 ? run.walk.path[walkPos] : run.walk.path[walkPos] - run.text.length)
    : null;

  return (
    <div className={m.visualizerCard}>
      <div className={m.visualizerControls}>
        <label className={m.vizField}>
          <span>String</span>
          <input
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => { setText(e.target.value); setRun(null); setDone(false); }}
            placeholder="e.g. python"
            aria-label="String to visualize"
          />
        </label>
        <label className={m.vizField}>
          <span>Index</span>
          <input
            value={indexInput}
            onChange={(e) => { setIndexInput(e.target.value); setRun(null); setDone(false); }}
            placeholder="e.g. -2"
            inputMode="numeric"
            aria-label="Index to access"
          />
        </label>
        <button
          type="button"
          className={m.solidButton}
          onClick={startRun}
          disabled={!canVisualize}
        >
          {finished ? <RotateCcw size={16} /> : <Play size={16} />}
          {finished ? 'Replay' : 'Visualize'}
        </button>
      </div>

      {parsedIndex === null && indexInput.trim() !== '' && (
        <p className={m.vizHint}>The index must be a whole number, like 3 or -1.</p>
      )}

      <div className={m.vizExpression}>
        <code>
          text = "{run?.text ?? text}"
          {'   '}
          text[{run ? run.index : (parsedIndex ?? '?')}] = <span className={m.vizExpressionResult}>{success ? `'${resultChar}'` : failure ? 'IndexError' : '?'}</span>
        </code>
      </div>

      <div className={m.vizStage}>
        <div className={m.cellGrid} style={{ '--cells': Math.max(chars.length, 1) }}>
          {chars.map((char, i) => {
            const visited = run && walkPos >= 0 && run.walk.path.slice(0, walkPos + 1).includes(i);
            const isPointer = pointerCell === i;
            const isTarget = success && i === run.walk.path[run.walk.path.length - 1];
            return (
              <div
                key={`viz-${i}`}
                className={[
                  m.cell,
                  visited ? m.cellVisited : '',
                  isPointer ? m.cellPointer : '',
                  isTarget ? m.cellActive : '',
                ].join(' ')}
              >
                <span className={m.cellChar}>{char === ' ' ? '·' : char}</span>
                <span className={m.cellIndex}>{i}</span>
                <span className={m.cellNegIndex}>{i - chars.length}</span>
                {isPointer && (
                  <span className={m.pointerFlag}>{stepsTaken}</span>
                )}
              </div>
            );
          })}
        </div>
        {run && (
          <p className={m.vizNarration} aria-live="polite">
            {!finished && pointerCell !== null && (
              run.index >= 0
                ? `Walking forward… ${run.walk.path[walkPos]} step${run.walk.path[walkPos] === 1 ? '' : 's'} from the start.`
                : `Counting back… ${run.walk.path[walkPos] - run.text.length} from the end.`
            )}
            {success && `Landed on index ${run.walk.path[run.walk.path.length - 1]}, the character '${resultChar}'.`}
            {failure && `Ran out of boxes. ${run.index} is outside the valid range.`}
          </p>
        )}
      </div>

      {success && (
        <div className={`${m.vizResult} ${m.vizResultOk}`}>
          <CheckCircle2 size={18} />
          <div>
            <strong>text[{run.index}] → '{resultChar}'</strong>
            <p>
              This box has two addresses: index{' '}
              <code>{run.walk.path[run.walk.path.length - 1]}</code> from the front and{' '}
              <code>{run.walk.path[run.walk.path.length - 1] - run.text.length}</code> from the back.
            </p>
          </div>
        </div>
      )}

      {failure && (
        <div className={`${m.vizResult} ${m.vizResultError}`}>
          <AlertOctagon size={18} />
          <div>
            <strong>IndexError: string index out of range</strong>
            <p>
              "{run.text}" has length <code>{run.text.length}</code>, so valid indices run from{' '}
              <code>{-run.text.length}</code> to <code>{run.text.length - 1}</code>.{' '}
              <code>{run.index}</code> falls outside that range.
            </p>
          </div>
        </div>
      )}

      {!run && (
        <div className={m.vizIdle}>
          <Sparkles size={16} />
          Try an index like <code>0</code>, <code>{Math.max(text.length - 1, 0)}</code>,{' '}
          <code>-1</code>, or something out of range to see what happens.
        </div>
      )}
    </div>
  );
}
