import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award, CheckCircle2, ChevronRight, Flame, Gauge, RefreshCcw,
  SquareStop, Star, Target,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { apiFetch, markSectionComplete } from '../../api';
import { getApiUrl } from '../../config/api';
import { CodeBlock, InlineText } from './ContentBlocks';
import { useLanguage } from '../../context/LanguageContext';

// ─────────────────────────────────────────────────────────────────────────────
// SlicingEngine — endless practice for the Slicing module.
//
// Unlike PracticeSection's PracticeRunner, this never runs out of
// questions: each one is generated on the fly by the backend
// (services/slicing_engine.py) rather than drawn from the static exercise
// bank. The five-star row above the question IS the progress bar — one
// star fills, and the difficulty steps up, every time the student clears
// CORRECT_TO_ADVANCE questions in a row. Once all five are lit the bar
// stays full and the engine keeps asking, but only at the hardest tier —
// so there's always something harder to try, never a "you're done" screen
// unless the student presses Stop themselves.
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

export function SlicingEngine({ practice, onSectionComplete }) {
  const { t, lang } = useLanguage();

  const [tier, setTier] = useState(1);
  const [starsFilled, setStarsFilled] = useState(0);
  const [tierStreak, setTierStreak] = useState(0);

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [stats, setStats] = useState({ asked: 0, correct: 0, starsEarned: 0 });
  const [stopped, setStopped] = useState(false);

  // Module completion fires once, the first time the bar fills — not on
  // every question answered afterwards.
  const completedRef = useRef(false);

  const loadNext = useCallback((forTier) => {
    setLoading(true);
    setLoadError('');
    setSelected(null);
    setResult(null);
    fetch(getApiUrl(`/api/exercises/slicing/engine/next?tier=${forTier}`))
      .then((res) => res.json())
      .then((data) => setQuestion(data))
      .catch(() => setLoadError('practice.serverUnreachable'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadNext(1); }, [loadNext]);

  useEffect(() => {
    if (starsFilled >= MAX_TIER && !completedRef.current) {
      completedRef.current = true;
      markSectionComplete(practice.apiModuleId, 'practice').then(() => onSectionComplete?.());
    }
  }, [starsFilled, practice.apiModuleId, onSectionComplete]);

  async function handleCheck() {
    if (!question || selected === null) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(getApiUrl('/api/exercises/slicing/engine/answer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: question.token, answer: selected, lang }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ correct: false, feedback: t('exercise.markFailed') });
        return;
      }
      setResult(data);
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
    loadNext(1);
  }

  // ─── session summary, shown once the student presses Stop ────────────────
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
  if (!question) return null;

  const { title, code } = splitPrompt(question.prompt);
  const tierMaxed = starsFilled >= MAX_TIER;

  return (
    <div className={m.runnerStack}>
      <div className={m.engineTopBar}>
        <div
          className={m.engineStarRow}
          role="img"
          aria-label={t('practiceEngine.starsAria', { filled: starsFilled, total: MAX_TIER })}
        >
          {Array.from({ length: MAX_TIER }, (_, i) => i + 1).map((n) => (
            <Star key={n} size={22} className={n <= starsFilled ? m.engineStarFilled : m.engineStarEmpty} />
          ))}
        </div>

        <div className={m.engineMeta}>
          {!tierMaxed ? (
            <span className={m.engineTierBadge}>
              <Gauge size={13} /> {t('practiceEngine.tierBadge', { tier, max: MAX_TIER })}
            </span>
          ) : (
            <span className={`${m.engineTierBadge} ${m.engineTierBadgeMax}`}>
              <Flame size={13} /> {t('practiceEngine.tierBadgeMax')}
            </span>
          )}
          <button type="button" className={`${m.ghostButton} ${m.engineStopButton}`} onClick={() => setStopped(true)}>
            <SquareStop size={15} /> {t('practiceEngine.stop')}
          </button>
        </div>
      </div>

      {!tierMaxed && (
        <span className={m.engineStreakHint}>
          {t('practiceEngine.streakHint', { streak: tierStreak, needed: CORRECT_TO_ADVANCE })}
        </span>
      )}

      <div className={m.engineStatsRow}>
        <span><strong>{stats.correct}</strong> / {stats.asked} {t('practiceEngine.correctSoFar')}</span>
        <span><Star size={13} className={m.inlineStar} /> <strong>{stats.starsEarned}</strong> {t('exercise.starsEarned')}</span>
      </div>

      <div className={m.questionCard}>
        <header className={m.questionHeader}>
          <div className={m.questionMeta}>
            <span className={m.questionType}>
              <Gauge size={13} /> {t('practiceEngine.tierBadge', { tier: question.tier, max: MAX_TIER })}
            </span>
            <span className={m.questionXp}>
              <Star size={13} /> {question.stars} {question.stars === 1 ? 'star' : 'stars'}
            </span>
          </div>
        </header>

        <h3 className={m.questionTitle}>{title}</h3>
        {code && <CodeBlock code={code} />}

        <div className={m.choiceList} role="radiogroup" aria-label={t('a11y.answerChoices')}>
          {question.options.map((choice, i) => (
            <button
              key={`${choice}-${i}`}
              type="button"
              role="radio"
              aria-checked={selected === choice}
              className={`${m.choice} ${selected === choice ? m.choiceSelected : ''}`}
              onClick={() => setSelected(choice)}
              disabled={Boolean(result) || loading}
            >
              <span className={m.choiceKey}>{String.fromCharCode(65 + i)}</span>
              <span className={`${m.choiceText} ${choice === '' ? m.engineEmptyOption : ''}`}>
                {displayOption(choice)}
              </span>
            </button>
          ))}
        </div>

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
          {!result ? (
            <button
              type="button"
              className={m.solidButton}
              onClick={handleCheck}
              disabled={selected === null || submitting}
            >
              {submitting ? t('exercise.checking') : t('exercise.checkAnswer')}
            </button>
          ) : (
            <button type="button" className={m.solidButton} onClick={handleNext}>
              {t('exercise.nextQuestion')} <ChevronRight size={15} />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
