import React, { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCcw, SquareMousePointer, XCircle } from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { useLanguage } from '../../context/LanguageContext';
import { shuffle } from './exerciseHelpers';

// ─── drag & drop warm-up (client-side, ungraded) ──────────────────────────────
//
// Its own file rather than living inside PracticeSection.jsx (where it was
// originally written): both the static-bank PracticeRunner and the
// procedural PracticeEngine show it before a module's first question when
// `practice.warmup` is set (currently just Indexing), and PracticeEngine
// already imports PracticeSection for nothing else -- importing this
// component from there would be a circular import between the two.

export function DragDropWarmup({ config }) {
  const { t } = useLanguage();
  const letters = useMemo(
    () => config.word.split('').map((char, i) => ({ id: `${char}-${i}`, char })),
    [config.word],
  );
  const [pool, setPool] = useState(() => shuffle(letters));
  const [slots, setSlots] = useState(() => letters.map(() => null));
  const [picked, setPicked] = useState(null); // tile id, for tap-to-place
  const [checked, setChecked] = useState(false);

  const complete = slots.every(Boolean);
  const correctness = slots.map((tile, i) => (tile ? tile.char === config.word[i] : false));
  const allCorrect = complete && correctness.every(Boolean);

  function placeTile(tileId, slotIndex) {
    const tile = pool.find((t) => t.id === tileId) ?? slots.find((t) => t?.id === tileId);
    if (!tile) return;
    setChecked(false);
    setPool((prev) => prev.filter((t) => t.id !== tileId));
    setSlots((prev) => {
      const next = prev.map((t) => (t?.id === tileId ? null : t));
      const evicted = next[slotIndex];
      next[slotIndex] = tile;
      if (evicted) setPool((p) => [...p, evicted]);
      return next;
    });
    setPicked(null);
  }

  function returnTile(slotIndex) {
    const tile = slots[slotIndex];
    if (!tile) return;
    setChecked(false);
    setSlots((prev) => prev.map((t, i) => (i === slotIndex ? null : t)));
    setPool((prev) => [...prev, tile]);
  }

  function reset() {
    setPool(shuffle(letters));
    setSlots(letters.map(() => null));
    setPicked(null);
    setChecked(false);
  }

  return (
    <div className={m.warmupCard}>
      <div className={m.warmupHeader}>
        <span className={m.warmupBadge}><SquareMousePointer size={13} /> {t('practice.dragAndDrop')}</span>
        <h3>{config.title}</h3>
        <p>{config.prompt}</p>
      </div>

      <div className={m.dndPool} aria-label={t('a11y.characterTiles')}>
        {pool.map((tile) => (
          <button
            key={tile.id}
            type="button"
            draggable
            className={`${m.dndTile} ${picked === tile.id ? m.dndTilePicked : ''}`}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', tile.id)}
            onClick={() => setPicked((prev) => (prev === tile.id ? null : tile.id))}
          >
            {tile.char}
          </button>
        ))}
        {pool.length === 0 && <span className={m.dndPoolEmpty}>{t('a11y.allTilesPlaced')}</span>}
      </div>

      <div className={m.dndSlots}>
        {slots.map((tile, i) => (
          <div key={i} className={m.dndSlotWrap}>
            <button
              type="button"
              className={[
                m.dndSlot,
                tile ? m.dndSlotFilled : '',
                checked && tile ? (correctness[i] ? m.dndSlotCorrect : m.dndSlotWrong) : '',
              ].join(' ')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                placeTile(e.dataTransfer.getData('text/plain'), i);
              }}
              onClick={() => {
                if (picked) placeTile(picked, i);
                else if (tile) returnTile(i);
              }}
              aria-label={
                tile
                  ? t('practice.slotFilled', { index: i, char: tile.char })
                  : t('practice.slotEmpty', { index: i })
              }
            >
              {tile ? tile.char : ''}
            </button>
            <span className={m.dndSlotIndex}>{i}</span>
          </div>
        ))}
      </div>

      <div className={m.warmupFooter}>
        <button type="button" className={m.ghostButton} onClick={reset}>
          <RefreshCcw size={14} /> {t('practice.shuffleAgain')}
        </button>
        <button
          type="button"
          className={m.solidButton}
          onClick={() => setChecked(true)}
          disabled={!complete}
        >
          {t('practice.checkPlacement')}
        </button>
      </div>

      {checked && (
        <p className={`${m.warmupVerdict} ${allCorrect ? m.warmupVerdictOk : m.warmupVerdictNo}`}>
          {allCorrect
            ? <><CheckCircle2 size={15} /> {t('practice.warmupAllCorrect')}</>
            : <><XCircle size={15} /> {t('practice.warmupSomeWrong')}</>}
        </p>
      )}
    </div>
  );
}
