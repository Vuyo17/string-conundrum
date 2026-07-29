import React from 'react';
import { Target } from 'lucide-react';
import styles from '../styles/App.module.css';
import { useLanguage } from '../context/LanguageContext';

// The placeholders are translated; the answers themselves are the learner's own
// text or authored code, so they pass through untouched.
function renderSubmittedAnswer(exercise, submitted, t) {
  if (!exercise || !submitted) return '-';
  if (exercise.type === 'mcq' || exercise.type === 'fill_blank') {
    return submitted.answer || t('feedback.noAnswer');
  }
  if (exercise.type === 'select_all') {
    return (submitted.answers ?? []).join(', ') || t('feedback.noneSelected');
  }
  if (exercise.type === 'write_code') return submitted.code || t('feedback.noCode');
  return '-';
}

function renderCorrectAnswer(exercise, t) {
  if (!exercise) return '-';
  if (exercise.type === 'mcq' || exercise.type === 'fill_blank') return exercise.answer;
  if (exercise.type === 'select_all') return (exercise.answers ?? []).join(', ');
  if (exercise.type === 'write_code') return t('feedback.anyPassingCode');
  return '-';
}

export function Feedback({ lastAttempt }) {
  const { t } = useLanguage();

  if (!lastAttempt) {
    return (
      <div className={styles.card} style={{ maxWidth: 640 }}>
        <p className={styles.emptyState}>{t('feedback.empty')}</p>
      </div>
    );
  }

  const { exercise, result, submitted } = lastAttempt;

  return (
    <div className={styles.feedbackLayout}>
      <section className={styles.card}>
        <h3>{t('feedback.yourAnswer')}</h3>
        <p className={styles.answerBox}>{renderSubmittedAnswer(exercise, submitted, t)}</p>
        <h3>{t('feedback.correctAnswer')}</h3>
        <p className={styles.answerBox}>{renderCorrectAnswer(exercise, t)}</p>
      </section>

      <section className={result.correct ? styles.feedbackSuccess : styles.misconceptionCard}>
        {result.correct ? (
          <>
            <div className={styles.errorPill} style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              {t('feedback.correctPill')}
            </div>
            <h2>{t('feedback.nicelyDone')}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
              {result.feedback}
            </p>
          </>
        ) : (
          <>
            <div className={styles.errorPill}>{t('feedback.incorrectPill')}</div>
            <h2>{t('feedback.misconceptionDetected')}</h2>
            {result.misconception_id && (
              <p><strong>{result.misconception_id.replaceAll('_', ' ')}</strong></p>
            )}
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
              {result.feedback}
            </p>
            <h3 style={{ marginTop: '20px' }}>{t('feedback.recommendedNextStep')}</h3>
            <button className={styles.primaryButton} style={{ marginTop: '4px' }}>
              <Target size={15} />{' '}
              {t('feedback.practiceModule', {
                module: exercise?.module_id
                  ? t(`modules.items.${exercise.module_id}.title`)
                  : t('feedback.thisModule'),
              })}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
