import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VolumeX } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import styles from '../styles/App.module.css';

/** Popup shown when Read aloud is clicked in isiXhosa — browsers cannot speak it. */
export function SpeechUnavailableDialog({ open, onClose }) {
  const { t } = useLanguage();
  const okRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    okRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.speechNoticeOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.speechNoticeCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="speech-notice-title"
        aria-describedby="speech-notice-body"
        onClick={(event) => event.stopPropagation()}
      >
        <VolumeX size={28} aria-hidden="true" />
        <h2 id="speech-notice-title">{t('viz.readAloudUnavailableTitle')}</h2>
        <p id="speech-notice-body">{t('viz.readAloudUnavailable')}</p>
        <button
          ref={okRef}
          type="button"
          className={styles.speechNoticeOk}
          onClick={onClose}
        >
          {t('viz.readAloudUnavailableOk')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
