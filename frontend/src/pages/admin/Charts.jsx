import React, { useState } from 'react';
import s from './Admin.module.css';

// Charts for the lecturer dashboard, drawn as inline SVG.
//
// No charting library. The application's runtime dependencies were chosen
// deliberately and kept to four; a chart library is a large addition for two
// figures, and both of these are a path and a set of rectangles. The cost of
// hand-rolling is that axes, ticks and hover handling are written here rather
// than configured, which is the trade being made knowingly.
//
// Conventions shared by both charts, and the reasons for them:
//
//   * ONE hue. Both charts show magnitude, and length already encodes it;
//     colouring by value would say the same thing twice and would make the
//     colour the thing read first. --primary throughout, so both follow the
//     app's theme in light and dark without a second palette to maintain.
//   * Grid and axes are recessive (--border, --muted). The data is the only
//     thing drawn at full strength.
//   * Every chart carries a text alternative: an aria-label summarising the
//     series, and a disclosure holding the same numbers as a table. A figure
//     nobody can read the values out of is a decoration.
//   * Hover is standard, not optional. A 42-point series cannot label every
//     point, so the values live behind the pointer.

const AXIS_TEXT = 11;

function niceCeiling(value) {
  // Round the axis maximum up to something a person would choose, so the top
  // gridline reads 120 rather than 116.
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatDay(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function DataTable({ caption, head, rows }) {
  return (
    <details className={s.chartData}>
      <summary>Show data</summary>
      <div className={s.tableScroll}>
        <table className={s.table}>
          <caption className={s.srOnly}>{caption}</caption>
          <thead>
            <tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <td key={index} className={index ? s.num : undefined}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ── activity over time ──────────────────────────────────────────────────────
// An area under a line rather than bars: 42 daily values are a continuous
// quantity over time, and bars at that density become a comb that is harder
// to read a trend from than a line is.

export function ActivityChart({ data }) {
  const [hover, setHover] = useState(null);

  const total = data.reduce((sum, day) => sum + day.answers, 0);
  if (data.length === 0 || total === 0) {
    return <p className={s.empty}>No answers recorded in this period.</p>;
  }

  const W = 720;
  const H = 200;
  const PAD = { top: 12, right: 12, bottom: 26, left: 38 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = niceCeiling(Math.max(...data.map((d) => d.answers)));
  const x = (i) => PAD.left + (i / (data.length - 1)) * plotW;
  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.answers)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  // Weekly ticks: 42 daily labels would overlap into an unreadable band.
  const tickEvery = Math.ceil(data.length / 6);

  function onMove(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    const index = Math.round(fraction * (data.length - 1));
    if (index >= 0 && index < data.length) setHover(index);
  }

  const peak = data.reduce((best, d) => (d.answers > best.answers ? d : best), data[0]);

  return (
    <>
      <div
        className={s.chartWrap}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={s.chartSvg}
          role="img"
          aria-label={
            `Answers per day over the last ${data.length} days. `
            + `${total} answers in total, peaking at ${peak.answers} on ${formatDay(peak.date)}.`
          }
        >
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)}
                className={s.chartGrid}
              />
              <text
                x={PAD.left - 6} y={y(value)} dy="0.32em"
                textAnchor="end" fontSize={AXIS_TEXT} className={s.chartAxisText}
              >
                {value}
              </text>
            </g>
          ))}

          <path d={area} className={s.chartArea} />
          <path d={line} className={s.chartLine} />

          {data.map((d, i) => (
            i % tickEvery === 0 ? (
              <text
                key={d.date}
                x={x(i)} y={H - 8}
                textAnchor="middle" fontSize={AXIS_TEXT} className={s.chartAxisText}
              >
                {formatDay(d.date)}
              </text>
            ) : null
          ))}

          {hover !== null && (
            <g>
              <line
                x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH}
                className={s.chartCrosshair}
              />
              {/* A ring in the surface colour keeps the marker legible where
                  it sits on top of the filled area. */}
              <circle cx={x(hover)} cy={y(data[hover].answers)} r="5" className={s.chartMarker} />
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className={s.chartTip}
            style={{
              left: `${(hover / (data.length - 1)) * 100}%`,
              // Flip the tooltip to the other side near the right edge so it
              // cannot be clipped by the card.
              transform: hover > data.length * 0.75
                ? 'translate(-100%, -50%)' : 'translate(8px, -50%)',
            }}
          >
            <strong>{data[hover].answers}</strong> answers
            <span>{formatDay(data[hover].date)}</span>
          </div>
        )}
      </div>

      <DataTable
        caption="Answers per day"
        head={['Date', 'Answers']}
        rows={data.map((d) => [d.date, d.answers])}
      />
    </>
  );
}

// ── mark distribution ───────────────────────────────────────────────────────
// Bars, because the bands are discrete categories rather than a continuum,
// and because the question asked of this chart -- "where is the class
// clustered?" -- is answered by comparing heights.

export function DistributionChart({ data, classAverage }) {
  const [hover, setHover] = useState(null);

  const total = data.reduce((sum, bin) => sum + bin.students, 0);
  if (total === 0) {
    return <p className={s.empty}>No marks recorded yet.</p>;
  }

  const W = 720;
  const H = 200;
  const PAD = { top: 12, right: 12, bottom: 30, left: 38 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = niceCeiling(Math.max(...data.map((b) => b.students)));
  const slot = plotW / data.length;
  const GAP = 4; // leaves a 2px surface gap on each side of every bar
  const barW = slot - GAP * 2;
  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  const gridValues = [0, 0.5, 1].map((f) => Math.round(max * f));
  // Where the class average falls, drawn over the distribution so the two
  // are read together rather than from separate panels.
  const averageX = classAverage === null || classAverage === undefined
    ? null
    : PAD.left + (Math.max(0, Math.min(100, classAverage)) / 100) * plotW;

  return (
    <>
      <div className={s.chartWrap} onMouseLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={s.chartSvg}
          role="img"
          aria-label={
            `Distribution of overall marks across ${total} students, in ten-point bands. `
            + data.filter((b) => b.students)
              .map((b) => `${b.label}: ${b.students}`).join('; ')
          }
        >
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)}
                className={s.chartGrid}
              />
              <text
                x={PAD.left - 6} y={y(value)} dy="0.32em"
                textAnchor="end" fontSize={AXIS_TEXT} className={s.chartAxisText}
              >
                {value}
              </text>
            </g>
          ))}

          {data.map((bin, i) => {
            const height = plotH - (y(bin.students) - PAD.top);
            return (
              <g
                key={bin.label}
                onMouseEnter={() => setHover(i)}
              >
                {/* Full-height hit area: a 2-student bar is a few pixels tall
                    and would otherwise be nearly impossible to point at. */}
                <rect
                  x={PAD.left + i * slot} y={PAD.top}
                  width={slot} height={plotH}
                  fill="transparent"
                />
                <rect
                  x={PAD.left + i * slot + GAP} y={y(bin.students)}
                  width={barW} height={Math.max(height, bin.students ? 2 : 0)}
                  rx="4"
                  className={hover === i ? s.chartBarActive : s.chartBar}
                />
                <text
                  x={PAD.left + i * slot + slot / 2} y={H - 10}
                  textAnchor="middle" fontSize={AXIS_TEXT} className={s.chartAxisText}
                >
                  {bin.label}
                </text>
              </g>
            );
          })}

          {averageX !== null && (
            <g>
              <line
                x1={averageX} x2={averageX} y1={PAD.top} y2={PAD.top + plotH}
                className={s.chartRule}
              />
              <text
                x={averageX} y={PAD.top - 2}
                textAnchor="middle" fontSize={AXIS_TEXT} className={s.chartRuleText}
              >
                avg {Math.round(classAverage)}%
              </text>
            </g>
          )}
        </svg>

        {hover !== null && data[hover].students > 0 && (
          <div
            className={s.chartTip}
            style={{
              left: `${((hover + 0.5) / data.length) * 100}%`,
              transform: 'translate(-50%, -140%)',
            }}
          >
            <strong>{data[hover].students}</strong>
            {data[hover].students === 1 ? ' student' : ' students'}
            <span>scored {data[hover].label}%</span>
          </div>
        )}
      </div>

      <DataTable
        caption="Students per mark band"
        head={['Mark band', 'Students']}
        rows={data.map((b) => [`${b.label}%`, b.students])}
      />
    </>
  );
}
