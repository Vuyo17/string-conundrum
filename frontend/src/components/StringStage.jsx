import React from 'react';
import styles from '../styles/Stage.module.css';

const CELL = 52; // tile width
const GAP = 6;   // gap between tiles

/**
 * The signature visual of String Conundrum: a string rendered as a strip of
 * glossy tiles on a dark stage, with positive/negative index rails, glowing
 * highlights, an optional slice bracket, and a caret that glides between
 * characters.
 *
 * Props:
 *  - text            string being visualised
 *  - highlight       array of highlighted indices
 *  - pointerIndex    index the gliding caret sits under (null to hide)
 *  - pointerLabel    small label rendered on the caret (e.g. `i=3` or `'e'`)
 *  - slice           { start, stop, normalStart, normalStop } or null
 *  - showNegative    render the negative index rail (default true)
 *  - emptyMessage    text shown when `text` is empty
 */
export function StringStage({
  text = '',
  highlight = [],
  pointerIndex = null,
  pointerLabel = '',
  slice = null,
  showNegative = true,
  emptyMessage = 'Enter a string to visualise it.',
}) {
  const chars = text.split('');
  const length = chars.length;

  if (length === 0) {
    return <div className={styles.stageEmpty}>{emptyMessage}</div>;
  }

  const stripWidth = length * CELL + (length - 1) * GAP;
  const hasPointer = pointerIndex !== null && pointerIndex >= 0 && pointerIndex < length;

  return (
    <div className={styles.stageScroll}>
      <div className={styles.stage} style={{ width: stripWidth }}>
        {/* positive index rail */}
        <div className={styles.rail}>
          {chars.map((_, i) => (
            <span
              key={`p${i}`}
              className={highlight.includes(i) ? styles.railOn : ''}
              style={{ width: CELL }}
            >
              {i}
            </span>
          ))}
        </div>

        {/* tiles */}
        <div className={styles.tiles}>
          {chars.map((ch, i) => (
            <span
              key={`c${i}`}
              className={`${styles.tile} ${highlight.includes(i) ? styles.tileOn : ''}`}
              style={{ width: CELL }}
            >
              {ch === ' ' ? '\u00b7' : ch}
            </span>
          ))}
        </div>

        {/* negative index rail */}
        {showNegative && (
          <div className={`${styles.rail} ${styles.railNeg}`}>
            {chars.map((_, i) => (
              <span
                key={`n${i}`}
                className={highlight.includes(i) ? styles.railOn : ''}
                style={{ width: CELL }}
              >
                {i - length}
              </span>
            ))}
          </div>
        )}

        {/* slice bracket */}
        {slice && (
          <div className={styles.sliceRow}>
            <div
              className={styles.sliceBracket}
              style={{
                left: Math.min(slice.normalStart, slice.normalStop) * (CELL + GAP),
                width: Math.max(
                  Math.abs(slice.normalStop - slice.normalStart) * (CELL + GAP) - GAP,
                  0,
                ),
              }}
            />
            <span
              className={styles.sliceLabel}
              style={{ left: slice.normalStart * (CELL + GAP) + CELL / 2 }}
            >
              start {slice.start}
              <small>inclusive</small>
            </span>
            <span
              className={`${styles.sliceLabel} ${styles.sliceLabelStop}`}
              style={{ left: Math.min(slice.normalStop, length - 0.5) * (CELL + GAP) + CELL / 2 }}
            >
              stop {slice.stop}
              <small>exclusive</small>
            </span>
          </div>
        )}

        {/* gliding caret */}
        {hasPointer && (
          <div
            className={styles.caret}
            style={{ transform: `translateX(${pointerIndex * (CELL + GAP)}px)`, width: CELL }}
          >
            <span className={styles.caretArrow} />
            {pointerLabel && <span className={styles.caretLabel}>{pointerLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
