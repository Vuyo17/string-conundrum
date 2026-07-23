import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, CheckCircle2, ChevronRight, Dumbbell, GraduationCap, ListChecks,
  PenLine, RefreshCcw, SquareMousePointer, Star, Target, XCircle,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { CodeExercise } from './CodeExercise';
import { CodeBlock, InlineText } from './ContentBlocks';
import { ExamMode } from './ExamMode';

// Star value of an exercise. The bank's legacy `xp` field is stars * 10;
// newer questions carry `stars` directly. The UI speaks ONLY in stars.
export function starsOf(exercise) {
  return exercise?.stars ?? Math.max(1, Math.round((exercise?.xp ?? 10) / 10));
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const TYPE_META = {
  mcq: { label: 'Multiple choice', icon: ListChecks },
  select_all: { label: 'Select all that apply', icon: ListChecks },
  fill_blank: { label: 'Short answer', icon: PenLine },
  write_code: { label: 'Write code', icon: SquareMousePointer },
};

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function defaultAnswer(exercise) {
  if (!exercise) return null;
  if (exercise.type === 'mcq') return { selected: null };
  if (exercise.type === 'select_all') return { selected: [] };
  if (exercise.type === 'fill_blank') return { value: '' };
  if (exercise.type === 'write_code') {
    return { code: exercise.starter_code ?? '# Write your solution here\n' };
  }
  return null;
}

function splitPrompt(prompt) {
  const [first, ...rest] = prompt.split('\n');
  return { title: first, code: rest.join('\n') };
}

// ─── drag & drop warm-up (client-side, ungraded) ──────────────────────────────

function DragDropWarmup({ config }) {
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
        <span className={m.warmupBadge}><SquareMousePointer size={13} /> Drag &amp; drop</span>
        <h3>{config.title}</h3>
        <p>{config.prompt}</p>
      </div>

      <div className={m.dndPool} aria-label="Character tiles">
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
        {pool.length === 0 && <span className={m.dndPoolEmpty}>All tiles placed</span>}
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
              aria-label={`Slot for index ${i}${tile ? `, holds ${tile.char}` : ', empty'}`}
            >
              {tile ? tile.char : ''}
            </button>
            <span className={m.dndSlotIndex}>{i}</span>
          </div>
        ))}
      </div>

      <div className={m.warmupFooter}>
        <button type="button" className={m.ghostButton} onClick={reset}>
          <RefreshCcw size={14} /> Shuffle again
        </button>
        <button
          type="button"
          className={m.solidButton}
          onClick={() => setChecked(true)}
          disabled={!complete}
        >
          Check placement
        </button>
      </div>

      {checked && (
        <p className={`${m.warmupVerdict} ${allCorrect ? m.warmupVerdictOk : m.warmupVerdictNo}`}>
          {allCorrect
            ? <><CheckCircle2 size={15} /> Every character is at its address. You're ready for the graded questions.</>
            : <><XCircle size={15} /> Some tiles are in the wrong box, and the highlighted slots need another look.</>}
        </p>
      )}
    </div>
  );
}

// ─── section wrapper: fetches once, offers Practice and Exam modes ────────────

export function PracticeSection({ practice, onVisualize }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState('practice');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exercises/${practice.apiModuleId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setExercises(data.exercises ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Cannot reach the server. Start the backend to load exercises.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [practice.apiModuleId]);

  if (loading) return <p className={m.practiceStatus}>Loading exercises…</p>;
  if (loadError) return <p className={m.practiceStatus}>{loadError}</p>;
  if (exercises.length === 0) return <p className={m.practiceStatus}>No exercises available for this module yet.</p>;

  const hasExam = Boolean(practice.exam);

  return (
    <div className={m.practiceStack}>
      {hasExam && (
        <div className={m.modeTabs} role="tablist" aria-label="Practice mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'practice'}
            className={`${m.modeTab} ${mode === 'practice' ? m.modeTabActive : ''}`}
            onClick={() => setMode('practice')}
          >
            <Dumbbell size={15} /> Practice
            <span className={m.modeTabHint}>one at a time, instant feedback</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'exam'}
            className={`${m.modeTab} ${mode === 'exam' ? m.modeTabActive : ''}`}
            onClick={() => setMode('exam')}
          >
            <GraduationCap size={15} /> Exam
            <span className={m.modeTabHint}>answer everything, then submit</span>
          </button>
        </div>
      )}

      {mode === 'exam' && hasExam ? (
        <ExamMode practice={practice} exercises={exercises} onVisualize={onVisualize} />
      ) : (
        <PracticeRunner practice={practice} exercises={exercises} />
      )}
    </div>
  );
}

// ─── graded exercise runner (real backend pipeline) ───────────────────────────

function PracticeRunner({ practice, exercises }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(() => defaultAnswer(exercises[0]));
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [stars, setStars] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const exercise = exercises[index] ?? null;

  useEffect(() => {
    setAnswer(defaultAnswer(exercise));
    setResult(null);
  }, [index, exercise]);

  const canCheck = useMemo(() => {
    if (!exercise || !answer) return false;
    if (exercise.type === 'mcq') return Boolean(answer.selected);
    if (exercise.type === 'select_all') return (answer.selected ?? []).length > 0;
    if (exercise.type === 'fill_blank') return (answer.value ?? '').trim().length > 0;
    if (exercise.type === 'write_code') return (answer.code ?? '').trim().length > 0;
    return false;
  }, [exercise, answer]);

  async function handleCheck() {
    if (!exercise) return;
    setSubmitting(true);
    const payload = { module_id: exercise.module_id, question_id: exercise.question_id };
    if (exercise.type === 'mcq') payload.answer = answer?.selected ?? '';
    if (exercise.type === 'fill_blank') payload.answer = answer?.value ?? '';
    if (exercise.type === 'select_all') payload.answers = answer?.selected ?? [];
    if (exercise.type === 'write_code') payload.code = answer?.code ?? '';

    try {
      const res = await fetch('/api/exercises/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data);
      if (data.correct) {
        setStars((prev) => prev + starsOf(exercise));
        setCorrectCount((prev) => prev + 1);
      }
    } catch {
      setResult({ correct: false, feedback: 'Cannot reach the server. Is the backend running?' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (index >= exercises.length - 1) setFinished(true);
    else setIndex((i) => i + 1);
  }

  function restart() {
    setIndex(0);
    setStars(0);
    setCorrectCount(0);
    setFinished(false);
    setAnswer(defaultAnswer(exercises[0]));
    setResult(null);
  }

  function toggleOption(option) {
    setAnswer((prev) => {
      const selected = prev?.selected ?? [];
      return {
        selected: selected.includes(option)
          ? selected.filter((o) => o !== option)
          : [...selected, option],
      };
    });
  }

  if (finished) {
    const percent = Math.round((correctCount / exercises.length) * 100);
    return (
      <div className={m.completionCard}>
        <span className={m.completionIcon}><Award size={30} /></span>
        <h3>Practice complete</h3>
        <p>
          You answered <strong>{correctCount} of {exercises.length}</strong> correctly ({percent}%)
          and earned <strong>{stars} {stars === 1 ? 'star' : 'stars'}</strong> <Star size={14} className={m.inlineStar} />.
          {percent >= 70
            ? ' That clears the 70% bar, and the next module is within reach.'
            : ' Aim for 70% to unlock the next module. Revisit the lesson above and try again.'}
        </p>
        <button type="button" className={m.solidButton} onClick={restart}>
          <RefreshCcw size={15} /> Practice again
        </button>
      </div>
    );
  }

  const { title: promptTitle, code: promptCode } = splitPrompt(exercise.prompt);
  const meta = TYPE_META[exercise.type] ?? TYPE_META.mcq;
  const MetaIcon = meta.icon;

  return (
    <div className={m.runnerStack}>
      {practice.warmup?.type === 'drag_drop' && index === 0 && !result && (
        <DragDropWarmup config={practice.warmup} />
      )}

      <div className={m.questionCard}>
        <header className={m.questionHeader}>
          <div className={m.questionMeta}>
            <span className={m.questionType}><MetaIcon size={13} /> {meta.label}</span>
            <span className={m.questionXp}>
              <Star size={13} /> {starsOf(exercise)} {starsOf(exercise) === 1 ? 'star' : 'stars'}
            </span>
          </div>
          <div className={m.questionProgress}>
            <span>Question {index + 1} of {exercises.length}</span>
            <div className={m.progressTrack}>
              <div
                className={m.progressFill}
                style={{ width: `${((index + 1) / exercises.length) * 100}%` }}
              />
            </div>
            <span className={m.sessionXp}><Star size={13} /> {stars}</span>
          </div>
        </header>

        <h3 className={m.questionTitle}>{promptTitle}</h3>
        {promptCode && <CodeBlock code={promptCode} />}

        {exercise.type === 'mcq' && (
          <div className={m.choiceList} role="radiogroup" aria-label="Answer choices">
            {exercise.options.map((choice, i) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={answer?.selected === choice}
                className={`${m.choice} ${answer?.selected === choice ? m.choiceSelected : ''}`}
                onClick={() => setAnswer({ selected: choice })}
                disabled={Boolean(result)}
              >
                <span className={m.choiceKey}>{String.fromCharCode(65 + i)}</span>
                <span className={m.choiceText}>{choice}</span>
              </button>
            ))}
          </div>
        )}

        {exercise.type === 'select_all' && (
          <div className={m.choiceList}>
            {exercise.options.map((choice) => {
              const on = (answer?.selected ?? []).includes(choice);
              return (
                <button
                  key={choice}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={`${m.choice} ${on ? m.choiceSelected : ''}`}
                  onClick={() => toggleOption(choice)}
                  disabled={Boolean(result)}
                >
                  <span className={`${m.choiceBox} ${on ? m.choiceBoxOn : ''}`}>
                    {on && <CheckCircle2 size={14} />}
                  </span>
                  <span className={m.choiceText}>{choice}</span>
                </button>
              );
            })}
          </div>
        )}

        {exercise.type === 'fill_blank' && (
          <input
            className={m.fillInput}
            value={answer?.value ?? ''}
            onChange={(e) => setAnswer({ value: e.target.value })}
            placeholder="Type your answer"
            disabled={Boolean(result)}
            aria-label="Your answer"
          />
        )}

        {exercise.type === 'write_code' && (
          <>
            <CodeExercise
              code={answer?.code ?? ''}
              onCodeChange={(code) => setAnswer({ code })}
              disabled={Boolean(result)}
            />
            {exercise.test_cases?.length > 0 && (
              <div className={m.testCases}>
                <span className={m.testCasesLabel}>Expected output</span>
                {exercise.test_cases.map((tc, i) => (
                  <code key={i}>
                    {tc.input ? `input: ${tc.input.trim()} → ` : ''}{tc.expected_output}
                  </code>
                ))}
              </div>
            )}
          </>
        )}

        <div aria-live="polite">
          {result && (
            <div className={`${m.feedbackBanner} ${result.correct ? m.feedbackOk : m.feedbackNo}`}>
              <span className={m.feedbackIcon}>
                {result.correct ? <CheckCircle2 size={18} /> : <Target size={18} />}
              </span>
              <div>
                <strong>{result.correct ? 'Correct' : 'Not quite'}</strong>
                <p><InlineText text={result.feedback ?? ''} /></p>
                {result.explanation && (
                  <p className={m.feedbackExplanation}>
                    <InlineText text={result.explanation} />
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className={m.questionFooter}>
          <button
            type="button"
            className={m.ghostButton}
            onClick={handleNext}
            disabled={Boolean(result)}
          >
            Skip
          </button>
          {!result ? (
            <button
              type="button"
              className={m.solidButton}
              onClick={handleCheck}
              disabled={!canCheck || submitting}
            >
              {submitting ? 'Checking…' : 'Check answer'}
            </button>
          ) : (
            <button type="button" className={m.solidButton} onClick={handleNext}>
              {index >= exercises.length - 1 ? 'Finish' : 'Next question'} <ChevronRight size={15} />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
