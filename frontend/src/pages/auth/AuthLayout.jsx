import React from 'react';
import { BookOpen } from 'lucide-react';
import s from './Auth.module.css';

const SPECIMEN = 'STRINGS';
const HIGHLIGHT = [2, 3, 4];

// `variant` only controls where the wordmark is allowed to show: the aside copy
// on wide screens, the panel copy once the aside drops away. Typography is
// shared so both render identically.
function Wordmark({ variant }) {
  return (
    <div className={`${s.wordmark} ${variant === 'panel' ? s.panelWordmark : ''}`}>
      <span className={s.wordmarkBadge}>
        <BookOpen size={17} aria-hidden="true" />
      </span>
      <span>
        <strong>String Conundrum</strong>
        <small>Master Python Strings</small>
      </span>
    </div>
  );
}

/**
 * Split shell: a quiet context column on the left, the active auth step on the
 * right. Below 860px the left column drops away entirely and the form becomes
 * the whole page.
 */
export function AuthLayout({ children }) {
  return (
    <div className={s.shell}>
      <aside className={s.aside}>
        <Wordmark variant="aside" />

        <div className={s.asideBody}>
          <span className={s.eyebrow}>For UCT students</span>
          <h1>Your learning space, built around your degree.</h1>
          <p>
            Work through Python strings the way they are actually assessed —
            indexing, slicing, immutability and the edge cases that cost marks.
          </p>

          <figure className={s.specimen}>
            <div className={s.specimenRow}>
              {SPECIMEN.split('').map((char, i) => (
                <span
                  key={char + i}
                  className={`${s.specimenCell} ${HIGHLIGHT.includes(i) ? s.specimenHighlight : ''}`}
                >
                  <span className={s.specimenChar}>{char}</span>
                  <span className={s.specimenTick} />
                </span>
              ))}
            </div>
            <div className={s.specimenRule} />
            <div className={s.specimenRow}>
              {SPECIMEN.split('').map((char, i) => (
                <span
                  key={char + i}
                  className={`${s.specimenCell} ${HIGHLIGHT.includes(i) ? s.specimenHighlight : ''}`}
                >
                  <span className={s.specimenIndex}>{i}</span>
                </span>
              ))}
            </div>
            <figcaption className={s.specimenCaption}>
              Every character has an index. That is where it starts.
            </figcaption>
          </figure>
        </div>

        <p className={s.asideFoot}>
          An independent project built by students, for students. Not an official
          University of Cape Town service.
        </p>
      </aside>

      <main className={s.panel}>
        <Wordmark variant="panel" />
        {children}
      </main>
    </div>
  );
}
