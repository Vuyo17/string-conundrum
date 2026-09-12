import React, { useEffect, useState } from 'react';
import s from './Admin.module.css';
import { adminApi } from './adminApi';
import { Card, Empty, ErrorNote, Meter, NO_DATA } from './AdminUI';

export function AnalyticsPanel() {
  const [modules, setModules] = useState([]);
  const [moduleId, setModuleId] = useState('');
  const [misconceptions, setMisconceptions] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.modules().then((p) => setModules(p.modules)).catch(setError);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminApi.misconceptions({ limit: 20 }),
      adminApi.questions({ module_id: moduleId }),
    ])
      .then(([m, q]) => {
        if (cancelled) return;
        setMisconceptions(m);
        setQuestions(q.questions);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moduleId]);

  if (error) return <ErrorNote error={error} />;

  return (
    <div className={s.wrap}>
      <div className={s.notice}>
        <strong>Where these numbers come from.</strong> Every graded answer is
        recorded, including wrong ones, along with the misconception the wrong
        answer revealed. Procedurally generated practice questions have no stable
        id, so they count toward module accuracy but do not appear in the
        per-question table below.
      </div>

      <Card
        title="Misconceptions across the class"
        subtitle="Ranked by how often students actually made each mistake."
      >
        {loading ? (
          <p className={s.muted}>Loading…</p>
        ) : !misconceptions || misconceptions.misconceptions.length === 0 ? (
          <Empty>No misconceptions recorded yet — no wrong answers have been logged.</Empty>
        ) : (
          <div className={s.barList}>
            {misconceptions.misconceptions.map((item) => (
              <div key={item.id} className={s.barItem}>
                <div className={s.barLabel}>
                  <span className={s.barLabelId}>{item.id}</span>
                  <span>
                    {item.students_affected} of {misconceptions.total_students} students
                    {' · '}{item.count} times
                  </span>
                </div>
                <Meter
                  value={item.students_percent}
                  title={`${item.students_affected} students affected`}
                />
                <div className={s.barMeta}>
                  {item.modules.join(', ')}
                  {item.questions.length > 0 && ` · seen in ${item.questions.join(', ')}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Hardest questions"
        subtitle="Lowest success rate first. Questions with fewer than five attempts are listed last — the rate does not mean much yet."
        action={(
          <select
            className={s.select}
            style={{ width: 'auto' }}
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            aria-label="Filter by module"
          >
            <option value="">All modules</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        )}
      >
        {loading ? (
          <p className={s.muted}>Loading…</p>
        ) : questions.length === 0 ? (
          <Empty>No answers recorded for this selection.</Empty>
        ) : (
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Module</th>
                  <th>Success rate</th>
                  <th className={s.num}>Attempts</th>
                  <th className={s.num}>Students</th>
                  <th>Top misconception</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={`${q.module_id}-${q.question_id}`}>
                    <td><code>{q.question_id}</code></td>
                    <td>{q.module_title}</td>
                    <td style={{ minWidth: 140 }}><Meter value={q.correct_rate} /></td>
                    <td className={s.num}>{q.attempts}</td>
                    <td className={s.num}>{q.students}</td>
                    <td className={s.barLabelId}>{q.top_misconception ?? NO_DATA}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
