import React from 'react';
import { StringCells } from './StringCells';
import styles from '../styles/App.module.css';

export function MemoryRow({ name, address, text }) {
  return (
    <div className={styles.memoryRow}>
      <strong>{name}</strong>
      <code>{address}</code>
      <span>→</span>
      <StringCells letters={text.split('')} highlight={[]} compact />
    </div>
  );
}
