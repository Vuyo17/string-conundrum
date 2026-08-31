import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Check, CheckCircle2, ChevronRight, RefreshCcw, Star, Target, X,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { apiFetch, markSectionComplete } from '../../api';
import { getApiUrl } from '../../config/api';
import { CodeExercise } from './CodeExercise';
import { CodeBlock, ContentBlocks, InlineText } from './ContentBlocks';
import { DragDropWarmup } from './DragDropWarmup';
import { useLanguage } from '../../context/LanguageContext';

// ─────────────────────────────────────────────────────────────────────────────
// PracticeEngine — endless, adaptive practice for any module that has
// adopted the procedural engine (currently Slicing and Indexing; see
// practice_engine_core.py on the backend for the shared machinery each
// module's own engine builds on).
//
// Unlike PracticeSection's PracticeRunner, this never runs out of
// questions: each one is generated on the fly by the backend
// (services/<module>_engine.py) rather than drawn from the static exercise
// bank, at /api/exercises/<practice.apiModuleId>/engine/*. Difficulty
// climbs on two axes at once — the question itself gets harder, and so
// does the way it's asked, from picking one of four up to writing runnable
// code. This component renders whichever answer format the backend sent
// (`question.type`) and submits the matching field; the backend's token
// decides the format, so the client cannot answer a hard question in an
// easy format. A format's own widget (SliceBuilder, IndexBuilder, ...) is
// specific to the module that uses it; everything else here -- the star
// rail, the five shared formats, the misconception tally sent back on
// every request -- is not.
//
// The star rail at the top IS the progress bar: each star sits at the end
// of the segment leading to it, and that segment fills as the student
// builds a streak, so "how close am I to the next one" is legible without
// a sentence spelling it out. Once all five are lit the rail stays full
// and the engine keeps asking, but only at the hardest tier — so there's
// always something harder to try, never a "you're done" screen unless the
// student ends the session themselves.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TIER = 5;
const CORRECT_TO_ADVANCE = 3;

function splitPrompt(prompt) {
  const [first, ...rest] = prompt.split('\n');
  return { title: first, code: rest.join('\n') };
}

// A slice can legitimately evaluate to '' (an empty string is a completely
// normal, examinable result) — render that option as readable text instead
// of a blank, clickable button, while still submitting the real value.
function displayOption(option) {
  return option === '' ? '(empty string)' : option;
}

// ─── per-format answer plumbing ──────────────────────────────────────────────
// Each format keeps its answer in its own shape and submits its own field
// name. Kept as three small lookups rather than one big switch inside the
// component so adding a format later is a local change.

function emptyAnswer(question) {
  if (!question) return null;
  switch (question.type) {
    case 'select_all': return { selected: [] };
    case 'fill_blank': return { value: '' };
    case 'build_slice': return { slice: { start: '', stop: '', step: '' } };
    case 'build_index': return { slice: { index: '' } };
    case 'write_code': return { code: question.starter_code ?? '' };
    default: return { selected: null };
  }
}

function canSubmit(question, answer) {
  if (!question || !answer) return false;
  switch (question.type) {
    case 'select_all': return (answer.selected ?? []).length > 0;
    // Deliberately always true: '' is a real slice result, and leaving every
    // bound blank is a real (wrong) slice — `word[:]`. Blocking submission
    // would quietly rule out answers the engine can actually ask for.
    case 'fill_blank': return true;
    case 'build_slice': return true;
    // Unlike a slice bound, a blank index isn't a meaningful (if wrong)
    // answer on its own -- there's nothing to grade.
    case 'build_index': return (answer.slice?.index ?? '').trim().length > 0;
    case 'write_code': return (answer.code ?? '').trim().length > 0;
    default: return answer.selected !== null;
  }
}

function submissionFor(question, answer) {
  switch (question.type) {
    case 'select_all': return { answers: answer.selected ?? [] };
    case 'fill_blank': return { answer: answer.value ?? '' };
    case 'build_slice': return { slice: answer.slice };
    case 'build_index': return { slice: answer.slice };
    case 'write_code': return { code: answer.code ?? '' };
    default: return { answer: answer.selected ?? '' };
  }
}

// ─── progress rail ───────────────────────────────────────────────────────────

function StarRail({ starsFilled, tierStreak, label }) {
  const maxed = starsFilled >= MAX_TIER;
  return (
    <div className={m.engineRailWrap} role="img" aria-label={label}>
      <ol className={m.engineRail}>
        {Array.from({ length: MAX_TIER }, (_, i) => i + 1).map((n) => {
          const earned = n <= starsFilled;
          const isNext = !maxed && n === starsFilled + 1;
          const pct = earned ? 100 : isNext ? (tierStreak / CORRECT_TO_ADVANCE) * 100 : 0;
          return (
            <li key={n} className={m.engineRailNode}>
              <span className={m.engineRailTrack}>
                <span
                  className={`${m.engineRailFill} ${earned ? m.engineRailFillDone : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <Star
                size={18}
                className={earned ? m.engineStarFilled : m.engineStarEmpty}
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── answer widgets, one per format ──────────────────────────────────────────

function ChoiceList({ question, answer, result, onChange }) {
  const { t } = useLanguage();
  const multi = question.type === 'select_all';
  const chosen = multi ? (answer.selected ?? []) : [answer.selected];

  // Once graded, the options mark themselves: the right one always turns
  // green, and a wrong pick turns red. Saying it on the options rather than
  // only in the banner means the student sees *which* answer was wrong
  // without re-reading their own selection.
  const correctSet = useMemo(() => {
    if (!result) return null;
    const raw = result.correct_answer ?? '';
    return new Set(multi ? raw.split(', ').filter(Boolean) : [raw]);
  }, [result, multi]);

  function toggle(choice) {
    if (!multi) return onChange({ selected: choice });
    const current = answer.selected ?? [];
    return onChange({
      selected: current.includes(choice)
        ? current.filter((c) => c !== choice)
        : [...current, choice],
    });
  }

  return (
    <div
      className={m.choiceList}
      role={multi ? 'group' : 'radiogroup'}
      aria-label={t('a11y.answerChoices')}
    >
      {question.options.map((choice, i) => {
        const picked = chosen.includes(choice);
        // A correct verdict always vindicates what the student picked, even
        // if `correct_answer` couldn't be matched back to an option — the
        // banner and the options must never disagree about the same answer.
        const isRight = (result?.correct && picked) || correctSet?.has(choice);
        // select_all questions often have more than one correct option (see
        // e.g. slicing_engine.py's KIND_IDENTIFY/EQUIVALENCE/ERROR, or
        // indexing_engine.py's KIND_IDENTIFY/ERROR): a student who
        // picks only some of them used to see every correct option painted
        // fully green with a checkmark badge regardless of whether they
        // picked it, which reads as "the app selected extra options I never
        // clicked." `missed` is that specific case — correct, but not
        // picked — kept visually distinct (outlined, not filled; a hollow
        // circle, not a solid check) from an option the student actually
        // chose, so the checkbox itself stays the only true record of what
        // was clicked.
        const missed = Boolean(result) && multi && isRight && !picked;
        const state = !result
          ? ''
          : missed ? m.engineChoiceMissed
          : isRight ? m.engineChoiceRight
          : picked ? m.engineChoiceWrong
          : '';
        return (
          <button
            key={`${choice}-${i}`}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={picked}
            className={`${m.choice} ${picked && !result ? m.choiceSelected : ''} ${state}`}
            onClick={() => toggle(choice)}
            disabled={Boolean(result)}
          >
            <span className={multi ? `${m.choiceBox} ${picked ? m.choiceBoxOn : ''}` : m.choiceKey}>
              {multi ? (picked && <Check size={13} />) : String.fromCharCode(65 + i)}
            </span>
            <span className={`${m.choiceText} ${choice === '' ? m.engineEmptyOption : ''}`}>
              {displayOption(choice)}
            </span>
            {result && missed && (
              <CheckCircle2
                size={16}
                className={m.engineChoiceMark}
                aria-label={t('practiceEngine.alsoCorrect')}
              />
            )}
            {result && !missed && isRight && <Check size={16} className={m.engineChoiceMark} />}
            {result && picked && !isRight && <X size={16} className={m.engineChoiceMark} />}
          </button>
        );
      })}
    </div>
  );
}

function FillBlank({ question, answer, result, onChange, onSubmit, inputRef }) {
  const { t } = useLanguage();
  // A correct answer that spans several output lines (a loop trace, or a
  // print() containing \n) can never be typed into a single-line <input>
  // — there's nowhere for Enter to put a newline. question.multiline
  // switches to a <textarea>, where Enter inserts a line instead of
  // submitting (submitting still needs the Check Answer button).
  const multiline = Boolean(question.multiline);
  return (
    <div className={m.engineBlankRow}>
      {/* A `trace` question has no expression to put an "=" after — the
          snippet above already asked it — so it sends a label instead. */}
      {question.expression ? (
        <>
          <code className={m.engineBlankExpr}>{question.expression}</code>
          <span className={m.engineBlankEquals} aria-hidden="true">=</span>
        </>
      ) : (
        <span className={m.engineBlankLabel}>{question.answer_label}</span>
      )}
      {multiline ? (
        <textarea
          ref={inputRef}
          className={m.engineBlankTextarea}
          value={answer.value ?? ''}
          onChange={(e) => onChange({ value: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(); }}
          placeholder={t('practiceEngine.typeResult')}
          disabled={Boolean(result)}
          aria-label={t('a11y.yourAnswer')}
          spellCheck={false}
          rows={3}
        />
      ) : (
        <input
          ref={inputRef}
          className={m.engineBlankInput}
          value={answer.value ?? ''}
          onChange={(e) => onChange({ value: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          placeholder={t('practiceEngine.typeResult')}
          disabled={Boolean(result)}
          aria-label={t('a11y.yourAnswer')}
          spellCheck={false}
          autoComplete="off"
        />
      )}
    </div>
  );
}

function SliceBuilder({ question, answer, result, onChange, onSubmit, inputRef }) {
  const { t } = useLanguage();
  const slice = answer.slice ?? { start: '', stop: '', step: '' };

  function set(part, value) {
    onChange({ slice: { ...slice, [part]: value } });
  }

  const box = (part, label, ref) => (
    <input
      ref={ref}
      className={m.engineBuilderInput}
      value={slice[part] ?? ''}
      onChange={(e) => set(part, e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
      disabled={Boolean(result)}
      aria-label={label}
      inputMode="numeric"
      placeholder="·"
      spellCheck={false}
      autoComplete="off"
    />
  );

  return (
    <div className={m.engineBuilder}>
      <code className={m.engineBuilderExpr}>
        {/* question.name, not a hardcoded "word": a field-based template
            (Section~sec:practiceengine) can name its entry `date`,
            `timestamp`, etc., and the box should match what the prompt
            above it actually calls the variable. */}
        <span className={m.engineBuilderToken}>{question.name ?? 'word'}[</span>
        {box('start', t('practiceEngine.startBound'), inputRef)}
        <span className={m.engineBuilderToken}>:</span>
        {box('stop', t('practiceEngine.stopBound'))}
        {question.allow_step && (
          <>
            <span className={m.engineBuilderToken}>:</span>
            {box('step', t('practiceEngine.stepBound'))}
          </>
        )}
        <span className={m.engineBuilderToken}>]</span>
      </code>
      <p className={m.engineBuilderHint}>{t('practiceEngine.builderHint')}</p>
    </div>
  );
}

function IndexBuilder({ question, answer, result, onChange, onSubmit, inputRef }) {
  const { t } = useLanguage();
  const slice = answer.slice ?? { index: '' };

  return (
    <div className={m.engineBuilder}>
      <code className={m.engineBuilderExpr}>
        <span className={m.engineBuilderToken}>{question.name ?? 'word'}[</span>
        <input
          ref={inputRef}
          className={m.engineBuilderInput}
          value={slice.index ?? ''}
          onChange={(e) => onChange({ slice: { index: e.target.value } })}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          disabled={Boolean(result)}
          aria-label={t('practiceEngine.indexValue')}
          inputMode="numeric"
          placeholder="·"
          spellCheck={false}
          autoComplete="off"
        />
        <span className={m.engineBuilderToken}>]</span>
      </code>
      <p className={m.engineBuilderHint}>{t('practiceEngine.builderHintIndex')}</p>
    </div>
  );
}

function WriteCode({ question, answer, result, onChange }) {
  const { t } = useLanguage();
  const sample = question.examples?.[0]?.word ?? '';
  return (
    <div className={m.engineCodeTask}>
      {question.examples?.length > 0 && (
        <div className={m.engineExamples}>
          <span className={m.engineExamplesLabel}>{t('practiceEngine.examplesLabel')}</span>
          {question.examples.map((ex) => (
            <code key={ex.word} className={m.engineExample}>
              <span className={m.engineExampleIn}>word = &quot;{ex.word}&quot;</span>
              <ChevronRight size={13} aria-hidden="true" />
              <span className={m.engineExampleOut}>{displayOption(ex.output)}</span>
            </code>
          ))}
        </div>
      )}
      <CodeExercise
        code={answer.code ?? ''}
        onCodeChange={(code) => onChange({ code })}
        disabled={Boolean(result)}
        prelude={sample ? `word = "${sample}"\n` : ''}
      />
    </div>
  );
}

// ─── the engine ──────────────────────────────────────────────────────────────

export function PracticeEngine({ practice, onSectionComplete }) {
  const { t, lang } = useLanguage();

  const [tier, setTier] = useState(1);
  const [starsFilled, setStarsFilled] = useState(0);
  const [tierStreak, setTierStreak] = useState(0);

  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [stats, setStats] = useState({ asked: 0, correct: 0, starsEarned: 0 });
  const [stopped, setStopped] = useState(false);

  // Module completion fires once, the first time the rail fills — not on
  // every question answered afterwards.
  const completedRef = useRef(false);
  const inputRef = useRef(null);

  // Which concepts this student keeps getting wrong, most-missed first. The
  // engine is stateless by design, so the tally lives here and rides along
  // with each request; the backend uses it to weight template selection
  // towards what needs the practice. Capped so one bad patch early in a
  // session doesn't dominate the rest of it.
  const missesRef = useRef(new Map());

  const weakConcepts = useCallback(() => {
    const ranked = [...missesRef.current.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([concept]) => concept);
    return ranked.join(',');
  }, []);

  // The engine's own endpoints live under /api/exercises/<module>/engine/*,
  // one pair per module that has adopted this engine (see
  // practice_engine_core.py on the backend) -- apiModuleId is already how
  // every other part of this component identifies which module it's
  // running for, so no separate config is needed to route to the right one.
  const engineBase = `/api/exercises/${practice.apiModuleId}/engine`;

  const loadNext = useCallback((forTier) => {
    setLoading(true);
    setLoadError('');
    setResult(null);
    const weak = encodeURIComponent(weakConcepts());
    fetch(getApiUrl(`${engineBase}/next?tier=${forTier}&weak=${weak}`))
      .then((res) => res.json())
      .then((data) => {
        setQuestion(data);
        setAnswer(emptyAnswer(data));
      })
      .catch(() => setLoadError('practice.serverUnreachable'))
      .finally(() => setLoading(false));
  }, [weakConcepts, engineBase]);

  useEffect(() => { loadNext(1); }, [loadNext]);

  // Typed formats get the caret placed for them: on a question that expects
  // keyboard input, having to click the box first is friction with no
  // upside. Keyed on the token so it fires once per question.
  useEffect(() => {
    if (!question || result) return;
    if (['fill_blank', 'build_slice', 'build_index'].includes(question.type)) {
      inputRef.current?.focus();
    }
  }, [question?.token, result]);

  useEffect(() => {
    if (starsFilled >= MAX_TIER && !completedRef.current) {
      completedRef.current = true;
      markSectionComplete(practice.apiModuleId, 'practice').then(() => onSectionComplete?.());
    }
  }, [starsFilled, practice.apiModuleId, onSectionComplete]);

  async function handleCheck() {
    if (!question || result || submitting || !canSubmit(question, answer)) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(getApiUrl(`${engineBase}/answer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: question.token, lang, ...submissionFor(question, answer) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ correct: false, feedback: t('exercise.markFailed') });
        return;
      }
      setResult(data);
      // Tally what went wrong so later questions can lean that way. The
      // backend tags every wrong answer with the concept behind it, and
      // falls back to the template's own concept when nothing matches.
      const missed = data.correct ? null : (data.misconception_id ?? data.concept);
      if (missed) {
        missesRef.current.set(missed, (missesRef.current.get(missed) ?? 0) + 1);
      }
      setStats((prev) => ({
        asked: prev.asked + 1,
        correct: prev.correct + (data.correct ? 1 : 0),
        starsEarned: prev.starsEarned + (data.stars_awarded ?? 0),
      }));

      if (data.correct) {
        const nextStreak = tierStreak + 1;
        if (nextStreak >= CORRECT_TO_ADVANCE && starsFilled < MAX_TIER) {
          setStarsFilled((s) => Math.min(MAX_TIER, s + 1));
          setTier((prevTier) => Math.min(MAX_TIER, prevTier + 1));
          setTierStreak(0);
        } else {
          setTierStreak(nextStreak);
        }
      } else {
        setTierStreak(0);
      }
    } catch {
      setResult({ correct: false, feedback: t('codeSpace.serverUnreachable') });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    loadNext(tier);
  }

  function handleRestart() {
    setTier(1);
    setStarsFilled(0);
    setTierStreak(0);
    setStats({ asked: 0, correct: 0, starsEarned: 0 });
    setStopped(false);
    completedRef.current = false;
    missesRef.current.clear();
    loadNext(1);
  }

  // ─── session summary, shown once the student ends the session ────────────
  if (stopped) {
    const accuracy = stats.asked ? Math.round((stats.correct / stats.asked) * 100) : 0;
    return (
      <div className={m.completionCard}>
        <span className={m.completionIcon}><Award size={30} /></span>
        <h3>{t('practiceEngine.summaryTitle')}</h3>
        <div className={m.engineSummaryStats}>
          <div className={m.engineSummaryStat}>
            <strong>{stats.asked}</strong>
            <span>{t('practiceEngine.asked')}</span>
          </div>
          <div className={m.engineSummaryStat}>
            <strong>{stats.correct}</strong>
            <span>{t('common.correct')}</span>
          </div>
          <div className={m.engineSummaryStat}>
            <strong>{accuracy}%</strong>
            <span>{t('exercise.percentage')}</span>
          </div>
          <div className={m.engineSummaryStat}>
            <strong>{stats.starsEarned}</strong>
            <span>{t('exercise.starsEarned')}</span>
          </div>
          <div className={m.engineSummaryStat}>
            <strong>{starsFilled}/{MAX_TIER}</strong>
            <span>{t('practiceEngine.tierReached')}</span>
          </div>
        </div>
        <p>
          {starsFilled >= MAX_TIER ? t('practiceEngine.summaryMaxed') : t('practiceEngine.summaryPartial')}
        </p>
        <div className={m.engineSummaryActions}>
          <button type="button" className={m.solidButton} onClick={handleRestart}>
            <RefreshCcw size={15} /> {t('practiceEngine.playAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (loading && !question) return <p className={m.practiceStatus}>{t('practice.loading')}</p>;
  if (loadError) return <p className={m.practiceStatus}>{t(loadError)}</p>;
  if (!question || !answer) return null;

  const { title, code } = splitPrompt(question.prompt);
  const tierMaxed = starsFilled >= MAX_TIER;

  // The rail replaced a line of text that used to spell the streak out. The
  // sentence still exists here so a screen reader hears the progress the
  // rail shows, rather than losing it along with the visual clutter.
  const railLabel = [
    t('practiceEngine.starsAria', { filled: starsFilled, total: MAX_TIER }),
    tierMaxed
      ? t('practiceEngine.tierBadgeMax')
      : t('practiceEngine.streakHint', { streak: tierStreak, needed: CORRECT_TO_ADVANCE }),
  ].join('. ');

  const shared = { question, answer, result, onChange: setAnswer, onSubmit: handleCheck, inputRef };

  return (
    <div className={m.runnerStack}>
      {/* Same condition the static bank's PracticeRunner uses ("only before
          the very first question"), translated to this engine's own idea
          of "first": there's no fixed index here, just an endless stream,
          so stats.asked === 0 is the equivalent -- true until the first
          question of the session has actually been answered. */}
      {practice.warmup?.type === 'drag_drop' && stats.asked === 0 && !result && (
        <DragDropWarmup config={practice.warmup} />
      )}

      <div className={m.engineCard}>
        <StarRail starsFilled={starsFilled} tierStreak={tierStreak} label={railLabel} />

        <div className={m.engineBody}>
          <h3 className={m.questionTitle}><InlineText text={title} /></h3>
          {code && <CodeBlock code={code} />}

          {question.type === 'fill_blank' && <FillBlank {...shared} />}
          {question.type === 'build_slice' && <SliceBuilder {...shared} />}
          {question.type === 'build_index' && <IndexBuilder {...shared} />}
          {question.type === 'write_code' && <WriteCode {...shared} />}
          {(question.type === 'mcq' || question.type === 'select_all') && <ChoiceList {...shared} />}

          <div aria-live="polite">
            {result && (
              <>
                <div className={`${m.feedbackBanner} ${result.correct ? m.feedbackOk : m.feedbackNo}`}>
                  <span className={m.feedbackIcon}>
                    {result.correct ? <CheckCircle2 size={18} /> : <Target size={18} />}
                  </span>
                  <div>
                    <strong>{result.correct ? t('exercise.correctHeading') : t('exercise.notQuite')}</strong>
                    <p><InlineText text={result.feedback ?? ''} /></p>
                    {/* The rich worked example below replaces this one-line
                        "Why" for whichever kinds build one (only Slicing's
                        evaluate kind so far — see slicing_engine.py's
                        _build_slice_explanation); every other kind/module
                        still falls back to this plain-text line. */}
                    {result.explanation && !result.explanation_blocks && (
                      <p className={m.feedbackExplanation}>
                        <strong>{t('common.why')}</strong> <InlineText text={result.explanation} />
                      </p>
                    )}
                  </div>
                </div>
                {result.explanation_blocks && (
                  <div className={m.engineWorkedExample}>
                    <h4 className={m.engineWorkedExampleTitle}>{t('practiceEngine.workedExample')}</h4>
                    <ContentBlocks blocks={result.explanation_blocks} />
                  </div>
                )}
              </>
            )}
          </div>

          <footer className={m.questionFooter}>
            <button type="button" className={m.engineEndButton} onClick={() => setStopped(true)}>
              {t('practiceEngine.endSession')}
            </button>
            {!result ? (
              <button
                type="button"
                className={m.solidButton}
                onClick={handleCheck}
                disabled={!canSubmit(question, answer) || submitting}
              >
                {submitting ? t('exercise.checking') : t('exercise.checkAnswer')}
              </button>
            ) : (
              <button type="button" className={m.solidButton} onClick={handleNext} autoFocus>
                {t('exercise.nextQuestion')} <ChevronRight size={15} />
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
