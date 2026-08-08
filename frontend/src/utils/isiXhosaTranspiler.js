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

const TO_XHOSA_REPLACEMENTS = [
  // multi-word first
  { pattern: /\belif\b/g,         replacement: 'okanye ukuba' },
  { pattern: /\bnot in\b/g,       replacement: 'hayi ku' },
  { pattern: /\bis not\b/g,       replacement: 'ayi yi' },
  // control flow
  { pattern: /\bif\b/g,           replacement: 'ukuba' },
  { pattern: /\belse\b/g,         replacement: 'ngaphandle' },
  { pattern: /\bwhile\b/g,        replacement: 'ngelixa' },
  { pattern: /\bfor\b/g,          replacement: 'kwi' },
  { pattern: /\bin\b/g,           replacement: 'ku' },
  { pattern: /\bpass\b/g,         replacement: 'dlula' },
  { pattern: /\bbreak\b/g,        replacement: 'yeka' },
  { pattern: /\bcontinue\b/g,     replacement: 'qhuba' },
  // functions / classes
  { pattern: /\bdef\b/g,          replacement: 'chaza' },
  { pattern: /\breturn\b/g,       replacement: 'buyisa' },
  { pattern: /\bclass\b/g,        replacement: 'klasi' },
  { pattern: /\blambda\b/g,       replacement: 'isenzo' },
  { pattern: /\byield\b/g,        replacement: 'nikela' },
  // imports
  { pattern: /\bimport\b/g,       replacement: 'ngenisa' },
  { pattern: /\bfrom\b/g,         replacement: 'ukusuka' },
  { pattern: /\bas\b/g,           replacement: 'njenge' },
  // exception handling
  { pattern: /\btry\b/g,          replacement: 'zama' },
  { pattern: /\bexcept\b/g,       replacement: 'bamba' },
  { pattern: /\bfinally\b/g,      replacement: 'ekugqibeleni' },
  { pattern: /\braise\b/g,        replacement: 'phakamisa' },
  { pattern: /\bwith\b/g,         replacement: 'nge' },
  // misc
  { pattern: /\bdel\b/g,          replacement: 'cima' },
  { pattern: /\bglobal\b/g,       replacement: 'jikelele' },
  { pattern: /\bnonlocal\b/g,     replacement: 'ayijikelele' },
  { pattern: /\bassert\b/g,       replacement: 'qinisekisa' },
  // boolean operators (longest first to avoid 'not' matching inside 'not in')
  { pattern: /\bnot\b/g,          replacement: 'hayi' },
  { pattern: /\band\b/g,          replacement: 'kwaye' },
  { pattern: /\bor\b/g,           replacement: 'okanye' },
  { pattern: /\bis\b/g,           replacement: 'yi' },
  // literals
  { pattern: /\bTrue\b/g,         replacement: 'Ewe' },
  { pattern: /\bFalse\b/g,        replacement: 'Hayi' },
  { pattern: /\bNone\b/g,         replacement: 'Lutho' },
  // builtins
  { pattern: /\bprint\b/g,        replacement: 'bhala' },
  { pattern: /\blen\b/g,          replacement: 'ubude' },
  { pattern: /\brange\b/g,        replacement: 'ithuba' },
  { pattern: /\binput\b/g,        replacement: 'faka' },
  { pattern: /\bstr\b/g,          replacement: 'isigama' },
  { pattern: /\bint\b/g,          replacement: 'inombolo' },
  { pattern: /\bfloat\b/g,        replacement: 'decimali' },
  { pattern: /\blist\b/g,         replacement: 'uluhlu' },
  { pattern: /\bdict\b/g,         replacement: 'isichazi' },
  { pattern: /\bset\b/g,          replacement: 'iqela' },
  { pattern: /\btuple\b/g,        replacement: 'iqoqo' },
  { pattern: /\btype\b/g,         replacement: 'uhlobo' },
  { pattern: /\benumerate\b/g,    replacement: 'balela' },
  { pattern: /\bzip\b/g,          replacement: 'hlanganisa' },
  { pattern: /\bmap\b/g,          replacement: 'guqula' },
  { pattern: /\bfilter\b/g,       replacement: 'chonga' },
  { pattern: /\bsorted\b/g,       replacement: 'hlela' },
  { pattern: /\breversed\b/g,     replacement: 'buyisela' },
  { pattern: /\bsum\b/g,          replacement: 'yonke' },
  { pattern: /\bmin\b/g,          replacement: 'uncinci' },
  { pattern: /\bmax\b/g,          replacement: 'unkulu' },
  { pattern: /\babs\b/g,          replacement: 'ixabiso' },
  { pattern: /\bopen\b/g,         replacement: 'vula' },
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
