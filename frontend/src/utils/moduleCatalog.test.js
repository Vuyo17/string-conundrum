import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableSections, localiseModules, modulePageContent, moduleProgress,
} from './moduleCatalog.js';

const recursion = { id: 'recursion', title: 'Recursion', description: 'Learn recursive functions.', minutes: 25, level: 'Intermediate', section_ids: ['learn', 'exam'], question_count: 3 };
const contentFor = (module) => modulePageContent(module, null);

test('custom modules retain lecturer copy and open with description, practice and exam', () => {
  const [module] = localiseModules([recursion], key => key, {});
  const content = modulePageContent(module, null);
  assert.equal(module.title, 'Recursion');
  assert.equal(content.learnSections[0].blocks[0].text, recursion.description);
  assert.equal(content.practice.apiModuleId, 'recursion');
  assert.equal(content.practice.moduleTitle, 'Recursion');
  assert.equal(content.practice.exam.questionCount, 10);
  assert.deepEqual(content.outcomes, []);
  assert.deepEqual(content.examples, []);
  assert.equal(content.visualizer, null);
});

test('built-in translations are retained until the lecturer edits the copy', () => {
  const defaults = { intro: { title: 'Introduction', desc: 'Learn strings.' } };
  const translate = key => `translated:${key}`;
  const [original, renamed] = localiseModules([
    { id: 'intro', title: 'Introduction', description: 'Learn strings.' },
    { id: 'intro', title: 'New title', description: 'New description' },
  ], translate, defaults);
  assert.equal(original.title, 'translated:modules.items.intro.title');
  assert.equal(original.description, 'translated:modules.items.intro.desc');
  assert.equal(renamed.title, 'New title');
  assert.equal(renamed.description, 'New description');
});

test('metadata updates retain bundled lessons and practice configuration', () => {
  const bundled = {
    learnSections: [{ id: 'original', title: 'Original', blocks: [{ kind: 'p', text: 'Body' }] }],
    examples: [{ id: 'example', title: 'Ex', intro: '', code: 'x', string: 'ab', steps: [{ text: 'one', highlight: [0] }] }],
    visualizer: { type: 'indexing' },
    practice: { apiModuleId: 'intro', engine: true },
  };
  const content = modulePageContent({ id: 'intro', title: 'Edited', minutes: 30 }, bundled);
  assert.equal(content.title, 'Edited');
  assert.equal(content.minutes, 30);
  assert.deepEqual(content.learnSections, bundled.learnSections);
  assert.deepEqual(content.examples, bundled.examples);
  assert.deepEqual(content.visualizer, bundled.visualizer);
  assert.equal(content.practice.engine, true);
});

test('partial lecturer content opens instead of crashing the page', () => {
  // The shape the dashboard saved for the first lecturer-made module: no
  // outcomes, examples or practice, and a block that changed kind mid-edit.
  const content = modulePageContent({
    ...recursion,
    content: {
      learnSections: [
        { id: 'section-1', title: 'Intro', blocks: [{ kind: 'p', text: 'hello' }, { kind: 'p', text: '  ' }] },
        { title: 'No id', blocks: [
          { kind: 'code', text: 'print(1)' },
          { kind: 'keypoints', items: 'one\n\ntwo' },
          { kind: 'mystery', text: 'dropped' },
          null,
        ] },
        { id: 'no-blocks' },
      ],
      examples: [{ id: 'no-steps' }],
      visualizer: { type: 'not-a-visualizer' },
    },
  }, null);

  assert.deepEqual(content.outcomes, []);
  assert.deepEqual(content.examples, []);
  assert.equal(content.visualizer, null);
  assert.equal(content.practice.exam.questionCount, 10);
  assert.deepEqual(content.learnSections[0].blocks, [{ kind: 'p', text: 'hello' }]);
  assert.equal(content.learnSections[1].id, 'section-2');
  assert.deepEqual(content.learnSections[1].blocks, [
    { kind: 'code', code: 'print(1)', caption: undefined },
    { kind: 'keypoints', title: undefined, items: ['one', 'two'] },
  ]);
  assert.deepEqual(content.learnSections[2].blocks, []);
});

test('only sections the module actually shows are offered and required', () => {
  const full = { ...recursion, section_ids: ['learn', 'examples', 'visualize', 'practice', 'exam'] };
  assert.deepEqual(availableSections(full, contentFor(full)), ['learn', 'practice', 'exam']);
  const noQuestions = { ...full, question_count: 0 };
  assert.deepEqual(availableSections(noQuestions, contentFor(noQuestions)), ['learn', 'practice']);
  const onlyMissing = { ...full, section_ids: ['visualize'] };
  assert.deepEqual(availableSections(onlyMissing, contentFor(onlyMissing)), ['learn']);
});

test('custom-module progress requires Learn and Exam, not nonexistent lesson sections', () => {
  assert.deepEqual(moduleProgress([recursion], { recursion: ['learn', 'practice'] }, contentFor).recursion, { percent: 50, completed: false });
  assert.deepEqual(moduleProgress([recursion], { recursion: ['learn', 'exam', 'practice', 'learn'] }, contentFor).recursion, { percent: 100, completed: true });
  assert.deepEqual(moduleProgress([], {}, contentFor), {});
});

test('a module with no questions completes from its lesson alone', () => {
  const empty = { ...recursion, section_ids: ['learn', 'examples', 'visualize', 'practice', 'exam'], question_count: 0 };
  assert.deepEqual(moduleProgress([empty], { recursion: ['learn'] }, contentFor).recursion, { percent: 100, completed: true });
});
