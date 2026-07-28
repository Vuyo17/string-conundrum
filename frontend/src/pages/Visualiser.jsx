import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Pause, Play } from 'lucide-react';
import styles from '../styles/App.module.css';
import { SpeedControl } from '../components/SpeedControl';
import { useLanguage } from '../context/LanguageContext';

// How long one step is held at 1× speed; the speed picker divides this.
const STEP_INTERVAL_MS = 800;

// ─── pure helpers ─────────────────────────────────────────────────────────────

function parseStringInput(value) {
  const match = value.match(/^\s*\w+\s*=\s*(["'])(.*)\1\s*$/);
  return match ? match[2] : value;
}

function normaliseIndex(index, length) {
  return index < 0 ? length + index : index;
}

function parseSlice(value, length) {
  const parts = value.split(':');
  const rawStart = parts[0] ?? '';
  const rawStop = parts[1] ?? '';
  const rawStep = parts[2] ?? '';

  const start = rawStart.trim() === '' ? 0 : Number(rawStart);
  const stop = rawStop.trim() === '' ? length : Number(rawStop);
  const step = rawStep.trim() === '' ? 1 : Number(rawStep);

  const safeStart = Number.isFinite(start) ? start : 0;
  const safeStop = Number.isFinite(stop) ? stop : length;
  const safeStep = Number.isFinite(step) && step !== 0 ? step : 1;

  const normalStart = Math.max(0, Math.min(length, normaliseIndex(safeStart, length)));
  const normalStop = Math.max(0, Math.min(length, normaliseIndex(safeStop, length)));
  const highlighted = [];

  if (safeStep > 0) {
    for (let i = normalStart; i < normalStop; i += safeStep) highlighted.push(i);
  } else {
    for (let i = normalStart; i > normalStop; i += safeStep) highlighted.push(i);
  }

  return { start: safeStart, stop: safeStop, step: safeStep, normalStart, normalStop, highlighted };
}

function modeLabel(mode, t) {
  const map = {
    index: 'visualiser.modeIndex', slice: 'visualiser.modeSlicing',
    for_loop: 'visualiser.modeForLoop', while_loop: 'visualiser.modeWhileLoop',
    if_stmt: 'visualiser.modeIfStatement', method: 'visualiser.modeStringMethod',
  };
  return map[mode] ? t(map[mode]) : mode;
}

// ─── build steps for each mode ────────────────────────────────────────────────

function buildForSteps(text, rangeInput, t) {
  // rangeInput is like "0:5:1" — we use the chars at those indices
  const { highlighted } = parseSlice(rangeInput, text.length);
  const chars = text.split('');
  return highlighted.map((idx, iteration) => ({
    iteration: iteration + 1,
    total: highlighted.length,
    charIndex: idx,
    char: chars[idx] ?? '',
    highlight: [idx],
    description: t('visualiser.descForLoop', { n: iteration + 1, total: highlighted.length, ch: chars[idx] ?? '' }),
    variables: { c: chars[idx] ?? '', i: idx },
  }));
}

function buildWhileSteps(text, whileInput, t) {
  // whileInput: "i < N" style — we simulate i=0..N-1 stepping through string
  const maxMatch = whileInput.match(/i\s*[<=>]+\s*(\d+)/);
  const limit = maxMatch ? Math.min(Number(maxMatch[1]), text.length) : Math.min(5, text.length);
  const steps = [];
  for (let i = 0; i < limit; i++) {
    // condition-check step
    steps.push({
      iteration: i + 1,
      total: limit,
      charIndex: i,
      char: text[i] ?? '',
      highlight: [i],
      event: 'while-cond',
      condition: whileInput,
      conditionResult: i < limit,
      description: t('visualiser.descWhileTrue', { cond: whileInput, i, ch: text[i] ?? '' }),
      variables: { i, 'text[i]': text[i] ?? '' },
    });
  }
  // final false step
  steps.push({
    iteration: limit + 1,
    total: limit,
    charIndex: -1,
    char: '',
    highlight: [],
    event: 'while-cond',
    condition: whileInput,
    conditionResult: false,
    description: t('visualiser.descWhileFalse', { cond: whileInput, i: limit }),
    variables: { i: limit },
  });
  return steps;
}

function buildIfSteps(text, expression, t) {
  // expression: e.g. "len(text) > 5" or "text[0] == 'H'"
  let result = false;
  let detail = '';
  try {
    // safe eval: replace text with actual value, len() supported
    const safe = expression
      .replace(/\btext\b/g, JSON.stringify(text))
      .replace(/\blen\s*\(([^)]+)\)/g, (_, s) => {
        try { return JSON.parse(s).length; } catch { return 0; }
      });
    // eslint-disable-next-line no-new-func
    result = Boolean(new Function(`return (${safe})`)());
    detail = t('visualiser.evaluatesTo', { result });
  } catch {
    detail = t('visualiser.couldNotEvaluate');
  }

  return [
    {
      iteration: 1,
      total: 2,
      charIndex: -1,
      char: '',
      highlight: result ? text.split('').map((_, i) => i) : [],
      event: 'if',
      condition: expression,
      conditionResult: result,
      description: result
        ? t('visualiser.descIfTrue', { expr: expression })
        : t('visualiser.descIfFalse', { expr: expression }),
      variables: { condition_result: result },
    },
    {
      iteration: 2,
      total: 2,
      charIndex: -1,
      char: '',
      highlight: [],
      event: 'if-done',
      condition: expression,
      conditionResult: result,
      description: result
        ? t('visualiser.descIfDone')
        : t('visualiser.descElseDone'),
      variables: { condition_result: result },
    },
  ];
}

// ─── component ────────────────────────────────────────────────────────────────

export function Visualiser() {
  const { t } = useLanguage();
  const [mode, setMode] = useState('slice');
  const [stringInput, setStringInput] = useState('word = "Hello, World!"');
  const [indexInput, setIndexInput] = useState('2');
  const [sliceInput, setSliceInput] = useState('1:5');
  const [forInput, setForInput] = useState('0:13:1');
  const [whileInput, setWhileInput] = useState('i < 5');
  const [ifInput, setIfInput] = useState('len(text) > 5');
  const [methodInput, setMethodInput] = useState('upper');
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Bumped by the Visualise button to replay the highlight animation.
  const [runId, setRunId] = useState(0);
  const playTimer = useRef(null);

  const text = useMemo(() => parseStringInput(stringInput), [stringInput]);
  const chars = useMemo(() => text.split(''), [text]);
  const length = chars.length;

  // ── derived per-mode state ────────────────────────────────────────────────
  const selectedIndex = useMemo(() => {
    const raw = Number(indexInput);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(length - 1, normaliseIndex(raw, length)));
  }, [indexInput, length]);

  const slice = useMemo(() => parseSlice(sliceInput, length), [sliceInput, length]);

  const forSteps = useMemo(() => buildForSteps(text, forInput, t), [text, forInput, t]);
  const whileSteps = useMemo(() => buildWhileSteps(text, whileInput, t), [text, whileInput, t]);
  const ifSteps = useMemo(() => buildIfSteps(text, ifInput, t), [text, ifInput, t]);

  const methodResult = useMemo(() => {
    const m = methodInput.trim().toLowerCase();
    if (m === 'upper') return text.toUpperCase();
    if (m === 'lower') return text.toLowerCase();
    if (m === 'reverse') return text.split('').reverse().join('');
    if (m === 'strip') return text.trim();
    if (m === 'title') return text.replace(/\b\w/g, c => c.toUpperCase());
    const lenMatch = m.match(/^len\s*\(?\s*\)?$/);
    if (lenMatch) return String(length);
    return `'${text}'.${m}()`;
  }, [text, methodInput, length]);

  // ── active steps array for stepped modes ─────────────────────────────────
  const activeSteps = useMemo(() => {
    if (mode === 'for_loop') return forSteps;
    if (mode === 'while_loop') return whileSteps;
    if (mode === 'if_stmt') return ifSteps;
    return [];
  }, [mode, forSteps, whileSteps, ifSteps]);

  const currentStep = activeSteps[Math.min(stepIndex, activeSteps.length - 1)] ?? null;

  // ── computed highlight / output for simple modes ─────────────────────────
  const highlighted = useMemo(() => {
    if (mode === 'index') return [selectedIndex];
    if (mode === 'slice') return slice.highlighted;
    if (mode === 'method') return chars.map((_, i) => i);
    if (currentStep) return currentStep.highlight;
    return [];
  }, [mode, selectedIndex, slice.highlighted, chars, currentStep]);

  const output = useMemo(() => {
    if (mode === 'index') return chars[selectedIndex] ?? '';
    if (mode === 'slice') return slice.highlighted.map(i => chars[i] ?? '').join('');
    if (mode === 'method') return methodResult;
    if (currentStep) return currentStep.char || (currentStep.conditionResult !== undefined ? String(currentStep.conditionResult) : '');
    return '';
  }, [mode, selectedIndex, chars, slice.highlighted, methodResult, currentStep]);

  // ── reset step when mode / inputs change ──────────────────────────────────
  useEffect(() => {
    setStepIndex(0);
    clearInterval(playTimer.current);
    setIsPlaying(false);
  }, [mode, forInput, whileInput, ifInput, stringInput]);

  // ── auto-play ─────────────────────────────────────────────────────────────
  // `speed` is a multiplier on the base interval; changing it mid-play rebuilds
  // the timer, so the new pace takes effect immediately.
  useEffect(() => {
    if (!isPlaying || activeSteps.length === 0) return;
    playTimer.current = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= activeSteps.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, STEP_INTERVAL_MS / speed);
    return () => clearInterval(playTimer.current);
  }, [isPlaying, activeSteps.length, speed]);

  function stopPlay() { clearInterval(playTimer.current); setIsPlaying(false); }

  // The board is derived live from the inputs, so "Visualise" is about *running*
  // it: stepped modes replay from the first step, and every mode re-triggers the
  // highlight animation so the press has a visible effect.
  function handleVisualise() {
    stopPlay();
    setStepIndex(0);
    setRunId((n) => n + 1);
    if (isStepped && activeSteps.length > 0) setIsPlaying(true);
  }

  function prevStep() { stopPlay(); setStepIndex(i => Math.max(0, i - 1)); }
  function nextStep() { stopPlay(); setStepIndex(i => Math.min(activeSteps.length - 1, i + 1)); }
  function togglePlay() {
    if (activeSteps.length === 0) return;
    if (isPlaying) { stopPlay(); return; }
    if (stepIndex >= activeSteps.length - 1) setStepIndex(0);
    setIsPlaying(true);
  }

  // ── label helpers ─────────────────────────────────────────────────────────
  const isStepped = ['for_loop', 'while_loop', 'if_stmt'].includes(mode);

  const fieldLabel = {
    index: 'Enter an index',
    slice: 'Enter a slice (start:stop:step)',
    for_loop: 'Loop range (start:stop:step)',
    while_loop: 'Condition (e.g. i < 5)',
    if_stmt: 'Condition (e.g. len(text) > 5)',
    method: 'Method name (e.g. upper)',
  }[mode] ?? 'Expression';

  const currentInput = {
    index: indexInput, slice: sliceInput, for_loop: forInput,
    while_loop: whileInput, if_stmt: ifInput, method: methodInput,
  }[mode] ?? '';

  const setCurrentInput = {
    index: setIndexInput, slice: setSliceInput, for_loop: setForInput,
    while_loop: setWhileInput, if_stmt: setIfInput, method: setMethodInput,
  }[mode] ?? (() => {});

  const operationText = {
    index: `text[${indexInput}]`,
    slice: `text[${sliceInput}]`,
    for_loop: `for c in text[${forInput}]:`,
    while_loop: `while ${whileInput}:`,
    if_stmt: `if ${ifInput}:`,
    method: `text.${methodInput}()`,
  }[mode] ?? '';

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.visualiserScreen}>
      <header className={styles.visualiserHeader}>
        <h1>{t('visualiser.title')}</h1>
        <p>{t('visualiser.subtitle')}</p>
      </header>

      {/* ── control card ── */}
      <section className={styles.visualiserControlCard}>
        <label className={styles.visualiserField}>
          <span>{t('visualiser.enterString')}</span>
          <input
            value={stringInput}
            onChange={e => setStringInput(e.target.value)}
            maxLength={50}
          />
          <small>{t('visualiser.characterCount', { count: text.length })}</small>
        </label>

        <label className={styles.visualiserField}>
          <span>{fieldLabel}</span>
          <input
            value={currentInput}
            onChange={e => setCurrentInput(e.target.value)}
          />
          <small>
            {{
              index: `Integer from -${Math.max(length, 1)} to ${Math.max(length - 1, 0)}`,
              slice: 'start:stop:step, e.g. 1:5 or 0:10:2',
              for_loop: 'start:stop:step, e.g. 0:13:1',
              while_loop: 'e.g. i < 5  (i starts at 0, increments by 1)',
              if_stmt: 'e.g. len(text) > 5  or  text[0] == "H"',
              method: 'upper · lower · reverse · strip · title · len()',
            }[mode] ?? ''}
          </small>
        </label>

        <label className={styles.visualiserField}>
          <span>{t('visualiser.selectMode')}</span>
          <div className={styles.visualiserSelectWrap}>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="slice">{t('visualiser.modeSlicing')}</option>
              <option value="index">{t('visualiser.modeIndex')}</option>
              <option value="for_loop">{t('visualiser.modeForLoop')}</option>
              <option value="while_loop">{t('visualiser.modeWhileLoop')}</option>
              <option value="if_stmt">{t('visualiser.modeIfStatement')}</option>
              <option value="method">String Method</option>
            </select>
            <ChevronDown size={22} />
          </div>
        </label>

        <button
          type="button"
          className={styles.visualiseButton}
          onClick={handleVisualise}
          disabled={length === 0}
          title={length === 0 ? 'Enter a string first' : 'Run the visualisation'}
        >
          {isStepped && isPlaying ? 'Playing…' : 'Visualise'}
        </button>
      </section>

      {/* ── board ── */}
      <section className={styles.visualiserBoard}>
        <div className={styles.visualiserBoardTop}>
          <div><strong>String:</strong>{' '}
            <span>{stringInput.includes('=') ? `"${text}"` : text}</span>
          </div>
          <div className={styles.operationBadge}>{operationText}</div>
          <div><strong>{t('visualiser.modeLabel')}</strong> <span>{modeLabel(mode, t)}</span></div>
        </div>

        {/* stepped-mode progress + description */}
        {isStepped && currentStep && (
          <div className={styles.visStepPanel}>
            <div className={styles.visStepProgressBar}>
              <div
                className={styles.visStepProgressFill}
                style={{ width: `${((stepIndex + 1) / activeSteps.length) * 100}%` }}
              />
            </div>
            <div className={styles.visStepInfo}>
              <span className={styles.visStepCount}>
                Step {stepIndex + 1} / {activeSteps.length}
              </span>
              {currentStep.conditionResult !== undefined && (
                <span
                  className={styles.visCondBadge}
                  style={{
                    background: currentStep.conditionResult ? '#c8f7e1' : '#fde8e8',
                    color: currentStep.conditionResult ? '#0e8a6b' : '#d32f2f',
                  }}
                >
                  {currentStep.conditionResult ? 'Condition: True ✓' : 'Condition: False ✗'}
                </span>
              )}
              {currentStep.iteration && mode === 'for_loop' && (
                <span className={styles.visIterBadge}>
                  {t('visualiser.iteration', { current: currentStep.iteration, total: currentStep.total })}
                </span>
              )}
            </div>
            <div className={styles.visStepDesc}>{currentStep.description}</div>

            {/* variable mini-table */}
            {currentStep.variables && Object.keys(currentStep.variables).length > 0 && (
              <div className={styles.visVarRow}>
                {Object.entries(currentStep.variables).map(([k, v]) => (
                  <span key={k} className={styles.visVarChip}>
                    <strong>{k}</strong> = {typeof v === 'string' ? `"${v}"` : String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* character grid */}
        <div className={styles.visualRows}>
          <div className={styles.rowLabel}>Index</div>
          <div className={styles.visualGrid} style={{ '--cells': Math.max(length, 1) }}>
            {chars.map((_, index) => (
              <span key={`p-${index}`} className={styles.indexNumber}>{index}</span>
            ))}
            {chars.map((_, index) => (
              <span key={`n-${index}`} className={styles.negativeNumber}>{index - length}</span>
            ))}
          </div>

          <div className={styles.rowLabel}>Char</div>
          <div className={styles.visualGrid} style={{ '--cells': Math.max(length, 1) }}>
            {chars.map((char, index) => {
              const active = highlighted.includes(index);
              return (
                <span
                  // runId is part of the key so a Visualise press remounts the
                  // cells and replays the highlight animation.
                  key={`${char}-${index}-${runId}`}
                  className={[
                    styles.visualChar,
                    active ? styles.visualCharActive : '',
                    active ? styles.visualCharPulse : '',
                  ].join(' ')}
                  style={active ? { animationDelay: `${Math.min(highlighted.indexOf(index) * 60, 600)}ms` } : undefined}
                >
                  {char === ' ' ? '\u00b7' : char}
                </span>
              );
            })}
          </div>

          {/* markers row */}
          <div className={styles.rowLabel} />
          {mode === 'slice' ? (
            <div className={styles.sliceGrid} style={{ '--cells': Math.max(length, 1) }}>
              <div
                className={styles.sliceBracket}
                style={{
                  gridColumn: `${Math.min(slice.normalStart, slice.normalStop) + 1} / ${Math.max(slice.normalStart, slice.normalStop) + 1}`,
                }}
              />
              <span className={styles.sliceStart} style={{ gridColumn: `${slice.normalStart + 1}` }}>
                ▲<strong>{t('visualiser.start')}: {slice.start}</strong><small>{t('visualiser.inclusive')}</small>
              </span>
              <span className={styles.sliceStop} style={{ gridColumn: `${slice.normalStop + 1}` }}>
                ▲<strong>{t('visualiser.stop')}: {slice.stop}</strong><small>{t('visualiser.exclusive')}</small>
              </span>
            </div>
          ) : (
            <div className={styles.markerGrid} style={{ '--cells': Math.max(length, 1) }}>
              {chars.map((_, index) => {
                const active = highlighted.includes(index);
                return (
                  <span key={`marker-${index}`} className={active ? styles.markerActive : ''}>
                    {active && (
                      <>
                        ▲
                        <strong>
                          {mode === 'for_loop' && currentStep ? currentStep.char || index
                            : mode === 'while_loop' && currentStep ? `i=${currentStep.variables?.i ?? index}`
                              : index}
                        </strong>
                        {mode === 'for_loop' && currentStep && (
                          <small>iter {currentStep.iteration}/{currentStep.total}</small>
                        )}
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* output box */}
        <div className={styles.visualiserOutput}>
          <strong>{t('visualiser.output')}</strong>
          <code>
            {mode === 'if_stmt'
              ? (currentStep?.conditionResult !== undefined
                  ? (currentStep.conditionResult ? 'True → if-body runs' : 'False → else runs')
                  : '?')
              : `'${output}'`}
          </code>
        </div>
      </section>

      {/* ── speed picker (own row, above the playback controls) ── */}
      <div className={styles.visualiserSpeedRow}>
        <SpeedControl value={speed} onChange={setSpeed} disabled={!isStepped} />
      </div>

      {/* ── playback controls ── */}
      <section className={styles.visualiserControls}>
        <button onClick={prevStep} disabled={!isStepped || stepIndex === 0}>
          <ChevronLeft size={28} /> {t('common.previous')}
        </button>
        <button
          className={styles.playButton}
          onClick={isStepped ? togglePlay : undefined}
          disabled={!isStepped}
        >
          {isPlaying ? <Pause size={26} /> : <Play size={26} />}
          {isPlaying ? t('common.pause') : t('common.play')}
        </button>
        <button onClick={nextStep} disabled={!isStepped || stepIndex === activeSteps.length - 1}>
          {t('common.next')} <ChevronRight size={28} />
        </button>
      </section>
    </div>
  );
}
