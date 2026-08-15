import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, CheckCircle2, ChevronRight, ListChecks,
  PenLine, RefreshCcw, SquareMousePointer, Star, Target, XCircle,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { apiFetch, markSectionComplete } from '../../api';
import { getApiUrl } from '../../config/api';
import { CodeExercise } from './CodeExercise';
import { CodeBlock, InlineText } from './ContentBlocks';
import { useLanguage } from '../../context/LanguageContext';

// A practice run is recorded once a student clears this bar in one sitting.
// Practice is no longer part of the module-completion gate (see
// getModuleSectionIds in utils/moduleSections.js) — this only drives
// Practice's own pass/fail display and stats, not module unlocking.
const PASS_THRESHOLD = 70;

// Star value of an exercise. The bank's legacy `xp` field is stars * 10;
// newer questions carry `stars` directly. The UI speaks ONLY in stars.
export function starsOf(exercise) {
  return exercise?.stars ?? Math.max(1, Math.round((exercise?.xp ?? 10) / 10));
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const TYPE_META = {
  mcq: { label: 'Multiple choice', icon: ListChecks },
  select_all: { label: 'Select all that apply', icon: ListChecks },
  fill_blank: { label: 'Short answer', icon: PenLine },
  write_code: { label: 'Write code', icon: SquareMousePointer },
};

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function defaultAnswer(exercise) {
  if (!exercise) return null;
  if (exercise.type === 'mcq') return { selected: null };
  if (exercise.type === 'select_all') return { selected: [] };
  if (exercise.type === 'fill_blank') return { value: '' };
  if (exercise.type === 'write_code') {
    return { code: exercise.starter_code ?? '# Write your solution here\n' };
  }
  return null;
}

function splitPrompt(prompt) {
  const [first, ...rest] = prompt.split('\n');
  return { title: first, code: rest.join('\n') };
}

// Text shown for each option, in the student's language. The VALUE used for
// selection state and submission is always `exercise.options[i]` (English) —
// grading compares against that verbatim, so only the label may translate.
// `lang` is required, not optional: keying off "a translation exists" alone
// rendered isiXhosa option labels to English readers, because the API ships
// options_xh alongside the English options in both languages.
function displayOptionsOf(exercise, lang) {
  const { options, options_xh } = exercise;
  if (lang !== 'xh') return options;
  return options_xh?.length === options.length ? options_xh : options;
}

// ─── drag & drop warm-up (client-side, ungraded) ──────────────────────────────

function DragDropWarmup({ config }) {
  const { t } = useLanguage();
  const letters = useMemo(
    () => config.word.split('').map((char, i) => ({ id: `${char}-${i}`, char })),
    [config.word],
  );
  const [pool, setPool] = useState(() => shuffle(letters));
  const [slots, setSlots] = useState(() => letters.map(() => null));
  const [picked, setPicked] = useState(null); // tile id, for tap-to-place
  const [checked, setChecked] = useState(false);

  const complete = slots.every(Boolean);
  const correctness = slots.map((tile, i) => (tile ? tile.char === config.word[i] : false));
  const allCorrect = complete && correctness.every(Boolean);

  function placeTile(tileId, slotIndex) {
    const tile = pool.find((t) => t.id === tileId) ?? slots.find((t) => t?.id === tileId);
    if (!tile) return;
    setChecked(false);
    setPool((prev) => prev.filter((t) => t.id !== tileId));
    setSlots((prev) => {
      const next = prev.map((t) => (t?.id === tileId ? null : t));
      const evicted = next[slotIndex];
      next[slotIndex] = tile;
      if (evicted) setPool((p) => [...p, evicted]);
      return next;
    });
    setPicked(null);
  }

  function returnTile(slotIndex) {
    const tile = slots[slotIndex];
    if (!tile) return;
    setChecked(false);
    setSlots((prev) => prev.map((t, i) => (i === slotIndex ? null : t)));
    setPool((prev) => [...prev, tile]);
  }

  function reset() {
    setPool(shuffle(letters));
    setSlots(letters.map(() => null));
    setPicked(null);
    setChecked(false);
  }

  return (
    <div className={m.warmupCard}>
      <div className={m.warmupHeader}>
        <span className={m.warmupBadge}><SquareMousePointer size={13} /> {t('practice.dragAndDrop')}</span>
        <h3>{config.title}</h3>
        <p>{config.prompt}</p>
      </div>

      <div className={m.dndPool} aria-label={t('a11y.characterTiles')}>
        {pool.map((tile) => (
          <button
            key={tile.id}
            type="button"
            draggable
            className={`${m.dndTile} ${picked === tile.id ? m.dndTilePicked : ''}`}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', tile.id)}
            onClick={() => setPicked((prev) => (prev === tile.id ? null : tile.id))}
          >
            {tile.char}
          </button>
        ))}
        {pool.length === 0 && <span className={m.dndPoolEmpty}>{t('a11y.allTilesPlaced')}</span>}
      </div>

      <div className={m.dndSlots}>
        {slots.map((tile, i) => (
          <div key={i} className={m.dndSlotWrap}>
            <button
              type="button"
              className={[
                m.dndSlot,
                tile ? m.dndSlotFilled : '',
                checked && tile ? (correctness[i] ? m.dndSlotCorrect : m.dndSlotWrong) : '',
              ].join(' ')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                placeTile(e.dataTransfer.getData('text/plain'), i);
              }}
              onClick={() => {
                if (picked) placeTile(picked, i);
                else if (tile) returnTile(i);
              }}
              aria-label={
                tile
                  ? t('practice.slotFilled', { index: i, char: tile.char })
                  : t('practice.slotEmpty', { index: i })
              }
            >
              {tile ? tile.char : ''}
            </button>
            <span className={m.dndSlotIndex}>{i}</span>
          </div>
        ))}
      </div>

      <div className={m.warmupFooter}>
        <button type="button" className={m.ghostButton} onClick={reset}>
          <RefreshCcw size={14} /> {t('practice.shuffleAgain')}
        </button>
        <button
          type="button"
          className={m.solidButton}
          onClick={() => setChecked(true)}
          disabled={!complete}
        >
          {t('practice.checkPlacement')}
        </button>
      </div>

      {checked && (
        <p className={`${m.warmupVerdict} ${allCorrect ? m.warmupVerdictOk : m.warmupVerdictNo}`}>
          {allCorrect
            ? <><CheckCircle2 size={15} /> {t('practice.warmupAllCorrect')}</>
            : <><XCircle size={15} /> {t('practice.warmupSomeWrong')}</>}
        </p>
      )}
    </div>
  );
}

// ─── section wrapper: fetches the module's exercise bank for Practice ─────────

export function PracticeSection({ practice, onSectionComplete }) {
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
            <span className={m.questionType}><MetaIcon size={13} /> {meta.label}</span>
            <span className={m.questionXp}>
              <Star size={13} /> {starsOf(exercise)} {starsOf(exercise) === 1 ? 'star' : 'stars'}
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
            {exercise.options.map((choice, i) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={answer?.selected === choice}
                className={`${m.choice} ${answer?.selected === choice ? m.choiceSelected : ''}`}
                onClick={() => setAnswer({ selected: choice })}
                disabled={Boolean(result)}
              >
                <span className={m.choiceKey}>{String.fromCharCode(65 + i)}</span>
                <span className={m.choiceText}>{displayOptionsOf(exercise, lang)[i]}</span>
              </button>
            ))}
          </div>
        )}

        {exercise.type === 'select_all' && (
          <div className={m.choiceList}>
            {exercise.options.map((choice, i) => {
              const on = (answer?.selected ?? []).includes(choice);
              return (
                <button
                  key={choice}
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
                {exercise.test_cases.map((tc, i) => (
                  <code key={i}>
                    {tc.input ? `input: ${tc.input.trim()} → ` : ''}{tc.expected_output}
                  </code>
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
