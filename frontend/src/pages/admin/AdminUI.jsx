import React from 'react';
import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import s from './Admin.module.css';

// Shared presentational pieces for the lecturer dashboard.
//
// One rule runs through all of them: a value is never communicated by colour
// alone. Every meter prints its own number, every status badge carries a word
// and an icon, and every band below is named as well as tinted -- so the
// dashboard reads the same to a colourblind lecturer, in greyscale print, and
// in a screenshot pasted into a report.

// An absent value and a zero are different facts. Marks, averages and
// accuracies come back as null from the API when nothing has been recorded
// yet, and rendering that as "0%" would tell a lecturer a brand-new module was
// failed by everyone.
export const NO_DATA = '—';

export function fmtPercent(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_DATA;
  return `${Number(value).toFixed(digits)}%`;
}

export function fmtNumber(value) {
  if (value === null || value === undefined) return NO_DATA;
  return Number(value).toLocaleString();
}

export function fmtWhen(iso) {
  if (!iso) return 'never';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return NO_DATA;

  const minutes = Math.round((Date.now() - then.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString();
}

export function StatTile({ label, value, hint, icon: Icon }) {
  return (
    <div className={s.tile}>
      <div className={s.tileLabel}>
        {Icon && <Icon size={13} aria-hidden="true" />}
        {label}
      </div>
      <div className={s.tileValue}>{value}</div>
      {hint && <div className={s.tileHint}>{hint}</div>}
    </div>
  );
}

// A single-hue bar whose LENGTH is the encoding; the number beside it is the
// value. Deliberately not coloured by band -- tinting the bar red or green by
// score would make hue and length say the same thing twice, and would make
// the tint the thing the eye reads first.
export function Meter({ value, max = 100, title }) {
  if (value === null || value === undefined) {
    return <span className={s.meterEmpty}>{NO_DATA}</span>;
  }
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={s.meterRow} title={title ?? `${Number(value).toFixed(0)} of ${max}`}>
      <span className={s.meterTrack}>
        <span className={s.meterFill} style={{ width: `${percent}%` }} />
      </span>
      <span className={s.meterValue}>{Number(value).toFixed(0)}%</span>
    </div>
  );
}

// Mark bands. The threshold names come from the exam pass mark (80) and the
// at-risk floor (50) the backend already uses, so the dashboard and the
// student's own results screen never disagree about what "passing" means.
export function MarkBadge({ value }) {
  if (value === null || value === undefined) {
    return <span className={s.muted}>{NO_DATA}</span>;
  }
  const rounded = Number(value).toFixed(0);
  if (value >= 80) {
    return <span className={`${s.badge} ${s.badgeGood}`}><CheckCircle2 size={11} />{rounded}%</span>;
  }
  if (value >= 50) {
    return <span className={`${s.badge} ${s.badgeWarn}`}><MinusCircle size={11} />{rounded}%</span>;
  }
  return <span className={`${s.badge} ${s.badgeRisk}`}><AlertTriangle size={11} />{rounded}%</span>;
}

export function RiskBadge({ reasons }) {
  if (!reasons || reasons.length === 0) {
    return <span className={s.muted}>{NO_DATA}</span>;
  }
  return (
    <span className={`${s.badge} ${s.badgeRisk}`} title={reasons.join('; ')}>
      <AlertTriangle size={11} />
      At risk
    </span>
  );
}

export function Card({ title, subtitle, action, children }) {
  return (
    <section className={s.card}>
      {(title || action) && (
        <div className={s.cardHead}>
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className={s.error}>
      {String(error.message || error)}
      {onRetry && (
        <button type="button" className={`${s.btn} ${s.btnGhost} ${s.btnSmall}`}
          style={{ marginLeft: 10 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }) {
  return <p className={s.empty}>{children}</p>;
}
