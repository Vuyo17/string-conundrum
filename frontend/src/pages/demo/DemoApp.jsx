import React, { useState } from 'react';
import s from './Demo.module.css';
import { apiFetch } from '../../api';
import { getApiUrl } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { AuthPage } from '../auth/AuthPage';

// A minimal, technical walkthrough of the backend, for lecturers to demo the
// API directly: every panel shows the exact request sent and the raw JSON
// that came back, against the real production endpoints. Not linked from the
// app; reached only at /demo* and only by an admin account.

const PAGES = [
  { path: '/demo/practice-engine', title: 'Practice engine', text: 'Stateless procedural question generation and server-side grading with misconception detection.', endpoints: 'GET/POST /api/exercises/<m>/engine/*' },
  { path: '/demo/sandbox', title: 'Code sandbox', text: 'Untrusted Python run in a restricted subprocess: timeouts, blocked imports and file access, isiXhosa error translation.', endpoints: 'POST /api/execute' },
  { path: '/demo/tracer', title: 'Tracer & visualiser', text: 'Step-by-step execution trace and the render state the string visualiser is drawn from.', endpoints: 'POST /api/debug, /api/visualize' },
];

const ENGINE_MODULES = [
  'intro', 'indexing', 'slicing', 'immutability',
  'comparison', 'looping', 'methods', 'formatting',
];

// --- request helpers -------------------------------------------------------

function requestText({ method, path, body, auth }) {
  const lines = [`${method} ${path}`];
  if (auth) lines.push('Authorization: Bearer <lecturer id token>');
  if (body !== undefined) { lines.push('Content-Type: application/json', '', JSON.stringify(body, null, 2)); }
  return lines.join('\n');
}

async function callApi({ method = 'GET', path, body, auth = false }) {
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const started = performance.now();
  const res = auth ? await apiFetch(getApiUrl(path), opts) : await fetch(getApiUrl(path), opts);
  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ms, data };
}

// --- shared views ----------------------------------------------------------

function Exchange({ req, result, error, pending }) {
  return (
    <div className={s.exchange}>
      <div>
        <div className={s.label}>Request</div>
        <pre className={s.code}>{req || '(build a request above)'}</pre>
      </div>
      <div>
        <div className={s.label}>Response</div>
        {result && (
          <div className={s.meta}>
            <span className={result.status < 400 ? s.ok : s.bad}>{result.status}</span>
            <span>{result.ms} ms</span>
          </div>
        )}
        <pre className={s.code}>
          {pending ? '…' : error ? `error: ${String(error)}` : result ? JSON.stringify(result.data, null, 2) : '(not run yet)'}
        </pre>
      </div>
    </div>
  );
}

function useRunner() {
  const [state, setState] = useState({ req: '', result: null, error: null, pending: false });
  const run = async (spec) => {
    setState({ req: requestText(spec), result: null, error: null, pending: true });
    try {
      const result = await callApi(spec);
      setState({ req: requestText(spec), result, error: null, pending: false });
      return result;
    } catch (error) {
      setState({ req: requestText(spec), result: null, error, pending: false });
      return null;
    }
  };
  return [state, run];
}

// --- practice engine -------------------------------------------------------

function PracticeEngineDemo() {
  const [module, setModule] = useState('slicing');
  const [tier, setTier] = useState(2);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [slice, setSlice] = useState({ start: '', stop: '', step: '' });
  const [gen, runGen] = useRunner();
  const [grade, runGrade] = useRunner();

  async function generate() {
    setQuestion(null); setAnswer(''); setSlice({ start: '', stop: '', step: '' });
    const res = await runGen({ method: 'GET', path: `/api/exercises/${module}/engine/next?tier=${tier}` });
    if (res && res.data && res.data.ok) setQuestion(res.data);
  }

  const mode = !question ? null
    : Array.isArray(question.options) ? 'options'
    : question.type === 'build_slice' ? 'slice' : 'text';

  const numOrNull = (v) => (v === '' ? null : Number(v));

  function submit() {
    const body = { token: question.token };
    if (mode === 'slice') body.slice = { start: numOrNull(slice.start), stop: numOrNull(slice.stop), step: numOrNull(slice.step) };
    else body.answer = answer;
    runGrade({ method: 'POST', path: `/api/exercises/${module}/engine/answer`, body, auth: true });
  }

  return (
    <div className={s.main}>
      <h1 className={s.h1}>Practice engine</h1>
      <p className={s.lede}>
        Each module generates questions procedurally. The question carries an HMAC-signed
        token that encodes its own answer key, so the server keeps no session: grading
        re-derives the answer from the token. Wrong answers are classified into a named
        misconception.
      </p>

      <div className={s.card}>
        <h2 className={s.h2}>1 · Generate a question</h2>
        <div className={s.controls}>
          <select className={s.select} value={module} onChange={(e) => setModule(e.target.value)}>
            {ENGINE_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className={s.select} value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>tier {t}</option>)}
          </select>
          <button className={s.btn} onClick={generate} disabled={gen.pending}>GET next question</button>
        </div>
        <Exchange {...gen} />
      </div>

      {question && (
        <div className={s.card}>
          <h2 className={s.h2}>2 · Answer it — graded on the server</h2>
          <pre className={s.qprompt}>{question.prompt}</pre>

          {mode === 'options' && question.options.map((opt) => (
            <label key={opt} className={s.opt}>
              <input type="radio" name="ans" checked={answer === opt} onChange={() => setAnswer(opt)} />
              {opt}
            </label>
          ))}
          {mode === 'text' && (
            <input className={s.input} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="your answer" />
          )}
          {mode === 'slice' && (
            <div className={s.controls}>
              {['start', 'stop', 'step'].map((k) => (
                <div key={k}>
                  <div className={s.label}>{k}</div>
                  <input className={`${s.input} ${s.num}`} value={slice[k]}
                    onChange={(e) => setSlice({ ...slice, [k]: e.target.value })} placeholder="—" />
                </div>
              ))}
            </div>
          )}

          <div className={s.controls} style={{ marginTop: 12 }}>
            <button className={s.btn} onClick={submit} disabled={grade.pending}>POST answer</button>
            {grade.result && grade.result.data && typeof grade.result.data.correct === 'boolean' && (
              <span className={`${s.pill} ${grade.result.data.correct ? s.pillOk : s.pillBad}`}>
                {grade.result.data.correct ? 'correct' : 'incorrect'}
                {grade.result.data.misconception_id ? ` · ${grade.result.data.misconception_id}` : ''}
              </span>
            )}
          </div>
          <Exchange {...grade} />
        </div>
      )}
    </div>
  );
}

// --- sandbox ---------------------------------------------------------------

const SANDBOX_PRESETS = [
  { label: 'Normal', code: 'for i in range(3):\n    print("hello", i)' },
  { label: 'Infinite loop (times out)', code: 'while True:\n    pass' },
  { label: 'Blocked import', code: 'import os\nprint(os.getcwd())' },
  { label: 'Blocked file access', code: 'open("/etc/passwd").read()' },
  { label: 'Error → isiXhosa', code: 'print(10 / 0)', lang: 'xh' },
];

function SandboxDemo() {
  const [code, setCode] = useState(SANDBOX_PRESETS[0].code);
  const [lang, setLang] = useState('en');
  const [run, doRun] = useRunner();

  function execute(nextCode = code, nextLang = lang) {
    doRun({ method: 'POST', path: '/api/execute', body: { code: nextCode, lang: nextLang } });
  }

  return (
    <div className={s.main}>
      <h1 className={s.h1}>Code sandbox</h1>
      <p className={s.lede}>
        Learner code runs as a separate OS subprocess under a restricted builtins
        dictionary — no <code>__import__</code>, no <code>open</code>, no <code>eval</code> —
        with a 5-second wall-clock timeout and a memory cap. Errors can be returned
        translated into isiXhosa from an offline template match.
      </p>

      <div className={s.card}>
        <div className={s.controls}>
          {SANDBOX_PRESETS.map((p) => (
            <button key={p.label} className={s.preset} onClick={() => {
              setCode(p.code); const nl = p.lang || 'en'; setLang(nl); execute(p.code, nl);
            }}>{p.label}</button>
          ))}
          <span className={s.spacer} />
          <select className={s.select} value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">lang: en</option>
            <option value="xh">lang: xh</option>
          </select>
        </div>
        <textarea className={s.textarea} value={code} onChange={(e) => setCode(e.target.value)} spellCheck="false" />
        <div className={s.controls} style={{ marginTop: 10 }}>
          <button className={s.btn} onClick={() => execute()} disabled={run.pending}>POST /api/execute</button>
        </div>
        <Exchange {...run} />
      </div>
    </div>
  );
}

// --- tracer & visualiser ---------------------------------------------------

const TRACE_PRESETS = [
  'word = "python"\nfirst = word[0]\nprint(first)',
  's = "abc"\nfor c in s:\n    print(c)',
];
const VIS_PRESETS = [
  { expression: 'word[1:4]', word: 'python' },
  { expression: 'word[::-1]', word: 'python' },
  { expression: 'word[-2]', word: 'python' },
];

function TracerDemo() {
  const [code, setCode] = useState(TRACE_PRESETS[0]);
  const [expr, setExpr] = useState(VIS_PRESETS[0].expression);
  const [word, setWord] = useState(VIS_PRESETS[0].word);
  const [trace, runTrace] = useRunner();
  const [vis, runVis] = useRunner();

  return (
    <div className={s.main}>
      <h1 className={s.h1}>Tracer & visualiser</h1>
      <p className={s.lede}>
        Two read-only endpoints that power the Debugger and the string visualiser.
        The tracer returns a per-line list of steps; the visualiser returns the
        cells and highlighted indices a slice or index expression produces.
      </p>

      <div className={s.card}>
        <h2 className={s.h2}>POST /api/debug — execution trace</h2>
        <div className={s.controls}>
          {TRACE_PRESETS.map((c, i) => (
            <button key={i} className={s.preset} onClick={() => setCode(c)}>preset {i + 1}</button>
          ))}
        </div>
        <textarea className={s.textarea} value={code} onChange={(e) => setCode(e.target.value)} spellCheck="false" />
        <div className={s.controls} style={{ marginTop: 10 }}>
          <button className={s.btn} onClick={() => runTrace({ method: 'POST', path: '/api/debug', body: { code } })} disabled={trace.pending}>Run trace</button>
        </div>
        <Exchange {...trace} />
      </div>

      <div className={s.card}>
        <h2 className={s.h2}>POST /api/visualize — render state</h2>
        <div className={s.controls}>
          {VIS_PRESETS.map((p) => (
            <button key={p.expression} className={s.preset} onClick={() => { setExpr(p.expression); setWord(p.word); }}>{p.expression}</button>
          ))}
        </div>
        <div className={s.controls}>
          <div>
            <div className={s.label}>expression</div>
            <input className={s.input} value={expr} onChange={(e) => setExpr(e.target.value)} />
          </div>
          <div>
            <div className={s.label}>word</div>
            <input className={`${s.input} ${s.num}`} value={word} onChange={(e) => setWord(e.target.value)} />
          </div>
          <button className={s.btn} style={{ alignSelf: 'flex-end' }}
            onClick={() => runVis({ method: 'POST', path: '/api/visualize', body: { expression: expr, context: { word } } })}
            disabled={vis.pending}>Run</button>
        </div>
        <Exchange {...vis} />
      </div>
    </div>
  );
}

// --- index + shell ---------------------------------------------------------

function Index() {
  return (
    <div className={s.main}>
      <h1 className={s.h1}>Backend demo</h1>
      <p className={s.lede}>
        A technical walkthrough of the String Conundrum backend. Every panel calls the
        real production API and shows the exact request and raw response. Lecturer-only,
        and unlinked from the student app.
      </p>
      <div className={s.grid}>
        {PAGES.map((p) => (
          <a key={p.path} className={s.tileLink} href={p.path}>
            <div className={s.tileTitle}>{p.title}</div>
            <div className={s.tileText}>{p.text}</div>
            <div className={s.tileEndpoints}>{p.endpoints}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

const ROUTES = {
  '/demo': Index,
  '/demo/practice-engine': PracticeEngineDemo,
  '/demo/sandbox': SandboxDemo,
  '/demo/tracer': TracerDemo,
};

export function DemoApp() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const path = (window.location.pathname.replace(/\/+$/, '') || '/demo');

  if (loading) return <div className={s.center}>Loading…</div>;
  if (!user) return <AuthPage />;
  if (!isAdmin) {
    return (
      <div className={s.center}>
        <div>
          <p>This area is for lecturer accounts.</p>
          <button className={s.signout} onClick={signOut} style={{ marginTop: 12 }}>Sign out</button>
        </div>
      </div>
    );
  }

  const Page = ROUTES[path] || Index;
  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className={s.brand}>String Conundrum<span className={s.brandSub}>backend demo</span></span>
        <nav className={s.nav}>
          <a className={`${s.navLink} ${path === '/demo' ? s.navLinkOn : ''}`} href="/demo">Overview</a>
          {PAGES.map((p) => (
            <a key={p.path} className={`${s.navLink} ${path === p.path ? s.navLinkOn : ''}`} href={p.path}>{p.title}</a>
          ))}
        </nav>
        <span className={s.spacer} />
        <span className={s.who}>{user.email || user.displayName}</span>
        <button className={s.signout} onClick={signOut}>Sign out</button>
      </div>
      <Page />
    </div>
  );
}
