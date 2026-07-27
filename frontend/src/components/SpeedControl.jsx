import React from 'react';
import { Gauge } from 'lucide-react';
import styles from '../styles/App.module.css';

// Multipliers on each visualiser's own base interval, so "1×" stays whatever
// pace that screen was already playing at.
export const SPEEDS = [
  { value: 0.5, label: '0.5×', name: 'Slow' },
  { value: 1, label: '1×', name: 'Normal' },
  { value: 2, label: '2×', name: 'Fast' },
];

/**
 * Playback speed picker shared by the Visualiser screen and the Code Space
 * debugger. Sits as its own centred row inside a controls grid.
 */
export function SpeedControl({ value, onChange, disabled = false }) {
  return (
    <div className={styles.speedControl} role="radiogroup" aria-label="Playback speed">
      <span className={styles.speedLabel}>
        <Gauge size={14} /> Speed
      </span>
      <div className={styles.speedOptions}>
        {SPEEDS.map((speed) => {
          const active = value === speed.value;
          return (
            <button
              key={speed.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.speedOption} ${active ? styles.speedOptionActive : ''}`}
              onClick={() => onChange(speed.value)}
              disabled={disabled}
              title={`${speed.name} (${speed.label})`}
            >
              {speed.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
