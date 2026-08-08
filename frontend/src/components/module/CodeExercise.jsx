import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Eye, EyeOff, Play, Terminal,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { highlightPython } from '../../utils/pythonHighlight';
import { useLanguage } from '../../context/LanguageContext';
import { transpilePythonToIsiXhosa, transpileIsiXhosaToPython } from '../../utils/isiXhosaTranspiler';

const INDENT = '    ';

const HIGHLIGHT_CLASSES = {
  comment: m.pyComment,
  string: m.pyString,
  number: m.pyNumber,
  builtin: m.pyBuiltin,
  keyword: m.pyKeyword,
};

// Compact code editor + runner for embedded coding exercises.
// Runs against the existing backend: /api/execute for output and
// /api/debug for the step-by-step trace used by "Visualize code".
export function CodeExercise({ code, onCodeChange, disabled }) {
  const { t, lang } = useLanguage();
  const displayed = lang === 'xh' ? transpilePythonToIsiXhosa(code) : code;
  const html = useMemo(() => highlightPython(displayed, HIGHLIGHT_CLASSES), [displayed]);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [showTrace, setShowTrace] = useState(false);
  const highlightRef = useRef(null);

  const step = steps[stepIndex] ?? null;

  function syncScroll(target) {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
  }

  function handleKeyDown(event) {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const target = event.currentTarget;
    const { selectionStart, selectionEnd } = target;
    const next = `${code.slice(0, selectionStart)}${INDENT}${code.slice(selectionEnd)}`;
    onCodeChange(next);
    requestAnimationFrame(() => {
      target.setSelectionRange(selectionStart + INDENT.length, selectionStart + INDENT.length);
    });
  }

  async function handleRun() {
    setRunning(true);
    setStderr('');
    setSteps([]);
    setStepIndex(0);
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
    } catch {
      setStderr('Cannot reach the server. Is the backend running?');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={m.codeExercise}>
      <div className={m.miniEditor}>
        <pre
          ref={highlightRef}
          className={m.miniEditorHighlight}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: `${html}\n` }}
        />
        <textarea
          className={m.miniEditorTextarea}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onScroll={(e) => syncScroll(e.target)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          disabled={disabled}
          aria-label={t('a11y.codeEditor')}
        />
      </div>

      <div className={m.codeExerciseToolbar}>
        <button type="button" className={m.ghostButton} onClick={handleRun} disabled={running}>
          <Play size={15} /> {running ? t('codeExercise.running') : t('codeExercise.runCode')}
        </button>
        <button
          type="button"
          className={m.ghostButton}
          onClick={() => setShowTrace((v) => !v)}
          disabled={steps.length === 0}
          title={steps.length === 0 ? t('codeExercise.runFirst') : undefined}
        >
          {showTrace ? <EyeOff size={15} /> : <Eye size={15} />}
          {showTrace ? t('codeExercise.hideSteps') : t('codeExercise.visualizeCode')}
        </button>
      </div>

      {(stdout || stderr) && (
        <pre className={`${m.codeExerciseOutput} ${stderr ? m.codeExerciseOutputError : ''}`}>
          <span className={m.outputLabel}><Terminal size={13} /> {t('codeExercise.output')}</span>
          {stderr || stdout}
        </pre>
      )}

      {showTrace && steps.length > 0 && (
        <div className={m.traceBox}>
          <div className={m.traceHeader}>
            <span>{t('codeExercise.step', { current: stepIndex + 1, total: steps.length })}</span>
            <div className={m.traceNav}>
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                disabled={stepIndex === 0}
                aria-label={t('a11y.previousStep')}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                disabled={stepIndex === steps.length - 1}
                aria-label={t('a11y.nextStep')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {step && (
            <>
              <p className={m.traceDescription}>
                <span className={m.traceLine}>{t('codeExercise.line', { number: step.line })}</span>
                {step.description}
              </p>
              {step.variables && Object.keys(step.variables).length > 0 && (
                <div className={m.traceVars}>
                  {Object.entries(step.variables).map(([name, value]) => (
                    <code key={name}>
                      {name} = {typeof value === 'string' ? `"${value}"` : String(value)}
                    </code>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
