import React from 'react';
import styles from '../styles/App.module.css';

export function VisualizerView() {
  return (
    <article className={styles.card}>
      <h2>Visualization View</h2>
      <p>Render indexed string cells and operation highlights from backend `visual_state` data.</p>
    </article>
  );
}
