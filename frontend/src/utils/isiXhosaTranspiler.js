// Each pair is ordered longest-first to avoid partial-word collisions on round-trips.
// TO_PYTHON must be applied before TO_XHOSA and vice-versa — never mix directions.

const TO_PYTHON_REPLACEMENTS = [
  // multi-word first
  { pattern: /\bokanye ukuba\b/g, replacement: 'elif' },
  { pattern: /\bhayi ku\b/g,      replacement: 'not in' },
  { pattern: /\bayi yi\b/g,       replacement: 'is not' },
  // control flow
  { pattern: /\bukuba\b/g,        replacement: 'if' },
  { pattern: /\bngaphandle\b/g,   replacement: 'else' },
  { pattern: /\bngelixa\b/g,      replacement: 'while' },
  { pattern: /\bkwi\b/g,         replacement: 'for' },
  { pattern: /\bku\b/g,           replacement: 'in' },
  { pattern: /\bdlula\b/g,        replacement: 'pass' },
  { pattern: /\byeka\b/g,         replacement: 'break' },
  { pattern: /\bqhuba\b/g,        replacement: 'continue' },
  // functions / classes
  { pattern: /\bchaza\b/g,        replacement: 'def' },
  { pattern: /\bbuyisa\b/g,       replacement: 'return' },
  { pattern: /\bklasi\b/g,        replacement: 'class' },
  { pattern: /\bisenzo\b/g,       replacement: 'lambda' },
  { pattern: /\bnikela\b/g,       replacement: 'yield' },
  // imports
  { pattern: /\bngenisa\b/g,      replacement: 'import' },
  { pattern: /\bukusuka\b/g,      replacement: 'from' },
  { pattern: /\bnjenge\b/g,       replacement: 'as' },
  // exception handling
  { pattern: /\bzama\b/g,         replacement: 'try' },
  { pattern: /\bbamba\b/g,        replacement: 'except' },
  { pattern: /\bekugqibeleni\b/g, replacement: 'finally' },
  { pattern: /\bphakamisa\b/g,    replacement: 'raise' },
  { pattern: /\bnge\b/g,          replacement: 'with' },
  // misc
  { pattern: /\bcima\b/g,         replacement: 'del' },
  { pattern: /\bjikelele\b/g,     replacement: 'global' },
  { pattern: /\bayijikelele\b/g,  replacement: 'nonlocal' },
  { pattern: /\bqinisekisa\b/g,   replacement: 'assert' },
  // boolean operators
  { pattern: /\bhayi\b/g,         replacement: 'not' },
  { pattern: /\bkwaye\b/g,        replacement: 'and' },
  { pattern: /\bokanye\b/g,       replacement: 'or' },
  { pattern: /\byi\b/g,           replacement: 'is' },
  // literals
  { pattern: /\bEwe\b/g,          replacement: 'True' },
  { pattern: /\bHayi\b/g,         replacement: 'False' },
  { pattern: /\bLutho\b/g,        replacement: 'None' },
  // builtins
  { pattern: /\bbhala\b/g,        replacement: 'print' },
  { pattern: /\bubude\b/g,        replacement: 'len' },
  { pattern: /\bithuba\b/g,       replacement: 'range' },
  { pattern: /\bfaka\b/g,         replacement: 'input' },
  { pattern: /\bisigama\b/g,      replacement: 'str' },
  { pattern: /\binombolo\b/g,     replacement: 'int' },
  { pattern: /\bdecimali\b/g,     replacement: 'float' },
  { pattern: /\buluhlu\b/g,       replacement: 'list' },
  { pattern: /\bisichazi\b/g,     replacement: 'dict' },
  { pattern: /\biqela\b/g,        replacement: 'set' },
  { pattern: /\biqoqo\b/g,        replacement: 'tuple' },
  { pattern: /\buhlobo\b/g,       replacement: 'type' },
  { pattern: /\bbalela\b/g,       replacement: 'enumerate' },
  { pattern: /\bhlanganisa\b/g,   replacement: 'zip' },
  { pattern: /\bguqula\b/g,       replacement: 'map' },
  { pattern: /\bchonga\b/g,       replacement: 'filter' },
  { pattern: /\bhlela\b/g,        replacement: 'sorted' },
  { pattern: /\bbuyisela\b/g,     replacement: 'reversed' },
  { pattern: /\byonke\b/g,        replacement: 'sum' },
  { pattern: /\buncinci\b/g,      replacement: 'min' },
  { pattern: /\bunkulu\b/g,       replacement: 'max' },
  { pattern: /\bixabiso\b/g,      replacement: 'abs' },
  { pattern: /\bvula\b/g,         replacement: 'open' },
];

// Category labels for the student-facing reference table (Docs page). Kept as
// keys here, translated in the locale bundles under docs.categories.*, so
// KEYWORD_PAIRS below stays the single source of truth for both the
// transpiler's regex table and the reference table students read.
export const CATEGORIES = {
  CONTROL_FLOW: 'controlFlow',
  FUNCTIONS_CLASSES: 'functionsClasses',
  IMPORTS: 'imports',
  EXCEPTIONS: 'exceptions',
  MISC: 'misc',
  BOOLEAN_OPS: 'booleanOps',
  LITERALS: 'literals',
  BUILTINS: 'builtins',
};

const TO_XHOSA_REPLACEMENTS = [
  // multi-word first
  { pattern: /\belif\b/g,         replacement: 'okanye ukuba', category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\bnot in\b/g,       replacement: 'hayi ku',      category: CATEGORIES.BOOLEAN_OPS },
  { pattern: /\bis not\b/g,       replacement: 'ayi yi',       category: CATEGORIES.BOOLEAN_OPS },
  // control flow
  { pattern: /\bif\b/g,           replacement: 'ukuba',        category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\belse\b/g,         replacement: 'ngaphandle',   category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\bwhile\b/g,        replacement: 'ngelixa',      category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\bfor\b/g,          replacement: 'kwi',          category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\bin\b/g,           replacement: 'ku',           category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\bpass\b/g,         replacement: 'dlula',        category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\bbreak\b/g,        replacement: 'yeka',         category: CATEGORIES.CONTROL_FLOW },
  { pattern: /\bcontinue\b/g,     replacement: 'qhuba',        category: CATEGORIES.CONTROL_FLOW },
  // functions / classes
  { pattern: /\bdef\b/g,          replacement: 'chaza',        category: CATEGORIES.FUNCTIONS_CLASSES },
  { pattern: /\breturn\b/g,       replacement: 'buyisa',       category: CATEGORIES.FUNCTIONS_CLASSES },
  { pattern: /\bclass\b/g,        replacement: 'klasi',        category: CATEGORIES.FUNCTIONS_CLASSES },
  { pattern: /\blambda\b/g,       replacement: 'isenzo',       category: CATEGORIES.FUNCTIONS_CLASSES },
  { pattern: /\byield\b/g,        replacement: 'nikela',       category: CATEGORIES.FUNCTIONS_CLASSES },
  // imports
  { pattern: /\bimport\b/g,       replacement: 'ngenisa',      category: CATEGORIES.IMPORTS },
  { pattern: /\bfrom\b/g,         replacement: 'ukusuka',      category: CATEGORIES.IMPORTS },
  { pattern: /\bas\b/g,           replacement: 'njenge',       category: CATEGORIES.IMPORTS },
  // exception handling
  { pattern: /\btry\b/g,          replacement: 'zama',         category: CATEGORIES.EXCEPTIONS },
  { pattern: /\bexcept\b/g,       replacement: 'bamba',        category: CATEGORIES.EXCEPTIONS },
  { pattern: /\bfinally\b/g,      replacement: 'ekugqibeleni', category: CATEGORIES.EXCEPTIONS },
  { pattern: /\braise\b/g,        replacement: 'phakamisa',    category: CATEGORIES.EXCEPTIONS },
  { pattern: /\bwith\b/g,         replacement: 'nge',          category: CATEGORIES.EXCEPTIONS },
  // misc
  { pattern: /\bdel\b/g,          replacement: 'cima',         category: CATEGORIES.MISC },
  { pattern: /\bglobal\b/g,       replacement: 'jikelele',     category: CATEGORIES.MISC },
  { pattern: /\bnonlocal\b/g,     replacement: 'ayijikelele',  category: CATEGORIES.MISC },
  { pattern: /\bassert\b/g,       replacement: 'qinisekisa',   category: CATEGORIES.MISC },
  // boolean operators (longest first to avoid 'not' matching inside 'not in')
  { pattern: /\bnot\b/g,          replacement: 'hayi',         category: CATEGORIES.BOOLEAN_OPS },
  { pattern: /\band\b/g,          replacement: 'kwaye',        category: CATEGORIES.BOOLEAN_OPS },
  { pattern: /\bor\b/g,           replacement: 'okanye',       category: CATEGORIES.BOOLEAN_OPS },
  { pattern: /\bis\b/g,           replacement: 'yi',           category: CATEGORIES.BOOLEAN_OPS },
  // literals
  { pattern: /\bTrue\b/g,         replacement: 'Ewe',          category: CATEGORIES.LITERALS },
  { pattern: /\bFalse\b/g,        replacement: 'Hayi',         category: CATEGORIES.LITERALS },
  { pattern: /\bNone\b/g,         replacement: 'Lutho',        category: CATEGORIES.LITERALS },
  // builtins
  { pattern: /\bprint\b/g,        replacement: 'bhala',        category: CATEGORIES.BUILTINS },
  { pattern: /\blen\b/g,          replacement: 'ubude',        category: CATEGORIES.BUILTINS },
  { pattern: /\brange\b/g,        replacement: 'ithuba',       category: CATEGORIES.BUILTINS },
  { pattern: /\binput\b/g,        replacement: 'faka',         category: CATEGORIES.BUILTINS },
  { pattern: /\bstr\b/g,          replacement: 'isigama',      category: CATEGORIES.BUILTINS },
  { pattern: /\bint\b/g,          replacement: 'inombolo',     category: CATEGORIES.BUILTINS },
  { pattern: /\bfloat\b/g,        replacement: 'decimali',     category: CATEGORIES.BUILTINS },
  { pattern: /\blist\b/g,         replacement: 'uluhlu',       category: CATEGORIES.BUILTINS },
  { pattern: /\bdict\b/g,         replacement: 'isichazi',     category: CATEGORIES.BUILTINS },
  { pattern: /\bset\b/g,          replacement: 'iqela',        category: CATEGORIES.BUILTINS },
  { pattern: /\btuple\b/g,        replacement: 'iqoqo',        category: CATEGORIES.BUILTINS },
  { pattern: /\btype\b/g,         replacement: 'uhlobo',       category: CATEGORIES.BUILTINS },
  { pattern: /\benumerate\b/g,    replacement: 'balela',       category: CATEGORIES.BUILTINS },
  { pattern: /\bzip\b/g,          replacement: 'hlanganisa',   category: CATEGORIES.BUILTINS },
  { pattern: /\bmap\b/g,          replacement: 'guqula',       category: CATEGORIES.BUILTINS },
  { pattern: /\bfilter\b/g,       replacement: 'chonga',       category: CATEGORIES.BUILTINS },
  { pattern: /\bsorted\b/g,       replacement: 'hlela',        category: CATEGORIES.BUILTINS },
  { pattern: /\breversed\b/g,     replacement: 'buyisela',     category: CATEGORIES.BUILTINS },
  { pattern: /\bsum\b/g,          replacement: 'yonke',        category: CATEGORIES.BUILTINS },
  { pattern: /\bmin\b/g,          replacement: 'incinci',      category: CATEGORIES.BUILTINS },
  { pattern: /\bmax\b/g,          replacement: 'inkulu',       category: CATEGORIES.BUILTINS },
  { pattern: /\babs\b/g,          replacement: 'ixabiso',      category: CATEGORIES.BUILTINS },
  { pattern: /\bopen\b/g,         replacement: 'vula',         category: CATEGORIES.BUILTINS },
];

// Skips string literals and comments so only code tokens are translated.
function applyReplacements(source, replacements) {
  if (!source) return '';

  return source
    .split(/\r?\n/)
    .map((line) => {
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const body = line.slice(indent.length);

      // Translate only outside of string literals and comments.
      const translated = translateOutsideStrings(body, replacements);
      return `${indent}${translated}`;
    })
    .join('\n');
}

// Split line into (string/comment) and (code) segments, translate only code.
function translateOutsideStrings(line, replacements) {
  const segments = [];
  const tokenRe = /(#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  let cursor = 0;
  let match;

  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: line.slice(cursor, match.index), isLiteral: false });
    }
    segments.push({ text: match[0], isLiteral: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) {
    segments.push({ text: line.slice(cursor), isLiteral: false });
  }

  return segments
    .map(({ text, isLiteral }) =>
      isLiteral
        ? text
        : replacements.reduce((s, { pattern, replacement }) => s.replace(pattern, replacement), text),
    )
    .join('');
}

// The full Python-keyword <-> isiXhosa-word map, for the student-facing
// reference table (Docs page). Derived from TO_XHOSA_REPLACEMENTS itself —
// not a hand-copied duplicate — so the reference table can never drift out
// of sync with what the transpiler actually does. Every pattern here is a
// plain \b-wrapped word or phrase with no other regex metacharacters, so
// stripping the \b anchors recovers the literal Python text safely.
export const KEYWORD_PAIRS = TO_XHOSA_REPLACEMENTS.map(({ pattern, replacement, category }) => ({
  python: pattern.source.replace(/\\b/g, ''),
  xhosa: replacement,
  category,
}));

export function transpileIsiXhosaToPython(source) {
  return applyReplacements(source, TO_PYTHON_REPLACEMENTS);
}

export function transpilePythonToIsiXhosa(source) {
  return applyReplacements(source, TO_XHOSA_REPLACEMENTS);
}

// Translates Python keywords/builtins inside arbitrary display text (e.g. debug descriptions).
export function translateDisplayText(text, toLang) {
  if (!text || toLang === 'en') return text;
  return TO_XHOSA_REPLACEMENTS.reduce(
    (s, { pattern, replacement }) => s.replace(pattern, replacement),
    text,
  );
}
