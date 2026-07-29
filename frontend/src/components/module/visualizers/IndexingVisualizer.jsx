import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon, CheckCircle2, Play, RotateCcw, Sparkles,
} from 'lucide-react';
import m from '../../../styles/ModulePage.module.css';
import { useLanguage } from '../../../context/LanguageContext';

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

export function IndexingVisualizer({ config, preset }) {
  const { t } = useLanguage();
  const [text, setText] = useState(config.defaults?.text ?? 'python');
  const [indexInput, setIndexInput] = useState(config.defaults?.index ?? '0');
  const [run, setRun] = useState(null);       // { text, index, walk }
  const [walkPos, setWalkPos] = useState(-1); // position within walk.path
  const [done, setDone] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
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

  // A missed exam question can hand us the exact string and index it was built
  // from. Load them, then run on the *next* render so startRun reads the
  // committed state instead of the values it closed over here.
  useEffect(() => {
    if (!preset) return;
    setText(preset.text);
    setIndexInput(String(preset.index));
    setRun(null);
    setDone(false);
    setAutoRun(true);
  }, [preset]);

  useEffect(() => {
    if (!autoRun) return;
    setAutoRun(false);
    startRun();
  }, [autoRun]);

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
          <span>{t('viz.string')}</span>
          <input
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => { setText(e.target.value); setRun(null); setDone(false); }}
            placeholder={t('viz.stringExample')}
            aria-label={t('a11y.stringToVisualize')}
          />
        </label>
        <label className={m.vizField}>
          <span>{t('viz.index')}</span>
          <input
            value={indexInput}
            onChange={(e) => { setIndexInput(e.target.value); setRun(null); setDone(false); }}
            placeholder={t('viz.indexExample')}
            inputMode="numeric"
            aria-label={t('a11y.indexToAccess')}
          />
        </label>
        <button
          type="button"
          className={m.solidButton}
          onClick={startRun}
          disabled={!canVisualize}
        >
          {finished ? <RotateCcw size={16} /> : <Play size={16} />}
          {finished ? t('viz.replay') : t('viz.visualize')}
        </button>
      </div>

      {parsedIndex === null && indexInput.trim() !== '' && (
        <p className={m.vizHint}>{t('viz.indexWholeNumber')}</p>
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
                ? t(
                    run.walk.path[walkPos] === 1 ? 'viz.walkingForwardOne' : 'viz.walkingForward',
                    { steps: run.walk.path[walkPos] },
                  )
                : t('viz.countingBack', { steps: run.walk.path[walkPos] - run.text.length })
            )}
            {success && t('viz.landedOn', {
              index: run.walk.path[run.walk.path.length - 1],
              char: resultChar,
            })}
            {failure && t('viz.ranOut', { index: run.index })}
          </p>
        )}
      </div>

      {success && (
        <div className={`${m.vizResult} ${m.vizResultOk}`}>
          <CheckCircle2 size={18} />
          <div>
            <strong>text[{run.index}] → '{resultChar}'</strong>
            <p>
              {t('viz.twoAddressesBefore')}{' '}
              <code>{run.walk.path[run.walk.path.length - 1]}</code> {t('viz.twoAddressesMiddle')}{' '}
              <code>{run.walk.path[run.walk.path.length - 1] - run.text.length}</code>{' '}
              {t('viz.twoAddressesAfter')}
            </p>
          </div>
        </div>
      )}

      {failure && (
        <div className={`${m.vizResult} ${m.vizResultError}`}>
          <AlertOctagon size={18} />
          <div>
            <strong>{t('viz.indexErrorTitle')}</strong>
            <p>
              {t('viz.indexErrorBodyBefore', { text: run.text })}{' '}
              <code>{run.text.length}</code>{t('viz.indexErrorBodyMiddle')}{' '}
              <code>{-run.text.length}</code> {t('viz.indexErrorBodyTo')}{' '}
              <code>{run.text.length - 1}</code>. <code>{run.index}</code>{' '}
              {t('viz.indexErrorBodyAfter')}
            </p>
          </div>
        </div>
      )}

      {!run && (
        <div className={m.vizIdle}>
          <Sparkles size={16} />
          {t('viz.indexIdleBefore')} <code>0</code>, <code>{Math.max(text.length - 1, 0)}</code>,{' '}
          <code>-1</code>, {t('viz.indexIdleAfter')}
        </div>
      )}
    </div>
  );
}
