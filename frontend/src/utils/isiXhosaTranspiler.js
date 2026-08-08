const TO_PYTHON_REPLACEMENTS = [
  { pattern: /\bukuba\b/g, replacement: 'if' },
  { pattern: /\bngaphandle\b/g, replacement: 'else' },
  { pattern: /\bngelixa\b/g, replacement: 'while' },
  { pattern: /\bkwi\b/g, replacement: 'for' },
  { pattern: /\bku\b/g, replacement: 'in' },
  { pattern: /\bbhala\b/g, replacement: 'print' },
  { pattern: /\bubude\b/g, replacement: 'len' },
];

const TO_XHOSA_REPLACEMENTS = [
  { pattern: /\bif\b/g, replacement: 'ukuba' },
  { pattern: /\belse\b/g, replacement: 'ngaphandle' },
  { pattern: /\bwhile\b/g, replacement: 'ngelixa' },
  { pattern: /\bfor\b/g, replacement: 'kwi' },
  { pattern: /\bin\b/g, replacement: 'ku' },
  { pattern: /\bprint\b/g, replacement: 'bhala' },
  { pattern: /\blen\b/g, replacement: 'ubude' },
];

function applyReplacements(source, replacements) {
  if (!source) return '';

  return source
    .split(/\r?\n/)
    .map((line) => {
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const body = line.slice(indent.length);

      const translatedBody = replacements.reduce(
        (current, { pattern, replacement }) => current.replace(pattern, replacement),
        body,
      );

      return `${indent}${translatedBody}`;
    })
    .join('\n');
}

export function transpileIsiXhosaToPython(source) {
  return applyReplacements(source, TO_PYTHON_REPLACEMENTS);
}

export function transpilePythonToIsiXhosa(source) {
  return applyReplacements(source, TO_XHOSA_REPLACEMENTS);
}
