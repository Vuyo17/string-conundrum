import React from 'react';
import { Target } from 'lucide-react';
import styles from '../styles/App.module.css';

function renderSubmittedAnswer(exercise, submitted) {
  if (!exercise || !submitted) return '-';
  if (exercise.type === 'mcq' || exercise.type === 'fill_blank') return submitted.answer || '(no answer)';
  if (exercise.type === 'select_all') return (submitted.answers ?? []).join(', ') || '(none selected)';
  if (exercise.type === 'write_code') return submitted.code || '(no code)';
  return '-';
}

function renderCorrectAnswer(exercise) {
  if (!exercise) return '-';
  if (exercise.type === 'mcq' || exercise.type === 'fill_blank') return exercise.answer;
  if (exercise.type === 'select_all') return (exercise.answers ?? []).join(', ');
  if (exercise.type === 'write_code') return 'Any code passing all test cases';
  return '-';
}

export function Feedback({ lastAttempt }) {
  if (!lastAttempt) {
    return (
      <div className={styles.card} style={{ maxWidth: 640 }}>
        <p className={styles.emptyState}>
          No exercise attempted yet. Head to the Exercise tab, answer a question,
          and your result will show up here.
        </p>
      </div>
    );
  }

  const { exercise, result, submitted } = lastAttempt;

  return (
    <div className={styles.feedbackLayout}>
      <section className={styles.card}>
        <h3>Your Answer</h3>
        <p className={styles.answerBox}>{renderSubmittedAnswer(exercise, submitted)}</p>
        <h3>Correct Answer</h3>
        <p className={styles.answerBox}>{renderCorrectAnswer(exercise)}</p>
      </section>

      <section className={result.correct ? styles.feedbackSuccess : styles.misconceptionCard}>
        {result.correct ? (
          <>
            <div className={styles.errorPill} style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              ✓ Correct Answer
            </div>
            <h2>Nicely done</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
              {result.feedback}
            </p>
          </>
        ) : (
          <>
            <div className={styles.errorPill}>✗ Incorrect Answer</div>
            <h2>Misconception Detected</h2>
            {result.misconception_id && (
              <p><strong>{result.misconception_id.replaceAll('_', ' ')}</strong></p>
            )}
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
              {result.feedback}
            </p>
            <h3 style={{ marginTop: '20px' }}>Recommended next step</h3>
            <button className={styles.primaryButton} style={{ marginTop: '4px' }}>
              <Target size={15} /> Practice {exercise?.module_id ?? 'this module'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
