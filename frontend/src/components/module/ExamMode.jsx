import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, CheckCircle2, ChevronLeft, ChevronRight, Dumbbell, Eye,
  GraduationCap, RefreshCcw, Star, TrendingUp, XCircle,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { apiFetch, markSectionComplete, recordExamResult } from '../../api';
import { getApiUrl } from '../../config/api';

// The bar for a module to unlock the next one. Deliberately independent of
// Practice's own pass bar below — module completion no longer requires
// Practice at all, only Learn/Examples/Visualize exposure plus this Exam
// score. Also independent of the "Proficient" star band further down, which
// rates skill level and isn't the unlock gate.
const PASS_THRESHOLD = 80;
import { CodeExercise } from './CodeExercise';
import { CodeBlock, InlineText } from './ContentBlocks';
import { presetForExercise } from './visualizers/presets';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  starsOf, splitPrompt, displayOptionsOf, defaultAnswer, optionOrder,
} from './exerciseHelpers';
import { drawExam } from './examQuestions';

// ─────────────────────────────────────────────────────────────────────────────
// ExamMode — the test-conditions counterpart to the practice runner.
//
// Flow: a fixed selection of questions is drawn from the module bank; the
// student may answer and revisit them in any order (numbered palette), then
// submits ONCE. Every answer is graded through the real backend pipeline and
// a results screen shows score, percentage, stars, a mastery badge, the
// correct answers, per-question explanations and grouped areas to improve.
// ─────────────────────────────────────────────────────────────────────────────

// badge/blurb are translation keys under exercise.masteryBadge / .masteryBlurb,
// not display text — t() resolves them at render time so this list itself
// never needs to change per language.
const STAR_BANDS = [
  { min: 85, stars: 3, badge: 'mastered', blurb: 'mastered' },
  { min: 70, stars: 2, badge: 'proficient', blurb: 'proficient' },
  { min: 50, stars: 1, badge: 'developing', blurb: 'developing' },
  { min: 0, stars: 0, badge: 'keepPractising', blurb: 'keepPractising' },
];

// Friendly labels for misconception ids used in "areas for improvement",
// resolved through exercise.misconceptions.<id> so they translate like
// everything else. Falls back to a de-slugged id for any id that shows up
// in the exercise bank without a matching translation key yet.
function labelForMisconception(id, t) {
  if (!id) return t('exercise.generalAccuracy');
  const key = `exercise.misconceptions.${id}`;
  const translated = t(key);
  return translated === key
    ? id.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
    : translated;
}

function isAnswered(exercise, answer) {
  if (!answer) return false;
  if (exercise.type === 'mcq') return Boolean(answer.selected);
  if (exercise.type === 'select_all') return (answer.selected ?? []).length > 0;
  if (exercise.type === 'fill_blank') return (answer.value ?? '').trim().length > 0;
  if (exercise.type === 'write_code') {
    const code = (answer.code ?? '').trim();
    return code.length > 0 && code !== (exercise.starter_code ?? '').trim();
  }
  return false;
}

// Text shown for each option, in the student's language. The VALUE used for
// selection state and submission is always `exercise.options[i]` (English) —
// grading compares against that verbatim, so only the label may translate.
// `lang` is required, not optional: keying off "a translation exists" alone
// rendered isiXhosa option labels to English readers, because the API ships
// options_xh alongside the English options in both languages.
// Maps an English option value (as stored in `answer.selected`) back to its
// translated label for display, falling back to the value itself.
function displayFor(exercise, value, lang) {
  const i = (exercise.options ?? []).indexOf(value);
  if (i === -1) return value;
  return displayOptionsOf(exercise, lang)[i];
}

function describeStudentAnswer(exercise, answer, lang, t) {
  if (!isAnswered(exercise, answer)) return t('exercise.notAnswered');
  if (exercise.type === 'mcq') return displayFor(exercise, answer.selected, lang);
  if (exercise.type === 'select_all') {
    return (answer.selected ?? []).map((v) => displayFor(exercise, v, lang)).join(', ');
  }
  if (exercise.type === 'fill_blank') return answer.value;
  if (exercise.type === 'write_code') return null; // code shown in a block instead
  return '';
}

function describeCorrectAnswer(exercise, lang) {
  if (exercise.type === 'select_all') {
    return (exercise.answers ?? []).map((v) => displayFor(exercise, v, lang)).join(', ');
  }
  if (exercise.type === 'write_code') {
    return (exercise.test_cases ?? [])
      .map((tc) => `${tc.input ? `input ${tc.input.trim()} → ` : ''}${tc.expected_output}`)
      .join('   ');
  }
  if (exercise.type === 'mcq') {
    // Same trap as the option labels: answer_xh unconditionally won, so the
    // review screen showed the isiXhosa answer key in English mode.
    if (lang === 'xh' && exercise.answer_xh) return exercise.answer_xh;
    return exercise.answer || '';
  }
  return exercise.answer ?? '';
}

export function ExamMode({ practice, exercises, onVisualize, onSectionComplete, onGoToPractice }) {
  const { t, lang } = useLanguage();
  const { addNotification } = useNotifications();
  const questionCount = practice.exam?.questionCount ?? 10;
  const balanceTypes = practice.exam?.balanceTypes ?? false;

  const [paper, setPaper] = useState(() => drawExam(exercises, questionCount, balanceTypes));
  const [answers, setAnswers] = useState({});     // question_id → answer object
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState('answering'); // answering | submitting | results
  const [results, setResults] = useState({});      // question_id → grading result

  // Switching language refetches the bank, but `paper` held the objects drawn
  // at mount — so the questions stayed in the language they were fetched in
  // while the surrounding UI switched, which is what made English mode show
  // isiXhosa questions. Re-point each slot at the new object by question_id
  // rather than redrawing: a redraw mid-exam would swap the questions out
  // from under the student and discard their answers.
  useEffect(() => {
    if (!exercises.length) return;
    setPaper((prev) => {
      if (!prev.length) return drawExam(exercises, questionCount, balanceTypes);
      const byId = new Map(exercises.map((ex) => [ex.question_id, ex]));
      return prev.map((ex) => byId.get(ex.question_id) ?? ex);
    });
  }, [exercises]);

  // Which sitting this is. Incremented by retry(), and compared against
  // recordedSittingRef below so one paper is recorded exactly once -- React
  // re-runs this effect in StrictMode, and without the guard every exam would
  // be written to the database twice in development.
  const [sitting, setSitting] = useState(0);
  const recordedSittingRef = useRef(-1);
  const startedAtRef = useRef(Date.now());

  // The exam only counts toward module progress once cleared at PASS_THRESHOLD
  // in one sitting; "Retry with new questions" can re-trigger this.
  useEffect(() => {
    if (phase !== 'results') return;
    const correctCount = paper.filter((ex) => results[ex.question_id]?.correct).length;
    const percent = Math.round((correctCount / paper.length) * 100);

    // Store the mark. Until this existed the percentage was computed here,
    // shown on the results screen, and lost the moment the student navigated
    // away -- so "what did this student score?" had no answer anywhere in the
    // system. Counts are sent rather than the percentage; the server derives
    // the mark itself (see /api/exams/submit).
    if (recordedSittingRef.current !== sitting) {
      recordedSittingRef.current = sitting;
      recordExamResult({
        moduleId: practice.apiModuleId,
        correctCount,
        totalCount: paper.length,
        stars: paper.reduce(
          (sum, ex) => sum + (results[ex.question_id]?.correct ? starsOf(ex) : 0), 0,
        ),
        durationSeconds: Math.round((Date.now() - startedAtRef.current) / 1000),
      });
    }

    if (percent >= PASS_THRESHOLD) {
      markSectionComplete(practice.apiModuleId, 'exam').then(() => onSectionComplete?.());
      addNotification({
        title: t('notifications.examPassedTitle'),
        message: t('notifications.examPassedMessage', {
          percent,
          module: practice.moduleTitle ?? t(`modules.items.${practice.apiModuleId}.title`),
        }),
      });
    }
  }, [phase]);

  const exercise = paper[current];
  const answer = answers[exercise?.question_id] ?? defaultAnswer(exercise ?? { type: 'mcq' });

  // Recomputed only when the question changes, not on every render — the
  // exam re-renders on every keystroke/click, and reshuffling then would
  // move choices under the student mid-answer.
  const order = useMemo(() => optionOrder(exercise ?? {}), [exercise?.question_id]);

  const answeredCount = useMemo(
    () => paper.filter((ex) => isAnswered(ex, answers[ex.question_id])).length,
    [paper, answers],
  );

  function setCurrentAnswer(next) {
    setAnswers((prev) => ({ ...prev, [exercise.question_id]: next }));
  }

  function toggleOption(option) {
    const selected = answer.selected ?? [];
    setCurrentAnswer({
      selected: selected.includes(option)
        ? selected.filter((o) => o !== option)
        : [...selected, option],
    });
  }

  async function gradeAll() {
    setPhase('submitting');
    const graded = {};
    await Promise.all(paper.map(async (ex) => {
      const a = answers[ex.question_id] ?? defaultAnswer(ex);
      // `exam: true` only changes how the attempt is LOGGED (source='exam'),
      // never how it is graded -- an exam answer and a practice answer to the
      // same question are marked by exactly the same code. It is what lets
      // the dashboard say whether a question's difficulty figure describes
      // test conditions or open practice.
      const payload = {
        module_id: ex.module_id, question_id: ex.question_id, lang, exam: true,
      };
      if (ex.type === 'mcq') payload.answer = a.selected ?? '';
      if (ex.type === 'fill_blank') payload.answer = a.value ?? '';
      if (ex.type === 'select_all') payload.answers = a.selected ?? [];
      if (ex.type === 'write_code') payload.code = a.code ?? '';
      try {
        const res = await apiFetch(getApiUrl('/api/exercises/submit'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        // A rejected request still parses as JSON, so check the status rather
        // than letting an unmarked question look like a wrong answer.
        graded[ex.question_id] = res.ok
          ? data
          : { correct: false, feedback: t('exercise.markFailed') };
      } catch {
        graded[ex.question_id] = { correct: false, feedback: t('exercise.markFailed') };
      }
    }));
    setResults(graded);
    setPhase('results');
  }

  function handleSubmitClick() {
    // Submit is now hard-disabled (see the pager button below) until every
    // question is answered, so this only ever fires on a complete paper.
    // Previously this branched into a "3 unanswered — submit anyway?"
    // confirm step; that path is gone now that the button itself blocks an
    // incomplete submission rather than asking about it after the fact.
    gradeAll();
  }

  function retry() {
    setPaper(drawExam(exercises, questionCount, balanceTypes));
    setAnswers({});
    setResults({});
    setCurrent(0);
    setPhase('answering');
    // A retake is a separate sitting: it gets its own row, its own timer, and
    // never overwrites the earlier mark. The dashboard reports each student's
    // best sitting, so retrying and doing worse cannot cost them anything.
    setSitting((n) => n + 1);
    startedAtRef.current = Date.now();
  }

  // ─── results screen ─────────────────────────────────────────────────────────
  if (phase === 'results') {
    const correct = paper.filter((ex) => results[ex.question_id]?.correct);
    const percent = Math.round((correct.length / paper.length) * 100);
    const band = STAR_BANDS.find((b) => percent >= b.min);
    const earnedStars = correct.reduce((sum, ex) => sum + starsOf(ex), 0);

    const weakAreas = {};
    paper.forEach((ex) => {
      const r = results[ex.question_id];
      if (r && !r.correct) {
        const label = labelForMisconception(r.misconception_id, t);
        weakAreas[label] = (weakAreas[label] ?? 0) + 1;
      }
    });

    return (
      <div className={m.examResults}>
        <div className={m.examScoreCard}>
          <span className={m.completionIcon}><Award size={30} /></span>
          <h3>{t('exercise.examComplete')}</h3>
          <div className={m.examScoreRow}>
            <div className={m.examScoreStat}>
              <strong>{correct.length} / {paper.length}</strong>
              <span>{t('exercise.score')}</span>
            </div>
            <div className={m.examScoreStat}>
              <strong>{percent}%</strong>
              <span>{t('exercise.percentage')}</span>
            </div>
            <div className={m.examScoreStat}>
              <strong>{earnedStars} <Star size={16} className={m.inlineStar} /></strong>
              <span>{t('exercise.starsEarned')}</span>
            </div>
          </div>
          <div className={m.starRow} aria-label={t('a11y.masteryStars', { stars: band.stars })}>
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                size={30}
                className={n <= band.stars ? m.starOn : m.starOff}
              />
            ))}
          </div>
          <span className={m.masteryBadge}>
            <GraduationCap size={15} /> {t(`exercise.masteryBadge.${band.badge}`)}
          </span>
          <p className={m.examBlurb}>{t(`exercise.masteryBlurb.${band.blurb}`)}</p>
          {/* cycle-1 usability feedback: "Finish module" gave no indication
              of whether the 80% bar was actually cleared, or what to do if
              not — Practice already has this same passed/retry line, Exam
              never did. */}
          <p className={m.examBlurb}>
            {percent >= PASS_THRESHOLD
              ? t('exercise.examPassed')
              : t('exercise.examRetry')}
          </p>
          <button type="button" className={m.solidButton} onClick={retry}>
            <RefreshCcw size={15} /> {t('exercise.retryNewQuestions')}
          </button>
        </div>

        {Object.keys(weakAreas).length > 0 && (
          <div className={m.improveCard}>
            <h4><TrendingUp size={16} /> {t('exercise.areasForImprovement')}</h4>
            <ul>
              {Object.entries(weakAreas)
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => (
                  <li key={label}>
                    <strong>{label}</strong>
                    <span>{t('exercise.questionsMissed', { count })}</span>
                  </li>
                ))}
            </ul>
            {/* Cycle-1 feedback asked for the tool to point students at more
                practice on what they got wrong. The weak areas were already
                identified here but were a dead end — this turns them into a
                route back into Practice, which draws from the same bank the
                missed questions came from. */}
            {onGoToPractice && (
              <button type="button" className={m.ghostButton} onClick={onGoToPractice}>
                <Dumbbell size={15} /> {t('exercise.practiceTheseAreas')}
              </button>
            )}
          </div>
        )}

        <div className={m.reviewStack}>
          <h4 className={m.reviewHeading}>{t('exercise.questionReview')}</h4>
          {paper.map((ex, i) => {
            const r = results[ex.question_id] ?? {};
            const a = answers[ex.question_id];
            const { title, code } = splitPrompt(ex.prompt);
            const studentAnswer = describeStudentAnswer(ex, a, lang, t);
            // Offer the visualizer only where we can actually load the
            // question into it, and only where it would teach something.
            const preset = r.correct || !onVisualize ? null : presetForExercise(ex, a);
            return (
              <div
                key={ex.question_id}
                className={`${m.reviewCard} ${r.correct ? m.reviewCorrect : m.reviewWrong}`}
              >
                <header>
                  <span className={m.reviewIndex}>{i + 1}</span>
                  <span className={m.reviewVerdict}>
                    {r.correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {r.correct ? t('common.correct') : t('common.incorrect')}
                  </span>
                  <span className={m.reviewStars}>
                    <Star size={13} /> {r.correct ? starsOf(ex) : 0}/{starsOf(ex)}
                  </span>
                </header>
                <p className={m.reviewPrompt}><InlineText text={title} /></p>
                {code && <CodeBlock code={code} />}
                {ex.type === 'write_code' && a?.code && (
                  <CodeBlock code={a.code} caption={t('exercise.yourCode')} />
                )}
                <dl className={m.reviewAnswers}>
                  {studentAnswer !== null && (
                    <div>
                      <dt>{t('common.yourAnswer')}</dt>
                      <dd>{studentAnswer}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{ex.type === 'write_code' ? t('exercise.expectedOutput') : t('common.correctAnswer')}</dt>
                    <dd>{describeCorrectAnswer(ex, lang)}</dd>
                  </div>
                </dl>
                {!r.correct && r.feedback && (
                  <p className={m.reviewFeedback}>
                    <InlineText text={r.feedback} />
                  </p>
                )}
                {(r.explanation ?? ex.explanation) && (
                  <p className={m.reviewExplanation}>
                    <strong className={m.reviewWhy}>{t('common.why')}</strong>{' '}
                    <InlineText text={r.explanation ?? ex.explanation} />
                  </p>
                )}
                {preset && (
                  <div className={m.reviewActions}>
                    <button
                      type="button"
                      className={m.ghostButton}
                      onClick={() => onVisualize(preset)}
                    >
                      <Eye size={15} /> {t('exercise.watchInVisualizer')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── answering / confirm / submitting ───────────────────────────────────────
  const { title: promptTitle, code: promptCode } = splitPrompt(exercise.prompt);

  return (
    <div className={m.examStack}>
      <div className={m.examToolbar}>
        <span className={m.examProgressLabel}>
          {t('exercise.answered', { count: answeredCount, total: paper.length })}
        </span>
        <div className={m.examPalette} role="tablist" aria-label={t('exercise.exam')}>
          {paper.map((ex, i) => {
            const answered = isAnswered(ex, answers[ex.question_id]);
            return (
              <button
                key={ex.question_id}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={t(
                  answered ? 'a11y.questionAnswered' : 'a11y.questionNotAnswered',
                  { number: i + 1 },
                )}
                className={[
                  m.examPaletteItem,
                  answered ? m.examPaletteAnswered : '',
                  i === current ? m.examPaletteCurrent : '',
                ].join(' ')}
                onClick={() => setCurrent(i)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className={m.questionCard}>
        <header className={m.questionHeader}>
          <div className={m.questionMeta}>
            <span className={m.questionType}><GraduationCap size={13} /> {t('exercise.examQuestion')}</span>
            <span className={m.questionXp}>
              <Star size={13} /> {starsOf(exercise)} {t('exercise.starUnit')}
            </span>
          </div>
          <div className={m.questionProgress}>
            <span>{t('exercise.question', { current: current + 1, total: paper.length })}</span>
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
                  aria-checked={answer.selected === choice}
                  className={`${m.choice} ${answer.selected === choice ? m.choiceSelected : ''}`}
                  onClick={() => setCurrentAnswer({ selected: choice })}
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
              const on = (answer.selected ?? []).includes(choice);
              return (
                <button
                  key={i}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={`${m.choice} ${on ? m.choiceSelected : ''}`}
                  onClick={() => toggleOption(choice)}
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
            value={answer.value ?? ''}
            onChange={(e) => setCurrentAnswer({ value: e.target.value })}
            placeholder={t('exercise.typeAnswer')}
            aria-label={t('a11y.yourAnswer')}
          />
        )}

        {exercise.type === 'write_code' && (
          <>
            <CodeExercise
              code={answer.code ?? ''}
              onCodeChange={(code) => setCurrentAnswer({ code })}
            />
            {exercise.test_cases?.length > 0 && (
              <div className={m.testCases}>
                <span className={m.testCasesLabel}>{t('exercise.expectedOutput')}</span>
                {/* One labelled row per case rather than a wrapping row of
                    bare chips: cycle-1 feedback asked for expected output to
                    be clearer, and inline `input: x → y` chips lost which
                    half was which as soon as they wrapped. */}
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

        <footer className={m.questionFooter}>
          <button
            type="button"
            className={m.ghostButton}
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            <ChevronLeft size={15} /> {t('common.previous')}
          </button>
          <button
            type="button"
            className={m.solidButton}
            onClick={handleSubmitClick}
            disabled={phase === 'submitting' || answeredCount < paper.length}
            title={answeredCount < paper.length ? t('exercise.answerAllToSubmit') : undefined}
          >
            {phase === 'submitting' ? t('exercise.marking') : t('exercise.submitExam')}
          </button>
          <button
            type="button"
            className={m.ghostButton}
            onClick={() => setCurrent((c) => Math.min(paper.length - 1, c + 1))}
            disabled={current === paper.length - 1}
          >
            {t('common.next')} <ChevronRight size={15} />
          </button>
        </footer>
      </div>
    </div>
  );
}
