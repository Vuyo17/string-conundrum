import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import s from './Admin.module.css';
import { adminApi, downloadMarksCsv } from './adminApi';
import {
  Card, Empty, ErrorNote, MarkBadge, fmtPercent, NO_DATA,
} from './AdminUI';

export function MarksPanel({ onOpenStudent }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    adminApi.marks()
      .then((payload) => { if (!cancelled) { setData(payload); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadMarksCsv();
    } catch (err) {
      setExportError(err);
    } finally {
      setExporting(false);
    }
  }

  if (error) return <ErrorNote error={error} />;
  if (loading || !data) return <p className={s.muted}>Loading marks…</p>;

  const weights = data.weights;

  return (
    <div className={s.wrap}>
      <div className={s.notice}>
        <strong>How the overall mark is calculated.</strong> Each module's mark is
        the student's <em>best</em> exam sitting, so retaking an exam and doing
        worse never lowers a mark. The overall figure weighs exams at{' '}
        {Math.round(weights.exam * 100)}% and practice accuracy at{' '}
        {Math.round(weights.practice * 100)}%, because practice is untimed,
        retryable and hint-assisted. A dash means nothing has been recorded — it
        is not a zero.
      </div>

      <div className={s.toolbar}>
        <span className={s.muted}>
          Class average: <strong>{fmtPercent(data.class_average, 1)}</strong> across{' '}
          {data.students.length} students
        </span>
        <button
          type="button"
          className={s.btn}
          style={{ marginLeft: 'auto' }}
          onClick={exportCsv}
          disabled={exporting || data.students.length === 0}
        >
          <Download size={14} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {exportError && <ErrorNote error={exportError} />}

      <Card>
        {data.students.length === 0 ? (
          <Empty>No student accounts yet.</Empty>
        ) : (
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  {data.modules.map((m) => (
                    <th key={m.id} className={s.num} title={m.title}>
                      {m.title.replace(/^String /, '')}
                    </th>
                  ))}
                  <th className={s.num}>Practice</th>
                  <th className={s.num}>Exam avg</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((row) => (
                  <tr key={row.uid}>
                    <td>
                      <button type="button" className={s.rowButton}
                        onClick={() => onOpenStudent?.(row.uid)}>
                        {row.name}
                      </button>
                    </td>
                    {data.modules.map((m) => (
                      <td key={m.id} className={s.num}>
                        {row.per_module[m.id] === null || row.per_module[m.id] === undefined
                          ? <span className={s.muted}>{NO_DATA}</span>
                          : `${row.per_module[m.id]}%`}
                      </td>
                    ))}
                    <td className={s.num}>{fmtPercent(row.practice, 0)}</td>
                    <td className={s.num}>{fmtPercent(row.exam, 0)}</td>
                    <td><MarkBadge value={row.overall} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Module average</th>
                  {data.modules.map((m) => (
                    <td key={m.id} className={s.num} style={{ fontWeight: 700 }}>
                      {fmtPercent(data.module_averages[m.id], 0)}
                    </td>
                  ))}
                  <td />
                  <td />
                  <td><MarkBadge value={data.class_average} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
