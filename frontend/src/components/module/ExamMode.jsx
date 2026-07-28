import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Award, CheckCircle2, ChevronLeft, ChevronRight, Eye,
  GraduationCap, RefreshCcw, Star, Target, TrendingUp, XCircle,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { apiFetch } from '../../api';
import { getApiUrl } from '../../config/api';
import { CodeExercise } from './CodeExercise';
import { CodeBlock, InlineText } from './ContentBlocks';
import { presetForExercise } from './visualizers/presets';
import { useLanguage } from '../../context/LanguageContext';

// ─────────────────────────────────────────────────────────────────────────────
// ExamMode — the test-conditions counterpart to the practice runner.
//
// Flow: a fixed selection of questions is drawn from the module bank; the
// student may answer and revisit them in any order (numbered palette), then
// submits ONCE. Every answer is graded through the real backend pipeline and
// a results screen shows score, percentage, stars, a mastery badge, the
// correct answers, per-question explanations and grouped areas to improve.
// ─────────────────────────────────────────────────────────────────────────────

const STAR_BANDS = [
  { min: 85, stars: 3, badge: 'Mastered', blurb: 'Exam-ready. You could teach this.' },
  { min: 70, stars: 2, badge: 'Proficient', blurb: 'Solid work, polish the last details below.' },
  { min: 50, stars: 1, badge: 'Developing', blurb: 'The foundations are there. Review the misses and retry.' },
  { min: 0, stars: 0, badge: 'Keep practising', blurb: 'Revisit the lesson above, then take another attempt.' },
];

// Friendly labels for misconception ids used in "areas for improvement".
const MISCONCEPTION_LABELS = {
  zero_index_start: 'Counting from zero',
  off_by_one_length: 'Off-by-one and len() bounds',
  negative_index_confusion: 'Negative indices',
  slice_stop_inclusive: 'Slice stop is excluded',
  negative_step_unfamiliar: 'Negative-step slices',
  immutability_in_place: 'Strings cannot change in place',
  method_mutates_target: 'Methods return new strings',
  comparison_ignores_case: 'Case sensitivity',
  strings_not_orderable_myth: 'Lexicographic comparison',
  string_number_equality_myth: 'Strings vs numbers',
  escape_sequence_literal_confusion: 'Escape sequences',
  count_vs_find_confusion: 'count() vs find()',
  count_overlap_confusion: 'Non-overlapping counting',
  fstring_missing_prefix_effect: 'The f-string prefix',
  strings_need_quotes: 'Quoting rules',
};

function labelForMisconception(id) {
  if (!id) return 'General accuracy';
  return MISCONCEPTION_LABELS[id]
    ?? id.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function starsOf(exercise) {
  return exercise?.stars ?? Math.max(1, Math.round((exercise?.xp ?? 10) / 10));
}

function blankAnswer(exercise) {
  if (exercise.type === 'mcq') return { selected: null };
  if (exercise.type === 'select_all') return { selected: [] };
  if (exercise.type === 'fill_blank') return { value: '' };
  if (exercise.type === 'write_code') {
    return { code: exercise.starter_code ?? '# Write your solution here\n' };
  }
  return {};
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

function describeStudentAnswer(exercise, answer) {
  if (!isAnswered(exercise, answer)) return '(not answered)';
  if (exercise.type === 'mcq') return answer.selected;
  if (exercise.type === 'select_all') return (answer.selected ?? []).join(', ');
  if (exercise.type === 'fill_blank') return answer.value;
  if (exercise.type === 'write_code') return null; // code shown in a block instead
  return '';
}

function describeCorrectAnswer(exercise) {
  if (exercise.type === 'select_all') return (exercise.answers ?? []).join(', ');
  if (exercise.type === 'write_code') {
    return (exercise.test_cases ?? [])
      .map((tc) => `${tc.input ? `input ${tc.input.trim()} → ` : ''}${tc.expected_output}`)
      .join('   ');
  }
  return exercise.answer ?? '';
}

function splitPrompt(prompt) {
  const [first, ...rest] = prompt.split('\n');
  return { title: first, code: rest.join('\n') };
}

function drawExam(exercises, count) {
  return shuffle(exercises).slice(0, Math.min(count, exercises.length));
}

export function ExamMode({ practice, exercises, onVisualize }) {
  const { t, lang } = useLanguage();
  const questionCount = practice.exam?.questionCount ?? 10;

  const [paper, setPaper] = useState(() => drawExam(exercises, questionCount));
  const [answers, setAnswers] = useState({});     // question_id → answer object
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState('answering'); // answering | confirm | submitting | results
  const [results, setResults] = useState({});      // question_id → grading result

  const exercise = paper[current];
  const answer = answers[exercise?.question_id] ?? blankAnswer(exercise ?? { type: 'mcq' });

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
      const a = answers[ex.question_id] ?? blankAnswer(ex);
      const payload = { module_id: ex.module_id, question_id: ex.question_id, lang };
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
        graded[ex.question_id] = { correct: false, feedback: 'Could not reach the server for this question.' };
      }
    }));
    setResults(graded);
    setPhase('results');
  }

  function handleSubmitClick() {
    if (answeredCount < paper.length) setPhase('confirm');
    else gradeAll();
  }

  function retry() {
    setPaper(drawExam(exercises, questionCount));
    setAnswers({});
    setResults({});
    setCurrent(0);
    setPhase('answering');
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
        const label = labelForMisconception(r.misconception_id);
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
          <div className={m.starRow} aria-label={`${band.stars} of 3 mastery stars`}>
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                size={30}
                className={n <= band.stars ? m.starOn : m.starOff}
              />
            ))}
          </div>
          <span className={m.masteryBadge}>
            <GraduationCap size={15} /> {band.badge}
          </span>
          <p className={m.examBlurb}>{band.blurb}</p>
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
                    <span>{count} {count === 1 ? 'question' : 'questions'} missed</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className={m.reviewStack}>
          <h4 className={m.reviewHeading}>{t('exercise.questionReview')}</h4>
          {paper.map((ex, i) => {
            const r = results[ex.question_id] ?? {};
            const a = answers[ex.question_id];
            const { title, code } = splitPrompt(ex.prompt);
            const studentAnswer = describeStudentAnswer(ex, a);
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
                    <dd>{describeCorrectAnswer(ex)}</dd>
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
                aria-label={`Question ${i + 1}${answered ? ', answered' : ', not answered'}`}
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
              <Star size={13} /> {starsOf(exercise)} {starsOf(exercise) === 1 ? 'star' : 'stars'}
            </span>
          </div>
          <div className={m.questionProgress}>
            <span>{t('exercise.question', { current: current + 1, total: paper.length })}</span>
          </div>
        </header>

        <h3 className={m.questionTitle}>{promptTitle}</h3>
        {promptCode && <CodeBlock code={promptCode} />}

        {exercise.type === 'mcq' && (
          <div className={m.choiceList} role="radiogroup" aria-label="Answer choices">
            {exercise.options.map((choice, i) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={answer.selected === choice}
                className={`${m.choice} ${answer.selected === choice ? m.choiceSelected : ''}`}
                onClick={() => setCurrentAnswer({ selected: choice })}
              >
                <span className={m.choiceKey}>{String.fromCharCode(65 + i)}</span>
                <span className={m.choiceText}>{choice}</span>
              </button>
            ))}
          </div>
        )}

        {exercise.type === 'select_all' && (
          <div className={m.choiceList}>
            {exercise.options.map((choice) => {
              const on = (answer.selected ?? []).includes(choice);
              return (
                <button
                  key={choice}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={`${m.choice} ${on ? m.choiceSelected : ''}`}
                  onClick={() => toggleOption(choice)}
                >
                  <span className={`${m.choiceBox} ${on ? m.choiceBoxOn : ''}`}>
                    {on && <CheckCircle2 size={14} />}
                  </span>
                  <span className={m.choiceText}>{choice}</span>
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
            aria-label="Your answer"
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
                {exercise.test_cases.map((tc, i) => (
                  <code key={i}>
                    {tc.input ? `input: ${tc.input.trim()} → ` : ''}{tc.expected_output}
                  </code>
                ))}
              </div>
            )}
          </>
        )}

        <footer className={m.questionFooter}>
          <div className={m.examNav}>
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
              className={m.ghostButton}
              onClick={() => setCurrent((c) => Math.min(paper.length - 1, c + 1))}
              disabled={current === paper.length - 1}
            >
              {t('common.next')} <ChevronRight size={15} />
            </button>
          </div>
          <button
            type="button"
            className={m.solidButton}
            onClick={handleSubmitClick}
            disabled={phase === 'submitting'}
          >
            {phase === 'submitting' ? t('exercise.marking') : t('exercise.submitExam')}
          </button>
        </footer>
      </div>

      {phase === 'confirm' && (
        <div className={m.confirmBanner} role="alertdialog" aria-label="Unanswered questions">
          <AlertTriangle size={18} />
          <div>
            <strong>{paper.length - answeredCount} unanswered {paper.length - answeredCount === 1 ? 'question' : 'questions'}</strong>
            <p>{t('exercise.unansweredWarning')}</p>
          </div>
          <div className={m.confirmActions}>
            <button type="button" className={m.ghostButton} onClick={() => setPhase('answering')}>
              {t('exercise.keepAnswering')}
            </button>
            <button type="button" className={m.solidButton} onClick={gradeAll}>
              <Target size={15} /> {t('exercise.submitNow')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
