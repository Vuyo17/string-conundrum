import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy, Play, CheckCircle2, XCircle, Lightbulb, Sparkles, RotateCcw, TerminalSquare,
} from 'lucide-react';
import styles from '../styles/App.module.css';
import { getApiUrl } from '../config/api';

const INDENT = '    ';

// ─── lightweight python highlighter (mirrors Code Space) ──────────────────────
function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function highlightPython(code) {
  const tokenRegex = /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b(?:def|class|if|elif|else|for|while|in|return|break|continue|pass|import|from|True|False|None|and|or|not|lambda)\b|\b(?:print|len|range|enumerate|str|int|float|list|dict|set|tuple|sorted|reversed|join|split)\b)/g;

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
      } else if (/^(print|len|range|enumerate|str|int|float|list|dict|set|tuple|sorted|reversed|join|split)$/.test(token)) {
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

function formatValue(value) {
  if (value === undefined) return '—';
  return JSON.stringify(value);
}

// ─── component ────────────────────────────────────────────────────────────────
export function Challenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [codeById, setCodeById] = useState({});
  const [resultById, setResultById] = useState({});
  const [solved, setSolved] = useState(() => new Set());
  const [showHint, setShowHint] = useState(false);
  const [running, setRunning] = useState(false);

  const textareaRef = useRef(null);
  const highlightRef = useRef(null);

  // ── load challenges once ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl('/api/challenges'))
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = data.challenges ?? [];
        setChallenges(list);
        setActiveId(list[0]?.id ?? null);
        setCodeById(Object.fromEntries(list.map((c) => [c.id, c.starter_code])));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Cannot reach server. Is the backend running?');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const challenge = useMemo(
    () => challenges.find((c) => c.id === activeId) ?? null,
    [challenges, activeId],
  );
  const code = challenge ? (codeById[challenge.id] ?? '') : '';
  const result = challenge ? resultById[challenge.id] ?? null : null;
  const highlighted = useMemo(() => highlightPython(code), [code]);

  useEffect(() => { setShowHint(false); }, [activeId]);

  function updateCode(next) {
    if (!challenge) return;
    setCodeById((prev) => ({ ...prev, [challenge.id]: next }));
  }

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
    const { selectionStart, selectionEnd, value } = target;
    const next = `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`;
    updateCode(next);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = selectionStart + INDENT.length;
    });
  }

  async function handleRun() {
    if (!challenge) return;
    setRunning(true);
    try {
      const res = await fetch(getApiUrl('/api/challenges/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challenge.id, code }),
      });
      const data = await res.json();
      setResultById((prev) => ({ ...prev, [challenge.id]: data }));
      if (data.all_passed) {
        setSolved((prev) => new Set(prev).add(challenge.id));
      }
    } catch {
      setResultById((prev) => ({
        ...prev,
        [challenge.id]: { ok: false, results: [], stderr: 'Cannot reach server. Is the backend running?' },
      }));
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    if (!challenge) return;
    updateCode(challenge.starter_code);
    setResultById((prev) => ({ ...prev, [challenge.id]: null }));
  }

  if (loading) {
    return <div className={styles.challengeLayout}><p className={styles.exerciseLoading}>Loading challenges…</p></div>;
  }
  if (loadError) {
    return <div className={styles.challengeLayout}><p className={styles.exerciseLoading}>{loadError}</p></div>;
  }
  if (!challenge) {
    return <div className={styles.challengeLayout}><p className={styles.emptyState}>No challenges available yet.</p></div>;
  }

  const solvedCount = solved.size;

  return (
    <div className={styles.challengeScreenLc}>
      {/* ── header ── */}
      <header className={styles.challengeHeroLc}>
        <div className={styles.challengeTitleGroupLc}>
          <div className={styles.trophyIconLc}><TerminalSquare size={22} /></div>
          <div>
            <h1>Challenges</h1>
            <p>LeetCode-style coding problems with stdin/stdout test cases.</p>
          </div>
        </div>
        <div className={styles.challengeScoreLc}>
          <Sparkles size={16} />
          <span><b>{solvedCount}</b> of {challenges.length} solved</span>
        </div>
      </header>

      {/* ── challenge tabs ── */}
      <div className={styles.challengeTabsLc}>
        {challenges.map((c, i) => {
          const isSolved = solved.has(c.id);
          return (
            <button
              key={c.id}
              className={`${styles.challengeTabLc} ${c.id === activeId ? styles.challengeTabActiveLc : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              <span className={styles.challengeTabNoLc}>
                {isSolved ? <CheckCircle2 size={16} /> : i + 1}
              </span>
              <span className={styles.challengeTabTextLc}>
                <strong>{c.title}</strong>
                <span className={`${styles.challengeDiffLc} ${styles[`diff${c.difficulty}`] ?? ''}`}>
                  {c.difficulty}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <main className={styles.challengeGridLc}>
        {/* ── left: prompt + editor ── */}
        <section className={styles.challengeLeftLc}>
          <article className={styles.challengePromptLc}>
            <div className={styles.challengePromptHeadLc}>
              <h2>{challenge.title}</h2>
              {solved.has(challenge.id) && (
                <span className={styles.solvedPillLc}><CheckCircle2 size={14} /> Solved</span>
              )}
            </div>
            <p className={styles.challengeDescLc}>{challenge.description}</p>

            <div className={styles.challengeIoGridLc}>
              <div className={styles.challengeIoCardLc}>
                <h3>Input</h3>
                <p>{challenge.io?.input ?? 'See test cases for exact stdin format.'}</p>
              </div>
              <div className={styles.challengeIoCardLc}>
                <h3>Output</h3>
                <p>{challenge.io?.output ?? 'Print the expected output for each input.'}</p>
              </div>
            </div>

            <button className={styles.hintToggleLc} onClick={() => setShowHint((s) => !s)}>
              <Lightbulb size={15} /> {showHint ? 'Hide hint' : 'Show hint'}
            </button>
            {showHint && <p className={styles.hintTextLc}>{challenge.hint}</p>}
          </article>

          <article className={styles.challengeEditorCardLc}>
            <div className={styles.challengeEditorHeadLc}>
              <span className={styles.challengeFnTagLc}>Python 3 · stdin/stdout</span>
              <button className={styles.resetBtnLc} onClick={handleReset} title="Reset to starter code">
                <RotateCcw size={15} /> Reset
              </button>
            </div>
            <div className={styles.challengeEditorBoxLc}>
              <pre
                ref={highlightRef}
                className={styles.challengeHighlightLc}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
              />
              <textarea
                ref={textareaRef}
                className={styles.challengeTextareaLc}
                value={code}
                onChange={(e) => updateCode(e.target.value)}
                onScroll={(e) => syncScroll(e.target)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
              />
            </div>
            <div className={styles.challengeRunRowLc}>
              <button className={styles.runTestsBtnLc} onClick={handleRun} disabled={running}>
                <Play size={17} fill="currentColor" /> {running ? 'Running…' : 'Run Tests'}
              </button>
            </div>
          </article>
        </section>

        {/* ── right: test results ── */}
        <section className={styles.challengeResultsLc}>
          <div className={styles.resultsHeadLc}>
            <h2>Test Cases</h2>
            {result && result.results?.length > 0 && (
              <span className={`${styles.resultsScoreLc} ${result.all_passed ? styles.resultsScorePass : ''}`}>
                {result.passed} / {result.total} passing
              </span>
            )}
          </div>

          {result?.all_passed && (
            <div className={styles.challengeWinLc}>
              <Trophy size={20} /> All tests passed — challenge solved! 🎉
            </div>
          )}

          {result?.stderr && !result.results?.some((r) => r.passed) && result.results?.length === 0 && (
            <pre className={styles.challengeErrorLc}>{result.stderr}</pre>
          )}

          <div className={styles.testListLc}>
            {(result?.results?.length
              ? result.results
              : challenge.tests.map((t) => ({ ...t, pending: true }))
            ).map((t, i) => {
              const state = t.pending ? styles.testPending : t.passed ? styles.testPass : styles.testFail;
              return (
                <div key={i} className={`${styles.testCardLc} ${state}`}>
                  <div className={styles.testCardHeadLc}>
                    <span className={styles.testStatusLc}>
                      {t.pending ? (
                        <span className={styles.testDotLc} />
                      ) : t.passed ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <XCircle size={18} />
                      )}
                    </span>
                    <code className={styles.testCallLc}>stdin test #{i + 1}</code>
                  </div>
                  <div className={styles.testRowsLc}>
                    <div className={styles.testRowLc}>
                      <span className={styles.testLabelLc}>input</span>
                      <code>{formatValue(t.input)}</code>
                    </div>
                    <div className={styles.testRowLc}>
                      <span className={styles.testLabelLc}>expected</span>
                      <code>{formatValue(t.expected)}</code>
                    </div>
                    {!t.pending && (
                      <div className={styles.testRowLc}>
                        <span className={styles.testLabelLc}>{t.error ? 'error' : 'got'}</span>
                        <code className={t.passed ? '' : styles.testGotBad}>
                          {t.error ? t.error : formatValue(t.actual)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
