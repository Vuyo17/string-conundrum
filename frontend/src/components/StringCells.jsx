import React from 'react';
import styles from '../styles/App.module.css';

export function StringCells({ letters: list, indexes, negative, highlight = [], compact = false }) {
  return (
    <div className={compact ? styles.stringCompact : styles.stringBlock}>
      <div className={styles.cellRow}>
        {list.map((letter, i) => (
          <span
            key={`${letter}-${i}`}
            className={`${styles.charCell} ${highlight.includes(i) ? styles.cellActive : ''}`}
          >
            {letter === ' ' ? '·' : letter}
          </span>
        ))}
      </div>
      {indexes && (
        <div className={styles.indexRow}>
          {indexes.map((idx) => <span key={idx}>{idx}</span>)}
        </div>
      )}
      {negative && (
        <div className={styles.negativeRow}>
          {negative.map((idx) => <span key={idx}>{idx}</span>)}
        </div>
      )}
    </div>
  );
}
