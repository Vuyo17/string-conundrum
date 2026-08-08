import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightPython } from './pythonHighlight.js';

test('highlights isiPython keywords and builtins', () => {
  const html = highlightPython('ukuba True:\n    bhala("hi")', {
    comment: 'comment',
    string: 'string',
    number: 'number',
    builtin: 'builtin',
    keyword: 'keyword',
  });

  assert.match(html, /<span class="keyword">ukuba<\/span>/);
  assert.match(html, /<span class="builtin">bhala<\/span>/);
});
