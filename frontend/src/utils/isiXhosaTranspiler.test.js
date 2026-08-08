import test from 'node:test';
import assert from 'node:assert/strict';
import { transpileIsiXhosaToPython, transpilePythonToIsiXhosa } from './isiXhosaTranspiler.js';

test('transpiles isiXhosa-friendly keywords to Python', () => {
  const input = `ukuba ubude(text) > 5:
    bhala("Long string!")
ngaphandle:
    bhala("Short string.")`;

  const output = transpileIsiXhosaToPython(input);

  assert.equal(output, `if len(text) > 5:\n    print("Long string!")\nelse:\n    print("Short string.")`);
});

test('leaves normal Python code unchanged', () => {
  const input = `for c in text:\n    print(c)`;

  assert.equal(transpileIsiXhosaToPython(input), input);
});

test('transpiles Python back to an isiXhosa-friendly form', () => {
  const input = `if len(text) > 5:\n    print("Long string!")\nelse:\n    print("Short string.")`;

  const output = transpilePythonToIsiXhosa(input);

  assert.equal(output, `ukuba ubude(text) > 5:\n    bhala("Long string!")\nngaphandle:\n    bhala("Short string.")`);
});

test('transpiles loop and while variants', () => {
  const input = `ngelixa i < 3:\n    bhala(text[i])\nkwi c ku text:`;

  const output = transpileIsiXhosaToPython(input);

  assert.equal(output, `while i < 3:\n    print(text[i])\nfor c in text:`);
});
