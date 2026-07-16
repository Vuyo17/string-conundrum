import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Code2, Eye, Pause, Play, Terminal, Trash2,
} from 'lucide-react';
import styles from '../styles/App.module.css';

// ─── default starter code ────────────────────────────────────────────────────
const DEFAULT_CODE = `# Try the debugger — step through this code
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
function firstStringVar(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === 'string') return { name: k, value: v };
  }
  return null;
}

function eventLabel(event) {
  const map = {
    assign: 'Assignment', for: 'For Loop', while: 'While Loop',
    if: 'If Statement', print: 'Print', call: 'Call', stmt: 'Statement', error: 'Error',
  };
  return map[event] || event;
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

  // resolve which string to show in the visualiser
  const visStringVar = useMemo(() => {
    if (!step) return null;
    return firstStringVar(step.variables);
  }, [step]);
  const visString = visStringVar?.value ?? '';

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

  useEffect(() => {
    if (!playing) return;
    playTimer.current = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= steps.length - 1) { stopPlay(); return prev; }
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(playTimer.current);
  }, [playing, steps.length]);

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
        fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }),
        fetch('/api/debug', {
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
        <button className={styles.codeRunMain} onClick={handleRun} disabled={loading}>
          <Play size={24} fill="currentColor" /> {loading ? 'Running…' : 'Run'}
        </button>
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
              {visString ? (
                <div className={styles.dbgStringHero}>
                  <div className={styles.dbgStrCaption}>
                    <code>{visStringVar?.name ?? 'string'}</code>
                    <span className={styles.dbgLenTag}>length {visString.length}</span>
                  </div>

                  <div className={styles.stringVisualArea}>
                    <div
                      className={styles.indexRowSingle}
                      style={{ gridTemplateColumns: `repeat(${visString.length}, 56px)` }}
                    >
                      {visString.split('').map((_, i) => (
                        <span key={`i-${i}`}>{i}</span>
                      ))}
                    </div>

                    <div
                      className={styles.charGrid}
                      style={{ gridTemplateColumns: `repeat(${visString.length}, 56px)` }}
                    >
                      {visString.split('').map((letter, i) => (
                        <span
                          key={`${letter}-${i}`}
                          className={step?.highlight?.includes(i) ? styles.charSelected : ''}
                        >
                          {letter === ' ' ? '·' : letter}
                        </span>
                      ))}
                    </div>

                    <div
                      className={styles.arrowGrid}
                      style={{ gridTemplateColumns: `repeat(${visString.length}, 56px)` }}
                    >
                      {visString.split('').map((_, i) => (
                        <span key={i}>{step?.highlight?.includes(i) ? '↑' : ''}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.dbgNoString}>
                  No string variable in scope yet on this step.
                </div>
              )}

              {step && (
                <p className={styles.dbgStepDesc}>
                  <span className={styles.dbgEventTag}>{eventLabel(step.event)}</span>
                  <span className={styles.dbgStepText}>{step.description}</span>
                </p>
              )}

              {step && Object.keys(step.variables).length > 0 && (
                <div className={styles.dbgVarChips}>
                  {Object.entries(step.variables).map(([k, v]) => (
                    <span key={k} className={styles.dbgVarChip}>
                      <b>{k}</b>
                      <span className={styles.dbgVarEq}>=</span>
                      <code>{typeof v === 'string' ? `"${v}"` : String(v)}</code>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
