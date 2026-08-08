// Shared, dependency-free Python syntax highlighter.
// Pass a class map so any stylesheet can drive the colours:
//   highlightPython(code, { comment, string, number, builtin, keyword })
// Returns an HTML string (all non-token text is escaped).

const TOKEN_REGEX = /(#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b(?:def|class|if|elif|else|for|while|in|return|break|continue|pass|try|except|finally|with|as|import|from|True|False|None|and|or|not|lambda|yield|ukuba|ngaphandle|ngelixa|kwi|ku|bhala|ubude)\b|\b(?:print|len|range|enumerate|input|str|int|float|list|dict|set|tuple)\b)/g;

const BUILTIN_REGEX = /^(print|len|range|enumerate|input|str|int|float|list|dict|set|tuple|bhala|ubude)$/;

export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function highlightPython(code, classes) {
  return code
    .split('\n')
    .map((line) => {
      let out = '';
      let cursor = 0;

      for (const match of line.matchAll(TOKEN_REGEX)) {
        const token = match[0];
        const index = match.index ?? 0;

        out += escapeHtml(line.slice(cursor, index));

        let cls;
        if (token.startsWith('#')) cls = classes.comment;
        else if (token.startsWith('"') || token.startsWith("'")) cls = classes.string;
        else if (/^\d/.test(token)) cls = classes.number;
        else if (BUILTIN_REGEX.test(token)) cls = classes.builtin;
        else cls = classes.keyword;

        out += `<span class="${cls}">${escapeHtml(token)}</span>`;
        cursor = index + token.length;
      }

      out += escapeHtml(line.slice(cursor));
      return out;
    })
    .join('\n');
}
