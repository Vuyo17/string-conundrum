import test from 'node:test';
import assert from 'node:assert/strict';
import { transpileIsiXhosaToPython, transpilePythonToIsiXhosa, translateDisplayText } from './isiXhosaTranspiler.js';

test('transpiles isiXhosa-friendly keywords to Python', () => {
  const input = `ukuba ubude(text) > 5:\n    bhala("Long string!")\nngaphandle:\n    bhala("Short string.")`;
  assert.equal(
    transpileIsiXhosaToPython(input),
    `if len(text) > 5:\n    print("Long string!")\nelse:\n    print("Short string.")`,
  );
});

test('leaves normal Python code unchanged', () => {
  const input = `for c in text:\n    print(c)`;
  assert.equal(transpileIsiXhosaToPython(input), input);
});

test('transpiles Python back to an isiXhosa-friendly form', () => {
  const input = `if len(text) > 5:\n    print("Long string!")\nelse:\n    print("Short string.")`;
  assert.equal(
    transpilePythonToIsiXhosa(input),
    `ukuba ubude(text) > 5:\n    bhala("Long string!")\nngaphandle:\n    bhala("Short string.")`,
  );
});

test('transpiles loop and while variants', () => {
  const input = `ngelixa i < 3:\n    bhala(text[i])\nkwi c ku text:`;
  assert.equal(transpileIsiXhosaToPython(input), `while i < 3:\n    print(text[i])\nfor c in text:`);
});

test('transpiles extended keywords: def/return/True/False/None', () => {
  const input = `chaza check(x):\n    ukuba x > 0:\n        buyisa Ewe\n    buyisa Hayi`;
  assert.equal(
    transpileIsiXhosaToPython(input),
    `def check(x):\n    if x > 0:\n        return True\n    return False`,
  );
});

test('transpiles extended builtins: range/input/int/str', () => {
  const input = `kwi i ku ithuba(inombolo(faka())):\n    bhala(isigama(i))`;
  assert.equal(
    transpileIsiXhosaToPython(input),
    `for i in range(int(input())):\n    print(str(i))`,
  );
});

test('does not translate keywords inside string literals', () => {
  const input = `bhala("ukuba ngelixa kwi")`;
  assert.equal(transpileIsiXhosaToPython(input), `print("ukuba ngelixa kwi")`);
});

test('does not translate keywords inside comments', () => {
  const input = `# ukuba ngelixa kwi\nbhala("hello")`;
  assert.equal(transpileIsiXhosaToPython(input), `# ukuba ngelixa kwi\nprint("hello")`);
});

test('translateDisplayText replaces Python keywords in debug descriptions when lang=xh', () => {
  // Realistic debug step: description comes from the backend tracer
  const desc = 'for loop: c = "H", iterating in text';
  const result = translateDisplayText(desc, 'xh');
  assert.ok(result.includes('kwi'), `expected "kwi" in "${result}"`);
  assert.ok(result.includes('ku'), `expected "ku" in "${result}"`);
});

test('translateDisplayText is a no-op when lang=en', () => {
  const desc = 'Assignment: x = 5';
  assert.equal(translateDisplayText(desc, 'en'), desc);
});
