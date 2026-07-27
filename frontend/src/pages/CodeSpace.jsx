import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Code2, Eye, Pause, Play, Terminal, Trash2,
} from 'lucide-react';
import styles from '../styles/App.module.css';
import { getApiUrl } from '../config/api';
import { SpeedControl } from '../components/SpeedControl';

// How long one step is held at 1× speed; the speed picker divides this.
const STEP_INTERVAL_MS = 700;

// ─── default starter code ────────────────────────────────────────────────────
const DEFAULT_CODE = `# Try the debugger, step through this code
text = "Hello, World!"

# Index access
ch = text[1]
print(ch)

# Slicing
part = text[1:5]
print(part)

# For loop over a string
for c in text:
    print(c)

# While loop
i = 0
while i < 3:
    print(text[i])
    i = i + 1

# If statement
if len(text) > 5:
    print("Long string!")
else:
    print("Short string.")
`;

const INDENT = '    ';

// ─── helpers ──────────────────────────────────────────────────────────────────
function eventLabel(event) {
  const map = {
    assign: 'Assignment', for: 'For Loop', while: 'While Loop',
    if: 'If Statement', print: 'Print', call: 'Call', stmt: 'Statement', error: 'Error',
  };
  return map[event] || event;
}

// ─── for-loop diagram ─────────────────────────────────────────────────────────
function displayLoopItem(raw, kind) {
  if (kind === 'char') return raw === ' ' ? '␣' : raw;
  return raw;
}

function ForLoopDiagram({ loop }) {
  const { var: varName, iteration, total, items, kind } = loop;
  const current = iteration - 1; // 0-based index of the active item
  const currentRaw = items[current] ?? '';
  const currentDisplay = displayLoopItem(currentRaw, kind);
  const pct = total > 0 ? (iteration / total) * 100 : 0;
  const sequenceLabel = kind === 'char' ? 'characters' : 'sequence';

  return (
    <div className={styles.flpDiagram}>
      {/* header: badge + loop signature + counter */}
      <div className={styles.flpHeader}>
        <span className={styles.flpBadge}>for&nbsp;loop</span>
        <div className={styles.flpSignature}>
          <span className={styles.flpKw}>for</span>
          <span className={styles.flpVar}>{varName}</span>
          <span className={styles.flpKw}>in</span>
          <span className={styles.flpSeq}>{sequenceLabel}</span>
          <span className={styles.flpColon}>:</span>
        </div>
        <span className={styles.flpCounter}>
          pass <b>{iteration}</b> of {total}
        </span>
      </div>

      {/* the sequence being walked, one cell per element */}
      <div className={styles.flpTrackWrap}>
        <div className={styles.flpTrackHead}>
          <span>The loop walks through each element, left to right</span>
        </div>
        <div className={styles.flpTrack}>
          {items.map((it, i) => {
            const state =
              i < current ? styles.flpDone : i === current ? styles.flpActive : styles.flpTodo;
            return (
              <div key={i} className={`${styles.flpCell} ${state}`}>
                <span className={styles.flpCellIdx}>{i}</span>
                <span className={styles.flpCellVal}>{displayLoopItem(it, kind)}</span>
                {i === current && <span className={styles.flpCellPointer} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* flow: current element → loop variable → body → back to top */}
      <div className={styles.flpFlow}>
        <div className={styles.flpFlowNode}>
          <span className={styles.flpFlowLabel}>current element</span>
          <span className={styles.flpFlowValue}>{currentDisplay}</span>
        </div>
        <span className={styles.flpFlowArrow}>→</span>
        <div className={`${styles.flpFlowNode} ${styles.flpFlowVar}`}>
          <span className={styles.flpFlowLabel}>loop variable</span>
          <span className={styles.flpFlowValue}>
            <code>{varName}</code> = <code>{currentDisplay}</code>
          </span>
        </div>
        <span className={styles.flpFlowArrow}>→</span>
        <div className={`${styles.flpFlowNode} ${styles.flpFlowBody}`}>
          <span className={styles.flpFlowLabel}>runs</span>
          <span className={styles.flpFlowValue}>loop body</span>
        </div>
        <span className={styles.flpLoopBack} title="repeats for the next element">↺</span>
      </div>

    </div>
  );
}

// ─── while-loop diagram ───────────────────────────────────────────────────────
function WhileLoopDiagram({ ctx, steps }) {
  const { condition, condition_eval: conditionEval, iteration, result, line } = ctx;

  // reconstruct every condition check for this loop from the trace
  const byIter = new Map();
  for (const s of steps) {
    if (s.event === 'while' && s.line === line && typeof s.iteration === 'number') {
      byIter.set(s.iteration, s.condition_result);
    }
  }
  const passes = [...byIter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([iter, res]) => ({ iter, res }));

  return (
    <div className={styles.flpDiagram}>
      <div className={styles.flpHeader}>
        <span className={styles.flpBadge}>while&nbsp;loop</span>
        <div className={styles.flpSignature}>
          <span className={styles.flpKw}>while</span>
          <span className={styles.flpCond}>{condition}</span>
          <span className={styles.flpColon}>:</span>
        </div>
        <span className={styles.flpCounter}>
          check <b>{iteration}</b>
        </span>
      </div>

      {/* condition with the current values plugged in */}
      <div className={styles.flpEval}>
        <code className={styles.flpEvalRaw}>{condition}</code>
        <span className={styles.flpEvalArrow}>→</span>
        <code className={styles.flpEvalSub}>{conditionEval}</code>
        <span className={result ? styles.flpEvalTrue : styles.flpEvalFalse}>
          {result ? 'True' : 'False'}
        </span>
      </div>

      {/* one chip per condition check */}
      <div className={styles.flpTrackWrap}>
        <div className={styles.flpTrackHead}>
          <span>Each pass re-checks the condition before the body runs</span>
        </div>
        <div className={styles.flpTrack}>
          {passes.map((p) => {
            const state =
              p.iter < iteration
                ? styles.flpDone
                : p.iter === iteration
                  ? styles.flpActive
                  : styles.flpTodo;
            return (
              <div key={p.iter} className={`${styles.flpPass} ${state}`}>
                <span className={styles.flpPassNo}>check {p.iter}</span>
                <span className={p.res ? styles.flpTrue : styles.flpFalse}>
                  {p.res ? 'true · run body' : 'false · stop'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* current condition → result → action */}
      <div className={styles.flpFlow}>
        <div className={styles.flpFlowNode}>
          <span className={styles.flpFlowLabel}>condition</span>
          <span className={styles.flpFlowValue}>
            <code>{condition}</code>
          </span>
        </div>
        <span className={styles.flpFlowArrow}>→</span>
        <div className={`${styles.flpFlowNode} ${result ? styles.flpTrueNode : styles.flpFalseNode}`}>
          <span className={styles.flpFlowLabel}>evaluates to</span>
          <span className={styles.flpFlowValue}>{result ? 'True' : 'False'}</span>
        </div>
        <span className={styles.flpFlowArrow}>→</span>
        <div className={`${styles.flpFlowNode} ${styles.flpFlowBody}`}>
          <span className={styles.flpFlowLabel}>so we</span>
          <span className={styles.flpFlowValue}>{result ? 'run the body' : 'exit the loop'}</span>
        </div>
        {result && (
          <span className={styles.flpLoopBack} title="then check the condition again">↺</span>
        )}
      </div>
    </div>
  );
}

// ─── if-statement diagram ─────────────────────────────────────────────────────
function IfStatementDiagram({ ctx }) {
  const { condition, condition_eval: conditionEval, result, taken, has_else: hasElse } = ctx;

  return (
    <div className={styles.flpDiagram}>
      <div className={styles.flpHeader}>
        <span className={styles.flpBadge}>if&nbsp;statement</span>
        <div className={styles.flpSignature}>
          <span className={styles.flpKw}>if</span>
          <span className={styles.flpCond}>{condition}</span>
          <span className={styles.flpColon}>:</span>
        </div>
        <span className={`${styles.flpCounter} ${result ? styles.flpTrueText : styles.flpFalseText}`}>
          {result ? 'True' : 'False'}
        </span>
      </div>

      {/* the condition evaluated */}
      <div className={styles.ifCondBox}>
        <span className={styles.flpFlowLabel}>condition</span>
        <span className={styles.ifCondValue}>
          <code>{condition}</code>
          <span className={styles.flpEvalArrow}>→</span>
          <code className={styles.ifCondSub}>{conditionEval}</code>
        </span>
        <span className={result ? styles.ifResultTrue : styles.ifResultFalse}>
          {result ? 'TRUE' : 'FALSE'}
        </span>
      </div>

      <div className={styles.ifSplit} aria-hidden="true">chooses one path</div>

      {/* the two possible branches */}
      <div className={styles.ifBranches}>
        <div
          className={`${styles.ifBranch} ${taken === 'if' ? styles.ifBranchTaken : styles.ifBranchSkipped}`}
        >
          <div className={styles.ifBranchHead}>
            <span className={styles.ifBranchTag}>condition True</span>
            {taken === 'if' && <span className={styles.ifTakenPill}>✓ path taken</span>}
          </div>
          <p className={styles.ifBranchDesc}>
            run the <code>if</code> block
          </p>
        </div>

        <div
          className={`${styles.ifBranch} ${taken === 'else' ? styles.ifBranchTaken : styles.ifBranchSkipped}`}
        >
          <div className={styles.ifBranchHead}>
            <span className={styles.ifBranchTag}>{hasElse ? 'condition False' : 'condition False'}</span>
            {taken === 'else' && <span className={styles.ifTakenPill}>✓ path taken</span>}
          </div>
          <p className={styles.ifBranchDesc}>
            {hasElse ? (
              <>run the <code>else</code> block</>
            ) : (
              <>skip the <code>if</code> block</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function highlightPython(code) {
  const tokenRegex = /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b(?:def|class|if|elif|else|for|while|in|return|break|continue|pass|try|except|finally|with|as|import|from|True|False|None|and|or|not|lambda|yield)\b|\b(?:print|len|range|enumerate|str|int|float|list|dict|set|tuple)\b)/g;

  return code.split('\n').map((line) => {
    let out = '';
    let cursor = 0;

    for (const match of line.matchAll(tokenRegex)) {
      const token = match[0];
      const index = match.index ?? 0;

      out += escapeHtml(line.slice(cursor, index));

      if (token.startsWith('#')) {
        out += `<span class="${styles.pyComment}">${escapeHtml(token)}</span>`;
      } else if (token.startsWith('"') || token.startsWith("'")) {
        out += `<span class="${styles.pyString}">${escapeHtml(token)}</span>`;
      } else if (/^\d/.test(token)) {
        out += `<span class="${styles.pyNumber}">${escapeHtml(token)}</span>`;
      } else if (/^(print|len|range|enumerate|str|int|float|list|dict|set|tuple)$/.test(token)) {
        out += `<span class="${styles.pyBuiltin}">${escapeHtml(token)}</span>`;
      } else {
        out += `<span class="${styles.pyKeyword}">${escapeHtml(token)}</span>`;
      }

      cursor = index + token.length;
    }

    out += escapeHtml(line.slice(cursor));
    return out;
  }).join('\n');
}

// ─── component ────────────────────────────────────────────────────────────────
export function CodeSpace() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [editorLine, setEditorLine] = useState(1);
  const playTimer = useRef(null);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const highlightRef = useRef(null);
  const outputRef = useRef(null);
  const pendingSelectionRef = useRef(null);
  const codeLines = code.split('\n');

  // current step
  const step = steps[stepIndex] ?? null;

  // active construct context (for / while / if) attached by the tracer
  const activeCtx = step?.ctx ?? null;

  const incrementalStdout = useMemo(() => {
    if (!debugging || steps.length === 0) return '';

    return steps
      .slice(0, stepIndex + 1)
      .filter(currentStep => currentStep.event === 'print' && currentStep.output)
      .map(currentStep => currentStep.output)
      .join('\n');
  }, [debugging, stepIndex, steps]);

  const displayedOutput = stderr
    ? stderr
    : debugging
      ? incrementalStdout || 'Step through your code to see output build up here.'
      : stdout || 'Run your code to see output here.';

  const highlightedCode = useMemo(() => highlightPython(code), [code]);

  // ── playback ────────────────────────────────────────────────────────────────
  function stopPlay() {
    clearInterval(playTimer.current);
    setPlaying(false);
  }

  function togglePlay() {
    if (playing) { stopPlay(); return; }
    if (steps.length === 0) return;
    if (stepIndex >= steps.length - 1) setStepIndex(0);
    setPlaying(true);
  }

  // `speed` is a multiplier on the base step interval; changing it mid-play
  // rebuilds the timer, so the new pace takes effect immediately.
  useEffect(() => {
    if (!playing) return;
    playTimer.current = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= steps.length - 1) { stopPlay(); return prev; }
        return prev + 1;
      });
    }, STEP_INTERVAL_MS / speed);
    return () => clearInterval(playTimer.current);
  }, [playing, steps.length, speed]);

  useEffect(() => {
    if (!pendingSelectionRef.current || !textareaRef.current) return;

    const { start, end } = pendingSelectionRef.current;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(start, end);
    setEditorLine(code.slice(0, start).split('\n').length);
    pendingSelectionRef.current = null;
  }, [code]);

  function syncEditorScroll(target) {
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = target.scrollTop;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
  }

  // auto-scroll editor so the currently-executing line stays visible
  useEffect(() => {
    if (!debugging || !step?.line || !textareaRef.current) return;
    const LINE_H = 26;
    const pane = textareaRef.current;
    const target = (step.line - 1) * LINE_H;
    const desired = Math.max(0, target - pane.clientHeight * 0.35);
    pane.scrollTop = desired;
    syncEditorScroll(pane);
  }, [debugging, step?.line]);

  // auto-scroll output pane to the bottom as new lines are printed
  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [displayedOutput]);

  function setCodeWithSelection(nextCode, start, end = start) {
    pendingSelectionRef.current = { start, end };
    setCode(nextCode);
    stopPlay();
    setStepIndex(0);
  }

  function handleCaretUpdate(target) {
    const index = target.selectionStart ?? 0;
    setEditorLine(code.slice(0, index).split('\n').length);
  }

  function handleEditorKeyDown(event) {
    const target = event.currentTarget;
    const { selectionStart, selectionEnd } = target;

    if (event.key === 'Tab') {
      event.preventDefault();

      if (selectionStart === selectionEnd) {
        if (event.shiftKey) {
          const lineStart = code.lastIndexOf('\n', selectionStart - 1) + 1;
          const beforeCaret = code.slice(lineStart, selectionStart);
          const removable = Math.min(INDENT.length, (beforeCaret.match(/\s*$/)?.[0].length ?? 0));

          if (removable > 0) {
            const next = `${code.slice(0, selectionStart - removable)}${code.slice(selectionStart)}`;
            setCodeWithSelection(next, selectionStart - removable);
          }
          return;
        }

        const next = `${code.slice(0, selectionStart)}${INDENT}${code.slice(selectionEnd)}`;
        setCodeWithSelection(next, selectionStart + INDENT.length);
        return;
      }

      const lineStart = code.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEnd = code.indexOf('\n', selectionEnd) === -1 ? code.length : code.indexOf('\n', selectionEnd);
      const selectedBlock = code.slice(lineStart, lineEnd);
      const lines = selectedBlock.split('\n');

      if (event.shiftKey) {
        const removed = [];
        const outdented = lines.map((line) => {
          const count = Math.min(INDENT.length, line.match(/^\s*/)?.[0].length ?? 0);
          removed.push(count);
          return line.slice(count);
        });

        const nextBlock = outdented.join('\n');
        const next = `${code.slice(0, lineStart)}${nextBlock}${code.slice(lineEnd)}`;
        const removedFirst = removed[0] ?? 0;
        const removedTotal = removed.reduce((sum, val) => sum + val, 0);
        const nextStart = Math.max(lineStart, selectionStart - removedFirst);
        const nextEnd = Math.max(nextStart, selectionEnd - removedTotal);
        setCodeWithSelection(next, nextStart, nextEnd);
      } else {
        const indented = lines.map(line => `${INDENT}${line}`).join('\n');
        const next = `${code.slice(0, lineStart)}${indented}${code.slice(lineEnd)}`;
        const nextStart = selectionStart + INDENT.length;
        const nextEnd = selectionEnd + (INDENT.length * lines.length);
        setCodeWithSelection(next, nextStart, nextEnd);
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const lineStart = code.lastIndexOf('\n', selectionStart - 1) + 1;
      const beforeCursor = code.slice(lineStart, selectionStart);
      const currentIndent = beforeCursor.match(/^\s*/)?.[0] ?? '';
      const extraIndent = beforeCursor.trimEnd().endsWith(':') ? INDENT : '';
      const insertion = `\n${currentIndent}${extraIndent}`;

      const next = `${code.slice(0, selectionStart)}${insertion}${code.slice(selectionEnd)}`;
      const caret = selectionStart + insertion.length;
      setCodeWithSelection(next, caret);
    }
  }

  // ── run code (execute + trace) ───────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    stopPlay();
    setLoading(true);
    setStderr('');
    setSteps([]);
    setStepIndex(0);
    setDebugging(false);

    try {
      const [execRes, debugRes] = await Promise.all([
        fetch(getApiUrl('/api/execute'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }),
        fetch(getApiUrl('/api/debug'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }),
      ]);

      const execData = await execRes.json();
      const debugData = await debugRes.json();

      setStdout(execData.stdout ?? '');
      setStderr(execData.stderr ?? '');
      setSteps(debugData.steps ?? []);
      setDebugging((debugData.steps ?? []).length > 0);
    } catch {
      setStderr('Cannot reach server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [code]);

  function handleClear() {
    stopPlay();
    setCode(DEFAULT_CODE);
    setStdout('');
    setStderr('');
    setSteps([]);
    setStepIndex(0);
    setDebugging(false);
  }

  function prev() { stopPlay(); setStepIndex(i => Math.max(0, i - 1)); }
  function next() { stopPlay(); setStepIndex(i => Math.min(steps.length - 1, i + 1)); }

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.codeSpaceScreen}>
      {/* ── header ── */}
      <header className={styles.codeHero}>
        <div className={styles.codeTitleGroup}>
          <div className={styles.purpleIcon}><Code2 size={26} /></div>
          <div>
            <h1>Code Space</h1>
            <p>Write Python code and step through it like a debugger.</p>
          </div>
        </div>
        <button className={styles.codeClearButton} onClick={handleClear}>
          <Trash2 size={22} /> Clear
        </button>
      </header>

      <main className={styles.codeSpaceGrid}>
        {/* ── left: editor + output ── */}
        <section className={styles.codeLeftColumn}>
          <article className={styles.codePanel}>
            <div className={styles.codePanelHeader}>
              <span className={styles.softIcon}><Code2 size={22} /></span>
              <h2>Code Editor</h2>
              <div className={styles.codePanelHeaderActions}>
                <button
                  className={styles.codeRunIconButton}
                  onClick={handleRun}
                  disabled={loading}
                  title={loading ? 'Running...' : 'Run code'}
                  aria-label={loading ? 'Running code' : 'Run code'}
                >
                  <Play size={18} fill="currentColor" />
                </button>
              </div>
            </div>
            <div className={styles.codeEditorBox}>
              <div ref={lineNumbersRef} className={styles.lineNumbers} aria-hidden="true">
                {codeLines.map((_, i) => (
                  <span
                    key={i}
                    className={
                      (step?.line === i + 1 || (!debugging && editorLine === i + 1))
                        ? styles.activeLineNo
                        : ''
                    }
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
              <div className={styles.codeEditorPane}>
                <pre
                  ref={highlightRef}
                  className={styles.codeHighlight}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: `${highlightedCode}\n` }}
                />
                <textarea
                  ref={textareaRef}
                  className={styles.codeTextarea}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    stopPlay();
                    setStepIndex(0);
                    handleCaretUpdate(e.target);
                  }}
                  onScroll={(e) => syncEditorScroll(e.target)}
                  onKeyDown={handleEditorKeyDown}
                  onClick={(e) => handleCaretUpdate(e.target)}
                  onKeyUp={(e) => handleCaretUpdate(e.target)}
                  onSelect={(e) => handleCaretUpdate(e.target)}
                  spellCheck={false}
                />
              </div>
            </div>
          </article>

          <article className={styles.codePanel}>
            <div className={styles.codePanelHeader}>
              <span className={styles.softIcon}><Terminal size={22} /></span>
              <h2>Output</h2>
            </div>
            <pre ref={outputRef} className={styles.codeOutput}>
              {stderr
                ? <span style={{ color: '#d32f2f' }}>{displayedOutput}</span>
                : displayedOutput}
            </pre>
          </article>
        </section>

        {/* ── right: visualiser panel ── */}
        <section className={styles.visualPanelWide}>
          <div className={styles.dbgTopBar}>
            <div className={styles.dbgTopLeft}>
              <span className={styles.eyeIcon}><Eye size={26} /></span>
              <h2>Visualiser</h2>
            </div>
            {debugging && (
              <div className={styles.dbgTopRight}>
                <span className={styles.dbgStepPill}>
                  {stepIndex + 1} / {steps.length}
                </span>
                {step && <span className={styles.dbgLineTag}>Line {step.line}</span>}
              </div>
            )}
          </div>

          <div className={styles.playerControls}>
            <button onClick={prev} disabled={!debugging || stepIndex === 0}>
              <ArrowLeft size={22} /> Previous
            </button>
            <button onClick={togglePlay} disabled={!debugging || steps.length === 0}>
              {playing
                ? <><Pause size={20} fill="currentColor" /> Pause</>
                : <><Play size={20} fill="currentColor" /> Play</>}
            </button>
            <button onClick={next} disabled={!debugging || stepIndex === steps.length - 1}>
              Next <ArrowRight size={24} />
            </button>
            <SpeedControl
              value={speed}
              onChange={setSpeed}
              disabled={!debugging || steps.length === 0}
            />
          </div>

          {debugging && (
            <div className={styles.dbgProgressSlim}>
              <div
                className={styles.dbgProgressBar}
                style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
          )}

          {!debugging ? (
            <div className={styles.dbgPlaceholder}>
              <p>Press <strong>Run</strong> to step through your code.</p>
              <p className={styles.dbgHint}>
                Works with <code>for</code>, <code>while</code>, <code>if</code>,
                indexing, slicing, and string methods.
              </p>
            </div>
          ) : (
            <>
              {activeCtx?.type === 'for' && <ForLoopDiagram loop={activeCtx} />}
              {activeCtx?.type === 'while' && <WhileLoopDiagram ctx={activeCtx} steps={steps} />}
              {activeCtx?.type === 'if' && <IfStatementDiagram ctx={activeCtx} />}

              {step && (
                <p className={styles.dbgStepDesc}>
                  <span className={styles.dbgEventTag}>{eventLabel(step.event)}</span>
                  <span className={styles.dbgStepText}>{step.description}</span>
                </p>
              )}

            </>
          )}

          {/* Variables live at the foot of the visualiser: they describe the
              step being shown here, not the program's printed output. */}
          {step && Object.keys(step.variables).length > 0 && (
            <div className={styles.dbgVarsBlock}>
              <h3 className={styles.dbgVarsCaption}>Variables at this step</h3>
              <div className={styles.dbgVarsScroll}>
                <table className={styles.dbgVarsTable}>
                  <thead>
                    <tr>
                      <th>Variable</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(step.variables).map(([k, v]) => (
                      <tr key={k}>
                        <td className={styles.dbgVarName}>{k}</td>
                        <td className={styles.dbgVarValue}>
                          {typeof v === 'string' ? `"${v}"` : String(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
