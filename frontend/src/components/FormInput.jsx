import React from 'react';
import styles from '../styles/App.module.css';

export function FormInput({ label, ...props }) {
  return (
    <label className={styles.formControl}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
