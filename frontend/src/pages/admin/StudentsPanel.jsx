import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import s from './Admin.module.css';
import { adminApi } from './adminApi';
import {
  Card, Empty, ErrorNote, MarkBadge, Meter, RiskBadge, StatTile,
  fmtNumber, fmtPercent, fmtWhen, NO_DATA,
} from './AdminUI';

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  progress: (a, b) => b.progress_percent - a.progress_percent,
  // Nulls sort last in both directions: a student with no mark yet is not the
  // top of the class and not the bottom of it either.
  mark: (a, b) => (b.overall ?? -1) - (a.overall ?? -1),
  active: (a, b) => (b.last_active || '').localeCompare(a.last_active || ''),
};

export function StudentsPanel({ openUid, onOpenStudent, onCloseStudent }) {
  if (openUid) {
    return <StudentDetail uid={openUid} onBack={onCloseStudent} />;
  }
  return <StudentList onOpenStudent={onOpenStudent} />;
}

function StudentList({ onOpenStudent }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [riskOnly, setRiskOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.students()
      .then((payload) => { if (!cancelled) { setRows(payload.students); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Filtering is local rather than a round-trip per keystroke: the whole
  // roster is one class, already in memory, and a request per character would
  // be slower and flicker.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((r) => !riskOnly || r.at_risk)
      .filter((r) => !needle
        || r.name.toLowerCase().includes(needle)
        || (r.email || '').toLowerCase().includes(needle))
      .slice()
      .sort(SORTS[sort]);
  }, [rows, search, sort, riskOnly]);

  if (error) return <ErrorNote error={error} />;

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <div className={s.searchBox}>
          <Search className={s.searchIcon} size={14} aria-hidden="true" />
          <input
            type="search"
            className={`${s.input} ${s.searchInput}`}
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search students"
          />
        </div>

        <select
          className={s.select}
          style={{ width: 'auto' }}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort students"
        >
          <option value="name">Sort: name</option>
          <option value="progress">Sort: progress</option>
          <option value="mark">Sort: overall mark</option>
          <option value="active">Sort: last active</option>
        </select>

        <label className={s.muted} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={riskOnly} onChange={(e) => setRiskOnly(e.target.checked)} />
          Needs attention only
        </label>

        <span className={s.muted} style={{ marginLeft: 'auto' }}>
          {visible.length} of {rows.length} students
        </span>
      </div>

      <Card>
        {loading ? (
          <p className={s.muted}>Loading students…</p>
        ) : visible.length === 0 ? (
          <Empty>
            {rows.length === 0
              ? 'No student accounts yet. Guest sessions are not counted.'
              : 'No students match that filter.'}
          </Empty>
        ) : (
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Progress</th>
                  <th className={s.num}>Modules</th>
                  <th>Overall</th>
                  <th className={s.num}>Exam avg</th>
                  <th className={s.num}>Answers</th>
                  <th className={s.num}>Stars</th>
                  <th>Last active</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.uid}>
                    <td>
                      <button
                        type="button"
                        className={s.rowButton}
                        onClick={() => onOpenStudent(row.uid)}
                      >
                        {row.name}
                      </button>
                      {row.email && <div className={s.barMeta}>{row.email}</div>}
                    </td>
                    <td style={{ minWidth: 130 }}><Meter value={row.progress_percent} /></td>
                    <td className={s.num}>{row.modules_completed}/{row.modules_total}</td>
                    <td><MarkBadge value={row.overall} /></td>
                    <td className={s.num}>{fmtPercent(row.exam_avg, 0)}</td>
                    <td className={s.num}>{fmtNumber(row.attempts)}</td>
                    <td className={s.num}>{fmtNumber(row.stars)}</td>
                    <td className={s.muted}>{fmtWhen(row.last_active)}</td>
                    <td><RiskBadge reasons={row.risk_reasons} /></td>
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

function StudentDetail({ uid, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.student(uid)
      .then((payload) => { if (!cancelled) { setData(payload); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  return (
    <div className={s.wrap}>
      <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
        style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <ArrowLeft size={13} /> All students
      </button>

      {error && <ErrorNote error={error} />}
      {loading && <p className={s.muted}>Loading student…</p>}

      {data && (
        <>
          <Card>
            <div className={s.detailHead}>
              <div>
                <h2 className={s.detailName}>{data.student.name}</h2>
                {data.student.email && <p className={s.detailEmail}>{data.student.email}</p>}
                {data.student.risk_reasons.length > 0 && (
                  <div className={s.chips}>
                    {data.student.risk_reasons.map((reason) => (
                      <span key={reason} className={`${s.badge} ${s.badgeRisk}`}>{reason}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className={`${s.badge} ${s.badgeMuted}`}>
                {data.student.role === 'admin' ? 'Lecturer' : 'Student'}
              </span>
            </div>

            <div className={s.tiles}>
              <StatTile label="Overall mark" value={fmtPercent(data.student.overall, 1)}
                hint="60% exams, 40% practice" />
              <StatTile label="Exam average" value={fmtPercent(data.student.exam_avg, 1)}
                hint={`${data.student.exam_sittings} sittings`} />
              <StatTile label="Practice accuracy" value={fmtPercent(data.student.practice_percent, 1)}
                hint={`${fmtNumber(data.student.attempts)} answers`} />
              <StatTile label="Progress" value={fmtPercent(data.student.progress_percent, 0)}
                hint={`${data.student.modules_completed} of ${data.student.modules_total} modules`} />
              <StatTile label="Last active" value={fmtWhen(data.student.last_active)}
                hint={`${fmtNumber(data.student.stars)} stars earned`} />
            </div>
          </Card>

          <div className={s.grid2}>
            <Card title="Module by module">
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Progress</th>
                      <th className={s.num}>Accuracy</th>
                      <th>Best exam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.modules.map((m) => (
                      <tr key={m.module_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{m.title}</div>
                          <div className={s.barMeta}>
                            {m.sections_completed.length === 0
                              ? 'not started'
                              : m.sections_completed.join(' · ')}
                          </div>
                        </td>
                        <td style={{ minWidth: 120 }}><Meter value={m.progress_percent} /></td>
                        <td className={s.num}>
                          {m.accuracy === null ? NO_DATA : `${m.accuracy}%`}
                        </td>
                        <td><MarkBadge value={m.best_exam} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className={s.wrap}>
              <Card title="Misconceptions shown"
                subtitle="From this student's wrong answers.">
                {data.misconceptions.length === 0 ? (
                  <Empty>No misconceptions recorded.</Empty>
                ) : (
                  <div className={s.barList}>
                    {data.misconceptions.map((item) => (
                      <div key={item.id} className={s.barItem}>
                        <div className={s.barLabel}>
                          <span className={s.barLabelId}>{item.id}</span>
                          <span>{item.count}×</span>
                        </div>
                        <div className={s.barMeta}>{item.modules.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Exam history">
                {data.exams.length === 0 ? (
                  <Empty>No exams sat yet.</Empty>
                ) : (
                  <div className={s.tableScroll}>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th className={s.num}>Score</th>
                          <th>Mark</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.exams.map((exam, index) => (
                          <tr key={`${exam.module_id}-${exam.at}-${index}`}>
                            <td>{exam.title}</td>
                            <td className={s.num}>{exam.correct_count}/{exam.total_count}</td>
                            <td><MarkBadge value={exam.percent} /></td>
                            <td className={s.muted}>{fmtWhen(exam.at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
