import React from 'react';
import styles from '../styles/App.module.css';

export function InfoBox({ title, text }) {
  return (
    <article className={styles.infoBox}>
      <h4>{title}</h4>
      <p>{text}</p>
    </article>
  );
}
