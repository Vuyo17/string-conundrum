import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon, CheckCircle2, Play, RotateCcw, Sparkles, Volume2, VolumeX,
} from 'lucide-react';
import m from '../../../styles/ModulePage.module.css';
import { useLanguage } from '../../../context/LanguageContext';
import { computeSlice, parseSlicePart } from '../../../utils/pythonStringOps';
import { SpeechUnavailableDialog } from '../../SpeechUnavailableDialog';
import { joinSpeech, useSpeech } from '../../../utils/useSpeech';

const MAX_LENGTH = 14;
const TICK_MS = 460;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function SlicingVisualizer({ config, preset, autoPlayKey }) {
  const { t, lang } = useLanguage();
  const speech = useSpeech(lang);
  const [text, setText] = useState(config.defaults?.text ?? 'Jabberwocky');
  const [startIn, setStartIn] = useState(config.defaults?.start ?? '');
  const [stopIn, setStopIn] = useState(config.defaults?.stop ?? '');
  const [stepIn, setStepIn] = useState(config.defaults?.step ?? '-1');
  const [run, setRun] = useState(null);   // { text, picked, notation, error }
  const [pos, setPos] = useState(-1);     // how many picks are revealed so far
  const [done, setDone] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const timerRef = useRef(null);
  const runRef = useRef(run);
  runRef.current = run;

  const parts = useMemo(() => ({
    start: parseSlicePart(startIn), stop: parseSlicePart(stopIn), step: parseSlicePart(stepIn),
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

  function advanceSlice() {
    setPos((p) => {
      const len = runRef.current?.picked.length ?? 0;
      if (p >= len - 1) {
        stopTimer();
        setDone(true);
        return p;
      }
      return p + 1;
    });
  }

  // Silent mode keeps the original tick. With read-aloud on, wait until the
  // current sentence has been spoken before collecting the next character.
  useEffect(() => {
    if (!run || done || run.error || speech.enabled) return undefined;
    timerRef.current = setInterval(advanceSlice, TICK_MS);
    return stopTimer;
  }, [run, done, speech.enabled]);

  useEffect(() => stopTimer, []);

  // A missed exam question can hand us the exact string and dials it was built
  // from. Load them, then run on the *next* render so startRun reads the
  // committed state instead of the values it closed over here.
  useEffect(() => {
    if (!preset) return;
    setText(preset.text);
    setStartIn(preset.start ?? '');
    setStopIn(preset.stop ?? '');
    setStepIn(preset.step ?? '');
    setRun(null);
    setPos(-1);
    setDone(false);
    setAutoRun(true);
  }, [preset]);

  useEffect(() => {
    if (!autoRun) return;
    setAutoRun(false);
    startRun();
  }, [autoRun]);

  // Opening the module's Visualize section plays the slice straight away
  // rather than waiting for a manual trigger (cycle-1 feedback). ModulePage
  // bumps `autoPlayKey` each time the section becomes active; undefined
  // (the Visualiser screen's own standalone use) never auto-plays, so that
  // page still waits for the student to press Visualize.
  useEffect(() => {
    if (autoPlayKey === undefined) return;
    setRun(null);
    setPos(-1);
    setDone(false);
    setAutoRun(true);
  }, [autoPlayKey]);

  const chars = (run?.text ?? text).split('');
  const revealed = run && !run.error ? run.picked.slice(0, pos + 1) : [];
  const current = revealed.length > 0 ? revealed[revealed.length - 1] : null;
  const finished = Boolean(run) && done;
  const resultValue = run && !run.error
    ? revealed.map((i) => run.text[i]).join('')
    : '';

  // The step commentary, as one plain string: rendered into the aria-live
  // region for screen readers AND handed to read-aloud, so both stay in sync
  // with whatever the animation is showing rather than drifting apart.
  // A zero step used to produce no spoken line at all (the live region was
  // gated on !run.error); the error name and the reason are now part of the
  // same utterance as a successful result's "why".
  const sliceWhy = !run || run.error ? '' : (
    run.picked.length === 0
      ? t('viz.sliceEmpty')
      : run.step < 0
        ? t('viz.sliceNegativeStep')
        : t('viz.sliceDefault')
  );
  const narration = !run ? '' : joinSpeech(
    run.error && t('viz.valueErrorTitle'),
    run.error && t('viz.valueErrorWhy'),
    !run.error && !finished && current !== null && t('viz.collecting', {
      index: current,
      char: run.text[current],
      step: `${run.step > 0 ? '+' : ''}${run.step}`,
    }),
    !run.error && !finished && current !== null && t('viz.whyCollecting'),
    !run.error && finished && run.picked.length > 0 && t(
      run.picked.length === 1 ? 'viz.collectedOne' : 'viz.collected',
      { count: run.picked.length, indices: run.picked.join(', ') },
    ),
    !run.error && finished && run.picked.length === 0 && t('viz.collectedNone'),
    !run.error && finished && sliceWhy,
    !run.error && finished && (run.startClamped || run.stopClamped) && t('viz.whySliceClamped'),
  );

  useEffect(() => {
    const wait = speech.enabled && Boolean(run) && !done && !run.error;
    speech.speak(narration, wait ? advanceSlice : undefined);
  }, [narration, speech.speak, speech.enabled, run, done]);

  return (
    <div className={m.visualizerCard}>
      <div className={m.visualizerControls}>
        <label className={m.vizField}>
          <span>{t('viz.string')}</span>
          <input
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(e) => { setText(e.target.value); reset(); }}
            aria-label={t('a11y.stringToSlice')}
          />
        </label>
        <label className={`${m.vizField} ${m.vizFieldNarrow}`}>
          <span>{t('viz.start')}</span>
          <input value={startIn} onChange={(e) => { setStartIn(e.target.value); reset(); }} placeholder="0" inputMode="numeric" aria-label={t('a11y.sliceStart')} />
        </label>
        <label className={`${m.vizField} ${m.vizFieldNarrow}`}>
          <span>{t('viz.stop')}</span>
          <input value={stopIn} onChange={(e) => { setStopIn(e.target.value); reset(); }} placeholder="end" inputMode="numeric" aria-label={t('a11y.sliceStop')} />
        </label>
        <label className={`${m.vizField} ${m.vizFieldNarrow}`}>
          <span>{t('viz.step')}</span>
          <input value={stepIn} onChange={(e) => { setStepIn(e.target.value); reset(); }} placeholder="1" inputMode="numeric" aria-label={t('a11y.sliceStep')} />
        </label>
        <button type="button" className={m.solidButton} onClick={startRun} disabled={!inputsValid}>
          {finished ? <RotateCcw size={16} /> : <Play size={16} />}
          {finished ? t('viz.replay') : t('viz.visualize')}
        </button>
        {speech.supported && (
          <button
            type="button"
            className={m.ghostButton}
            onClick={speech.toggle}
            aria-pressed={speech.enabled}
            title={
              speech.available
                ? (speech.enabled ? t('viz.readAloudOff') : t('viz.readAloudOn'))
                : t('viz.readAloudUnavailable')
            }
          >
            {speech.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {t('viz.readAloud')}
          </button>
        )}
        <SpeechUnavailableDialog open={speech.noticeOpen} onClose={speech.dismissNotice} />
      </div>

      {!inputsValid && text.length > 0 && (
        <p className={m.vizHint}>{t('viz.sliceWholeNumbers')}</p>
      )}

      <div className={`${m.vizExpression} ${run?.error ? m.vizExpressionError : ''}`}>
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
        {run && (
          <p className={m.vizNarration} aria-live="polite">
            {narration}
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
                ? t('viz.sliceEmpty')
                : run.step < 0
                  ? t('viz.sliceNegativeStep')
                  : t('viz.sliceDefault')}
            </p>
          </div>
        </div>
      )}

      {finished && run?.error && (
        <div className={`${m.vizResult} ${m.vizResultError}`}>
          <AlertOctagon size={18} />
          <div>
            <strong>{t('viz.valueErrorTitle')}</strong>
            <p>{run.error}</p>
          </div>
        </div>
      )}

      {!run && (
        <div className={m.vizIdle}>
          <Sparkles size={16} />
          {t('viz.sliceIdleBefore')} <code>-1</code> {t('viz.sliceIdleMiddle')}{' '}
          <code>2</code> {t('viz.sliceIdleAfter')}
        </div>
      )}
    </div>
  );
}
