import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, CheckCircle2, ChevronRight, ListChecks,
  PenLine, RefreshCcw, SquareMousePointer, Star, Target,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { apiFetch, markSectionComplete } from '../../api';
import { getApiUrl } from '../../config/api';
import { CodeExercise } from './CodeExercise';
import { CodeBlock, InlineText } from './ContentBlocks';
import { DragDropWarmup } from './DragDropWarmup';
import { PracticeEngine } from './PracticeEngine';
import { useLanguage } from '../../context/LanguageContext';
import {
  starsOf, splitPrompt, displayOptionsOf, defaultAnswer, optionOrder,
} from './exerciseHelpers';

// A practice run is recorded once a student clears this bar in one sitting.
// Practice is no longer part of the module-completion gate (see
// getModuleSectionIds in utils/moduleSections.js) — this only drives
// Practice's own pass/fail display and stats, not module unlocking.
const PASS_THRESHOLD = 70;

// ─── helpers ──────────────────────────────────────────────────────────────────

// labelKey resolves through exercise.questionType.<type> so these translate
// like everything else — see the icon-only lookup below.
const TYPE_META = {
  mcq: { labelKey: 'mcq', icon: ListChecks },
  select_all: { labelKey: 'select_all', icon: ListChecks },
  fill_blank: { labelKey: 'fill_blank', icon: PenLine },
  write_code: { labelKey: 'write_code', icon: SquareMousePointer },
};

// ─── section wrapper: fetches the module's exercise bank for Practice ─────────

export function PracticeSection({ practice, onSectionComplete }) {
  // A module opts into the endless procedural engine instead of the
  // static exercise bank below by setting `engine: true` in its own
  // moduleContent/<id>.js — see PracticeEngine.jsx. It needs nothing this
  // component fetches (no bank, no warmup), so it branches off before any
  // of that runs.
  if (practice.engine) {
    return (
      <div className={m.practiceStack}>
        <PracticeEngine practice={practice} onSectionComplete={onSectionComplete} />
      </div>
    );
  }
  return <BankPracticeSection practice={practice} onSectionComplete={onSectionComplete} />;
}

function BankPracticeSection({ practice, onSectionComplete }) {
  const { lang, t } = useLanguage();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl(`/api/exercises/${practice.apiModuleId}?lang=${lang}`))
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setExercises(data.exercises ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError('practice.serverUnreachable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [practice.apiModuleId, lang]);

  if (loading) return <p className={m.practiceStatus}>{t('practice.loading')}</p>;
  if (loadError) return <p className={m.practiceStatus}>{t(loadError)}</p>;
  if (exercises.length === 0) return <p className={m.practiceStatus}>{t('practice.noExercises')}</p>;

  // Optionally cap how many of the bank's questions a practice run covers;
  // unset means "all of them" (the original behavior).
  const runExercises = practice.questionCount
    ? exercises.slice(0, practice.questionCount)
    : exercises;

  return (
    <div className={m.practiceStack}>
      <PracticeRunner practice={practice} exercises={runExercises} onSectionComplete={onSectionComplete} />
    </div>
  );
}

// ─── graded exercise runner (real backend pipeline) ───────────────────────────

function PracticeRunner({ practice, exercises, onSectionComplete }) {
  const { t, lang } = useLanguage();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(() => defaultAnswer(exercises[0]));
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [stars, setStars] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const exercise = exercises[index] ?? null;

  // Recomputed only when the question changes — Practice re-renders on every
  // click (selecting an option, seeing feedback), and reshuffling then would
  // move choices under the student mid-answer.
  const order = useMemo(() => optionOrder(exercise ?? {}), [exercise?.question_id]);

  // Practice only counts toward module progress once cleared at PASS_THRESHOLD
  // in one sitting; retries via "Practice again" can re-trigger this.
  useEffect(() => {
    if (!finished) return;
    const percent = Math.round((correctCount / exercises.length) * 100);
    if (percent >= PASS_THRESHOLD) {
      markSectionComplete(practice.apiModuleId, 'practice').then(() => onSectionComplete?.());
    }
  }, [finished]);

  useEffect(() => {
    setAnswer(defaultAnswer(exercise));
    setResult(null);
  }, [index, exercise]);

  const canCheck = useMemo(() => {
    if (!exercise || !answer) return false;
    if (exercise.type === 'mcq') return Boolean(answer.selected);
    if (exercise.type === 'select_all') return (answer.selected ?? []).length > 0;
    if (exercise.type === 'fill_blank') return (answer.value ?? '').trim().length > 0;
    if (exercise.type === 'write_code') return (answer.code ?? '').trim().length > 0;
    return false;
  }, [exercise, answer]);

  async function handleCheck() {
    if (!exercise) return;
    setSubmitting(true);
    const payload = { module_id: exercise.module_id, question_id: exercise.question_id, lang };
    if (exercise.type === 'mcq') payload.answer = answer?.selected ?? '';
    if (exercise.type === 'fill_blank') payload.answer = answer?.value ?? '';
    if (exercise.type === 'select_all') payload.answers = answer?.selected ?? [];
    if (exercise.type === 'write_code') payload.code = answer?.code ?? '';

    try {
      const res = await apiFetch(getApiUrl('/api/exercises/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ correct: false, feedback: t('exercise.markFailed') });
        return;
      }
      setResult(data);
      if (data.correct) {
        setStars((prev) => prev + starsOf(exercise));
        setCorrectCount((prev) => prev + 1);
      }
    } catch {
      setResult({ correct: false, feedback: t('codeSpace.serverUnreachable') });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (index >= exercises.length - 1) setFinished(true);
    else setIndex((i) => i + 1);
  }

  function restart() {
    setIndex(0);
    setStars(0);
    setCorrectCount(0);
    setFinished(false);
    setAnswer(defaultAnswer(exercises[0]));
    setResult(null);
  }

  function toggleOption(option) {
    setAnswer((prev) => {
      const selected = prev?.selected ?? [];
      return {
        selected: selected.includes(option)
          ? selected.filter((o) => o !== option)
          : [...selected, option],
      };
    });
  }

  if (finished) {
    const percent = Math.round((correctCount / exercises.length) * 100);
    return (
      <div className={m.completionCard}>
        <span className={m.completionIcon}><Award size={30} /></span>
        <h3>{t('exercise.practiceComplete')}</h3>
        <p>
          {/* One key per whole sentence rather than bolted-together fragments:
              isiXhosa word order differs from English, so a translator needs
              the complete sentence to reorder. That costs the inline bold on
              the numbers, which is not worth a mistranslatable string. */}
          {t(stars === 1 ? 'exercise.practiceScoreOne' : 'exercise.practiceScore', {
            correct: correctCount,
            total: exercises.length,
            percent,
            stars,
          })}{' '}
          <Star size={14} className={m.inlineStar} />{' '}
          {percent >= PASS_THRESHOLD
            ? t('exercise.practicePassed')
            : t('exercise.practiceRetry')}
        </p>
        <button type="button" className={m.solidButton} onClick={restart}>
          <RefreshCcw size={15} /> {t('exercise.practiceAgain')}
        </button>
      </div>
    );
  }

  const { title: promptTitle, code: promptCode } = splitPrompt(exercise.prompt);
  const meta = TYPE_META[exercise.type] ?? TYPE_META.mcq;
  const MetaIcon = meta.icon;

  return (
    <div className={m.runnerStack}>
      {practice.warmup?.type === 'drag_drop' && index === 0 && !result && (
        <DragDropWarmup config={practice.warmup} />
      )}

      <div className={m.questionCard}>
        <header className={m.questionHeader}>
          <div className={m.questionMeta}>
            <span className={m.questionType}><MetaIcon size={13} /> {t(`exercise.questionType.${meta.labelKey}`)}</span>
            <span className={m.questionXp}>
              <Star size={13} /> {starsOf(exercise)} {t('exercise.starUnit')}
            </span>
          </div>
          <div className={m.questionProgress}>
            <span>Question {index + 1} of {exercises.length}</span>
            <div className={m.progressTrack}>
              <div
                className={m.progressFill}
                style={{ width: `${((index + 1) / exercises.length) * 100}%` }}
              />
            </div>
            <span className={m.sessionXp}><Star size={13} /> {stars}</span>
          </div>
        </header>

        <h3 className={m.questionTitle}>{promptTitle}</h3>
        {promptCode && <CodeBlock code={promptCode} />}

        {exercise.type === 'mcq' && (
          <div className={m.choiceList} role="radiogroup" aria-label={t('a11y.answerChoices')}>
            {order.map((i, pos) => {
              const choice = exercise.options[i];
              return (
                // Keyed by original index, not by value: option values are not
                // guaranteed unique (several questions ship repeated choices),
                // and a duplicate value made React collide the two buttons.
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={answer?.selected === choice}
                  className={`${m.choice} ${answer?.selected === choice ? m.choiceSelected : ''}`}
                  onClick={() => setAnswer({ selected: choice })}
                  disabled={Boolean(result)}
                >
                  <span className={m.choiceKey}>{String.fromCharCode(65 + pos)}</span>
                  <span className={m.choiceText}>{displayOptionsOf(exercise, lang)[i]}</span>
                </button>
              );
            })}
          </div>
        )}

        {exercise.type === 'select_all' && (
          <div className={m.choiceList}>
            {order.map((i) => {
              const choice = exercise.options[i];
              const on = (answer?.selected ?? []).includes(choice);
              return (
                <button
                  key={i}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={`${m.choice} ${on ? m.choiceSelected : ''}`}
                  onClick={() => toggleOption(choice)}
                  disabled={Boolean(result)}
                >
                  <span className={`${m.choiceBox} ${on ? m.choiceBoxOn : ''}`}>
                    {on && <CheckCircle2 size={14} />}
                  </span>
                  <span className={m.choiceText}>{displayOptionsOf(exercise, lang)[i]}</span>
                </button>
              );
            })}
          </div>
        )}

        {exercise.type === 'fill_blank' && (
          <input
            className={m.fillInput}
            value={answer?.value ?? ''}
            onChange={(e) => setAnswer({ value: e.target.value })}
            placeholder={t('exercise.typeAnswer')}
            disabled={Boolean(result)}
            aria-label={t('a11y.yourAnswer')}
          />
        )}

        {exercise.type === 'write_code' && (
          <>
            <CodeExercise
              code={answer?.code ?? ''}
              onCodeChange={(code) => setAnswer({ code })}
              disabled={Boolean(result)}
            />
            {exercise.test_cases?.length > 0 && (
              <div className={m.testCases}>
                <span className={m.testCasesLabel}>{t('exercise.expectedOutput')}</span>
                {/* Mirrors ExamMode's layout — see the note there. */}
                {exercise.test_cases.map((tc, i) => (
                  <div key={i} className={m.testCaseRow}>
                    {tc.input ? (
                      <>
                        <span className={m.testCaseKey}>{t('exercise.given')}</span>
                        <code>{tc.input.trim()}</code>
                      </>
                    ) : null}
                    <span className={m.testCaseKey}>{t('exercise.prints')}</span>
                    <code className={m.testCaseExpected}>{tc.expected_output}</code>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div aria-live="polite">
          {result && (
            <div className={`${m.feedbackBanner} ${result.correct ? m.feedbackOk : m.feedbackNo}`}>
              <span className={m.feedbackIcon}>
                {result.correct ? <CheckCircle2 size={18} /> : <Target size={18} />}
              </span>
              <div>
                <strong>{result.correct ? t('exercise.correctHeading') : t('exercise.notQuite')}</strong>
                <p><InlineText text={result.feedback ?? ''} /></p>
                {result.explanation && (
                  <p className={m.feedbackExplanation}>
                    <strong>{t('common.why')}</strong> <InlineText text={result.explanation} />
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className={m.questionFooter}>
          <button
            type="button"
            className={m.ghostButton}
            onClick={handleNext}
            disabled={Boolean(result)}
          >
            Skip
          </button>
          {!result ? (
            <button
              type="button"
              className={m.solidButton}
              onClick={handleCheck}
              disabled={!canCheck || submitting}
            >
              {submitting ? t('exercise.checking') : t('exercise.checkAnswer')}
            </button>
          ) : (
            <button type="button" className={m.solidButton} onClick={handleNext}>
              {index >= exercises.length - 1 ? t('exercise.finish') : t('exercise.nextQuestion')} <ChevronRight size={15} />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
