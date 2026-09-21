import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { drawExam } from './examQuestions.js';
import { introModule } from '../../data/moduleContent/intro.js';

const bank = JSON.parse(readFileSync(new URL('../../../../backend/app/data/exercises.json', import.meta.url), 'utf8'));
const intro = bank.filter(q => q.module_id === 'intro');

test('Introduction draws ten unique questions across all four formats', () => {
  const original = [...intro];
  const { questionCount, balanceTypes } = introModule.practice.exam;
  for (let i = 0; i < 100; i++) {
    const paper = drawExam(intro, questionCount, balanceTypes);
    assert.equal(paper.length, 10);
    assert.equal(new Set(paper.map(q => q.question_id)).size, 10);
    const counts = paper.reduce((out, q) => ({ ...out, [q.type]: (out[q.type] ?? 0) + 1 }), {});
    assert.deepEqual(counts, { mcq: 3, select_all: 3, fill_blank: 3, write_code: 1 });
  }
  assert.deepEqual(intro, original);
});

test('drawing handles empty banks, depleted formats, and shorter papers', () => {
  assert.deepEqual(drawExam([], 10, true), []);
  assert.deepEqual(drawExam(intro, 0, true), []);
  const small = [intro[0], intro.at(-1)];
  assert.deepEqual(new Set(drawExam(small, 10, true)), new Set(small));
  assert.equal(drawExam(intro, 2, true).length, 2);
  assert.equal(drawExam(intro, 3).length, 3);
});
