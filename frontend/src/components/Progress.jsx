import React from 'react';
import styles from '../styles/App.module.css';

export function Progress({ value }) {
  return (
    <div className={styles.progress}>
      <div style={{ width: `${value}%` }} />
    </div>
  );
}
