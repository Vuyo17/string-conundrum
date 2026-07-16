import React from 'react';
import styles from '../styles/App.module.css';

export function ScreenHeader({ title, subtitle }) {
  return (
    <div className={styles.screenHeader}>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
