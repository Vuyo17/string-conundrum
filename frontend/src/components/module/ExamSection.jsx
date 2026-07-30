import React, { useEffect, useState } from 'react';
import m from '../../styles/ModulePage.module.css';
import { getApiUrl } from '../../config/api';
import { ExamMode } from './ExamMode';
import { useLanguage } from '../../context/LanguageContext';

// Fetches the module's exercise bank for the Exam stage. A separate fetch
// from Practice's, kept simple rather than threading shared state down from
// ModulePage — the bank is small and rarely changes mid-session.
export function ExamSection({ practice, onVisualize, onSectionComplete }) {
  const { lang, t } = useLanguage();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl(`/api/exercises/${practice.apiModuleId}?lang=${lang}`))
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setExercises(data.exercises ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError('practice.serverUnreachable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [practice.apiModuleId, lang]);

  if (loading) return <p className={m.practiceStatus}>{t('practice.loading')}</p>;
  if (loadError) return <p className={m.practiceStatus}>{t(loadError)}</p>;
  if (exercises.length === 0) return <p className={m.practiceStatus}>{t('practice.noExercises')}</p>;

  return (
    <div className={m.practiceStack}>
      <ExamMode
        practice={practice}
        exercises={exercises}
        onVisualize={onVisualize}
        onSectionComplete={onSectionComplete}
      />
    </div>
  );
}
