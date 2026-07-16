import React, { useMemo } from 'react';
import {
  AlertTriangle, BookMarked, CheckCircle2, Info, Lightbulb,
} from 'lucide-react';
import m from '../../styles/ModulePage.module.css';
import { highlightPython } from '../../utils/pythonHighlight';

// ─── inline text: supports `code` spans and **bold** ─────────────────────────

export function InlineText({ text }) {
  const parts = useMemo(() => {
    const tokens = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let cursor = 0;

    for (const match of text.matchAll(regex)) {
      const index = match.index ?? 0;
      if (index > cursor) tokens.push({ kind: 'text', value: text.slice(cursor, index) });
      const token = match[0];
      if (token.startsWith('`')) tokens.push({ kind: 'code', value: token.slice(1, -1) });
      else tokens.push({ kind: 'bold', value: token.slice(2, -2) });
      cursor = index + token.length;
    }
    if (cursor < text.length) tokens.push({ kind: 'text', value: text.slice(cursor) });
    return tokens;
  }, [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === 'code') return <code key={i} className={m.inlineCode}>{part.value}</code>;
        if (part.kind === 'bold') return <strong key={i}>{part.value}</strong>;
        return <React.Fragment key={i}>{part.value}</React.Fragment>;
      })}
    </>
  );
}

// ─── highlighted code block ───────────────────────────────────────────────────

const HIGHLIGHT_CLASSES = {
  comment: m.pyComment,
  string: m.pyString,
  number: m.pyNumber,
  builtin: m.pyBuiltin,
  keyword: m.pyKeyword,
};

export function CodeBlock({ code, caption }) {
  const html = useMemo(() => highlightPython(code, HIGHLIGHT_CLASSES), [code]);
  return (
    <figure className={m.codeFigure}>
      <pre className={m.codeBlock} dangerouslySetInnerHTML={{ __html: html }} />
      {caption && <figcaption className={m.figCaption}>{caption}</figcaption>}
    </figure>
  );
}

// ─── string cell figure ───────────────────────────────────────────────────────

export function StringFigure({ value, highlight = [], negative = false, caption, dense = false }) {
  const chars = value.split('');
  return (
    <figure className={m.stringFigure}>
      <div
        className={`${m.cellGrid} ${dense ? m.cellGridDense : ''}`}
        style={{ '--cells': chars.length }}
        role="img"
        aria-label={`String "${value}" shown as indexed cells`}
      >
        {chars.map((char, i) => (
          <div key={`cell-${i}`} className={`${m.cell} ${highlight.includes(i) ? m.cellActive : ''}`}>
            <span className={m.cellChar}>{char === ' ' ? '·' : char}</span>
            <span className={m.cellIndex}>{i}</span>
            {negative && <span className={m.cellNegIndex}>{i - chars.length}</span>}
          </div>
        ))}
      </div>
      {caption && <figcaption className={m.figCaption}>{caption}</figcaption>}
    </figure>
  );
}

// ─── callout ──────────────────────────────────────────────────────────────────

const CALLOUT_META = {
  tip: { icon: Lightbulb, label: 'Tip', className: m.calloutTip },
  warn: { icon: AlertTriangle, label: 'Watch out', className: m.calloutWarn },
  info: { icon: Info, label: 'Good to know', className: m.calloutInfo },
  define: { icon: BookMarked, label: 'Definition', className: m.calloutDefine },
};

export function Callout({ tone = 'info', title, text }) {
  const meta = CALLOUT_META[tone] ?? CALLOUT_META.info;
  const Icon = meta.icon;
  return (
    <aside className={`${m.callout} ${meta.className}`}>
      <span className={m.calloutIcon}><Icon size={17} /></span>
      <div>
        <strong className={m.calloutTitle}>{title ?? meta.label}</strong>
        <p className={m.calloutText}><InlineText text={text} /></p>
      </div>
    </aside>
  );
}

// ─── key points summary ───────────────────────────────────────────────────────

export function KeyPoints({ title = 'Remember these', items }) {
  return (
    <div className={m.keyPoints}>
      <h4 className={m.keyPointsTitle}>{title}</h4>
      <ul className={m.keyPointsList}>
        {items.map((item, i) => (
          <li key={i}>
            <CheckCircle2 size={16} className={m.keyPointIcon} />
            <span><InlineText text={item} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── table ────────────────────────────────────────────────────────────────────

export function BlockTable({ head, rows }) {
  return (
    <div className={m.tableWrap}>
      <table className={m.blockTable}>
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cellValue, j) => (
                <td key={j}>
                  {j === 0 ? <code className={m.inlineCode}>{cellValue}</code> : <InlineText text={cellValue} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── block dispatcher ─────────────────────────────────────────────────────────

export function ContentBlock({ block }) {
  switch (block.kind) {
    case 'p':
      return <p className={m.paragraph}><InlineText text={block.text} /></p>;
    case 'code':
      return <CodeBlock code={block.code} caption={block.caption} />;
    case 'string':
      return (
        <StringFigure
          value={block.value}
          highlight={block.highlight}
          negative={block.negative}
          caption={block.caption}
        />
      );
    case 'callout':
      return <Callout tone={block.tone} title={block.title} text={block.text} />;
    case 'keypoints':
      return <KeyPoints title={block.title} items={block.items} />;
    case 'table':
      return <BlockTable head={block.head} rows={block.rows} />;
    default:
      return null;
  }
}

export function ContentBlocks({ blocks }) {
  return (
    <>
      {blocks.map((block, i) => <ContentBlock key={i} block={block} />)}
    </>
  );
}
