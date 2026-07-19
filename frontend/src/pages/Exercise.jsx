import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Star, Target } from 'lucide-react';
import styles from '../styles/App.module.css';
import { Progress } from '../components/Progress';
import { StringCells } from '../components/StringCells';
import { exerciseModules } from '../data/exerciseModules';

// ─── helpers ────────────────────────────────────────────────────────────────

function letterOptionsFor(exercise) {
  // If the prompt or answer is a single short string, render it as StringCells
  // for a bit of visual reinforcement (matches the app's existing style).
  const candidate = exercise?.type === 'fill_blank' ? exercise.answer : null;
  if (candidate && candidate.length <= 12 && /^[a-zA-Z0-9 ,.'!]+$/.test(candidate)) {
    return candidate.split('');
  }
  return null;
}

function defaultAnswerState(exercise) {
  if (!exercise) return null;
  if (exercise.type === 'mcq') return { selected: null };
  if (exercise.type === 'select_all') return { selected: [] };
  if (exercise.type === 'fill_blank') return { value: '' };
  if (exercise.type === 'write_code') return { code: '# write your code here\n' };
  return null;
}

// ─── component ──────────────────────────────────────────────────────────────

export function Exercise() {
  const [moduleId, setModuleId] = useState('indexing');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [index, setIndex] = useState(0);
  const [answerState, setAnswerState] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [stars, setStars] = useState(0); // session stars (bank's legacy xp = stars * 10)

  const exercise = exercises[index] ?? null;

  // ── fetch exercises whenever the module changes ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setIndex(0);
    setResult(null);

    fetch(`/api/exercises/${moduleId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setExercises(data.exercises ?? []);
        setAnswerState(defaultAnswerState((data.exercises ?? [])[0]));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Cannot reach server. Is the backend running?');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  // ── reset the answer input whenever the question changes ─────────────────
  useEffect(() => {
    setAnswerState(defaultAnswerState(exercise));
    setResult(null);
  }, [index, exercise]);

  const letters = useMemo(() => letterOptionsFor(exercise), [exercise]);

  // ── submit handling ───────────────────────────────────────────────────────
  async function handleCheck() {
    if (!exercise) return;
    setSubmitting(true);

    const payload = { module_id: exercise.module_id, question_id: exercise.question_id };
    if (exercise.type === 'mcq') payload.answer = answerState?.selected ?? '';
    if (exercise.type === 'fill_blank') payload.answer = answerState?.value ?? '';
    if (exercise.type === 'select_all') payload.answers = answerState?.selected ?? [];
    if (exercise.type === 'write_code') payload.code = answerState?.code ?? '';

    try {
      const res = await fetch('/api/exercises/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data);
      if (data.correct) setStars((prev) => prev + (exercise.stars ?? Math.max(1, Math.round((exercise.xp ?? 10) / 10))));
    } catch {
      setResult({ ok: false, correct: false, feedback: 'Cannot reach server. Is the backend running?' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    setIndex((i) => Math.min(exercises.length - 1, i + 1));
  }

  function handleSkip() {
    handleNext();
  }

  function toggleSelectAllOption(option) {
    setAnswerState((prev) => {
      const selected = prev?.selected ?? [];
      const next = selected.includes(option)
        ? selected.filter((o) => o !== option)
        : [...selected, option];
      return { selected: next };
    });
  }

  const canCheck = useMemo(() => {
    if (!exercise) return false;
    if (exercise.type === 'mcq') return Boolean(answerState?.selected);
    if (exercise.type === 'select_all') return (answerState?.selected ?? []).length > 0;
    if (exercise.type === 'fill_blank') return (answerState?.value ?? '').trim().length > 0;
    if (exercise.type === 'write_code') return (answerState?.code ?? '').trim().length > 0;
    return false;
  }, [exercise, answerState]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.exerciseLayout}>
      <section className={styles.card}>
        <div className={styles.exerciseModuleBar}>
          <div className={styles.moduleSelectWrap}>
            <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              {exerciseModules.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={18} />
          </div>
          {exercises.length > 0 && (
            <span className={styles.xpBadge}><Star size={14} /> {stars} {stars === 1 ? 'star' : 'stars'}</span>
          )}
        </div>

        {loading && <p className={styles.exerciseLoading}>Loading exercises…</p>}
        {loadError && <p className={styles.exerciseLoading}>{loadError}</p>}

        {!loading && !loadError && exercises.length === 0 && (
          <p className={styles.emptyState}>No exercises found for this module yet.</p>
        )}

        {!loading && exercise && (
          <>
            <div className={styles.exerciseHeader}>
              <strong style={{ fontSize: '14px' }}>
                Question {index + 1} of {exercises.length}
              </strong>
              <Progress value={((index + 1) / exercises.length) * 100} />
              <span className={styles.xpBadge}>
                <Star size={14} /> {exercise.stars ?? Math.max(1, Math.round((exercise.xp ?? 10) / 10))}
              </span>
            </div>

            <h3 style={{ marginTop: '16px' }}>{exercise.prompt.split('\n')[0]}</h3>
            {exercise.prompt.includes('\n') && (
              <pre className={styles.questionCode}>
                {exercise.prompt.split('\n').slice(1).join('\n')}
              </pre>
            )}

            {/* ── mcq ── */}
            {exercise.type === 'mcq' && exercise.options.map((choice, i) => (
              <button
                key={choice}
                className={`${styles.choice} ${answerState?.selected === choice ? styles.correctChoice : ''}`}
                onClick={() => setAnswerState({ selected: choice })}
                disabled={Boolean(result)}
              >
                {String.fromCharCode(65 + i)}. {choice}
              </button>
            ))}

            {/* ── select_all ── */}
            {exercise.type === 'select_all' && exercise.options.map((choice) => (
              <label
                key={choice}
                className={`${styles.checkboxChoice} ${(answerState?.selected ?? []).includes(choice) ? styles.checkboxChoiceSelected : ''}`}
              >
                <input
                  type="checkbox"
                  checked={(answerState?.selected ?? []).includes(choice)}
                  onChange={() => toggleSelectAllOption(choice)}
                  disabled={Boolean(result)}
                />
                {choice}
              </label>
            ))}

            {/* ── fill_blank ── */}
            {exercise.type === 'fill_blank' && (
              <div className={styles.fillBlankRow}>
                <input
                  value={answerState?.value ?? ''}
                  onChange={(e) => setAnswerState({ value: e.target.value })}
                  placeholder="Type your answer"
                  disabled={Boolean(result)}
                />
              </div>
            )}

            {/* ── write_code ── */}
            {exercise.type === 'write_code' && (
              <textarea
                className={styles.codeAnswerArea}
                value={answerState?.code ?? ''}
                onChange={(e) => setAnswerState({ code: e.target.value })}
                spellCheck={false}
                disabled={Boolean(result)}
              />
            )}

            {/* ── result banner ── */}
            {result && (
              <div className={`${styles.resultBanner} ${result.correct ? styles.resultBannerCorrect : styles.resultBannerIncorrect}`}>
                <strong>{result.correct ? 'Correct! 🎉' : 'Not quite.'}</strong>
                <p style={{ marginTop: '6px' }}>{result.feedback}</p>
              </div>
            )}

            <div className={styles.exerciseNavRow}>
              <button className={styles.secondaryButton} onClick={handleSkip} disabled={index >= exercises.length - 1 && !result}>
                Skip
              </button>
              {!result ? (
                <button className={styles.primaryButton} onClick={handleCheck} disabled={!canCheck || submitting}>
                  {submitting ? 'Checking…' : 'Check Answer'}
                </button>
              ) : (
                <button
                  className={styles.primaryButton}
                  onClick={handleNext}
                  disabled={index >= exercises.length - 1}
                >
                  Next Question <ChevronRight size={14} />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <aside className={result?.correct ? styles.feedbackSuccess : styles.misconceptionCard}>
        {!result && (
          <>
            <h3>Tips</h3>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              Read the prompt carefully, work through the code line by line, then check your answer.
              If you get it wrong, the feedback panel will explain the misconception behind it.
            </p>
          </>
        )}

        {result?.correct && (
          <>
            <h3>Correct! 🎉</h3>
            <p style={{ color: 'var(--success)', fontSize: '14px', marginBottom: '14px' }}>
              {result.feedback}
            </p>
            {letters && <StringCells letters={letters} indexes={letters.map((_, i) => i)} highlight={[]} compact />}
          </>
        )}

        {result && !result.correct && (
          <>
            <div className={styles.errorPill}>✗ Incorrect Answer</div>
            <h2>Misconception Detected</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
              {result.feedback}
            </p>
            <h3 style={{ marginTop: '20px' }}>Recommended next step</h3>
            <button className={styles.primaryButton} style={{ marginTop: '4px' }}>
              <Target size={15} /> Review this concept
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
