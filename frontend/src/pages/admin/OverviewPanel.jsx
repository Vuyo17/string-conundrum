import React, { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, GraduationCap, Star, TrendingDown, Users,
} from 'lucide-react';
import s from './Admin.module.css';
import { adminApi } from './adminApi';
import {
  Card, Empty, ErrorNote, Meter, StatTile, fmtNumber, fmtPercent, fmtWhen, NO_DATA,
} from './AdminUI';
import { ActivityChart, DistributionChart } from './Charts';

export function OverviewPanel({ onOpenStudent }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.overview()
      .then((payload) => { if (!cancelled) { setData(payload); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (error) return <ErrorNote error={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  if (loading || !data) return <p className={s.muted}>Loading the class overview…</p>;

  const { students, averages, totals, modules, hardest_module: hardest } = data;
  const noData = totals.attempts === 0 && totals.exam_sittings === 0;

  return (
    <div className={s.wrap}>
      {noData && (
        <div className={s.notice}>
          <strong>Nothing recorded yet.</strong> Student answers and exam marks are
          logged from the moment this build is deployed — earlier activity was never
          stored, so it cannot be shown here. To populate the dashboard for a demo,
          run <code>python -m db.seed_demo_data --students 40</code> from the backend
          directory.
        </div>
      )}

      <div className={s.tiles}>
        <StatTile
          icon={Users}
          label="Students"
          value={fmtNumber(students.total)}
          hint={`${students.active} active this week`}
        />
        <StatTile
          icon={GraduationCap}
          label="Class average"
          value={fmtPercent(averages.overall, 1)}
          hint={averages.exam === null ? 'no exams sat yet'
            : `exams ${fmtPercent(averages.exam, 1)} · practice ${fmtPercent(averages.practice, 1)}`}
        />
        <StatTile
          icon={Activity}
          label="Average progress"
          value={fmtPercent(averages.progress, 0)}
          hint={`${students.completed_all} finished every module`}
        />
        <StatTile
          icon={AlertTriangle}
          label="Needs attention"
          value={fmtNumber(students.at_risk)}
          hint="low marks, low accuracy or inactive"
        />
        <StatTile
          icon={Star}
          label="Questions answered"
          value={fmtNumber(totals.attempts)}
          hint={`${fmtNumber(totals.exam_sittings)} exam sittings`}
        />
      </div>

      {hardest && (
        <div className={s.notice}>
          <TrendingDown size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          <strong>{hardest.title}</strong> is the module students score lowest on —
          an exam average of {fmtPercent(hardest.exam_avg, 1)} across{' '}
          {hardest.students_started} students.
        </div>
      )}

      <Card
        title="Answers per day"
        subtitle="Engagement over the last six weeks. Hover for a day's total."
      >
        <ActivityChart data={data.activity ?? []} />
      </Card>

      <Card
        title="Spread of overall marks"
        subtitle="How many students fall in each ten-point band. A class average alone hides whether the cohort is clustered or split."
      >
        <DistributionChart
          data={data.mark_distribution ?? []}
          classAverage={averages.overall}
        />
      </Card>

      <div className={s.grid2}>
        <Card
          title="Performance by module"
          subtitle="Completion is how many students finished every stage. Exam average is each student's best sitting."
        >
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Completion</th>
                  <th>Exam average</th>
                  <th className={s.num}>Accuracy</th>
                  <th className={s.num}>Answers</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.module_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.title}</div>
                      <div className={s.barMeta}>{m.students_started} started</div>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <Meter
                        value={m.completion_rate}
                        title={`${m.students_completed} of ${data.students.total} students`}
                      />
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <Meter value={m.exam_avg} />
                    </td>
                    <td className={s.num}>{m.accuracy === null ? NO_DATA : `${m.accuracy}%`}</td>
                    <td className={s.num}>{fmtNumber(m.attempts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Most common misconceptions"
          subtitle="Identified from the wrong answers students actually gave."
        >
          {data.misconceptions.length === 0 ? (
            <Empty>No wrong answers recorded yet.</Empty>
          ) : (
            <div className={s.barList}>
              {data.misconceptions.map((item) => (
                <div key={item.id} className={s.barItem}>
                  <div className={s.barLabel}>
                    <span className={s.barLabelId}>{item.id}</span>
                    <span>{item.students_affected} students · {item.count} times</span>
                  </div>
                  <Meter
                    value={item.students_percent}
                    title={`${item.students_affected} of ${students.total} students`}
                  />
                  <div className={s.barMeta}>{item.modules.join(', ')}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Recent activity" subtitle="The most recent things students did.">
        {data.recent_activity.length === 0 ? (
          <Empty>No activity recorded yet.</Empty>
        ) : (
          <div className={s.feed}>
            {data.recent_activity.map((event, index) => (
              <div className={s.feedItem} key={`${event.uid}-${event.at}-${index}`}>
                <div className={s.feedText}>
                  <button
                    type="button"
                    className={s.rowButton}
                    onClick={() => onOpenStudent?.(event.uid)}
                  >
                    <span className={s.feedName}>{event.name}</span>
                  </button>
                  {' — '}
                  {event.detail}
                </div>
                <span className={s.feedTime}>{fmtWhen(event.at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
