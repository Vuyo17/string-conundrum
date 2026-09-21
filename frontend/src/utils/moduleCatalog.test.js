import test from 'node:test';
import assert from 'node:assert/strict';
import { localiseModules, modulePageContent, moduleProgress } from './moduleCatalog.js';

const recursion = { id: 'recursion', title: 'Recursion', description: 'Learn recursive functions.', minutes: 25, level: 'Intermediate', section_ids: ['learn', 'exam'] };

test('custom modules retain lecturer copy and open with description, practice and exam', () => {
  const [module] = localiseModules([recursion], key => key, {});
  const content = modulePageContent(module, null);
  assert.equal(module.title, 'Recursion');
  assert.equal(content.learnSections[0].blocks[0].text, recursion.description);
  assert.equal(content.practice.apiModuleId, 'recursion');
  assert.equal(content.practice.moduleTitle, 'Recursion');
  assert.equal(content.practice.exam.questionCount, 10);
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
  const bundled = { learnSections: [{ id: 'original' }], examples: [{ id: 'example' }], practice: { apiModuleId: 'intro', engine: true } };
  const content = modulePageContent({ id: 'intro', title: 'Edited', minutes: 30 }, bundled);
  assert.equal(content.title, 'Edited');
  assert.equal(content.minutes, 30);
  assert.deepEqual(content.learnSections, bundled.learnSections);
  assert.deepEqual(content.examples, bundled.examples);
  assert.equal(content.practice.engine, true);
});

test('custom-module progress requires Learn and Exam, not nonexistent lesson sections', () => {
  const sectionIds = () => { throw new Error('API requirements should be used'); };
  assert.deepEqual(moduleProgress([recursion], { recursion: ['learn', 'practice'] }, sectionIds).recursion, { percent: 50, completed: false });
  assert.deepEqual(moduleProgress([recursion], { recursion: ['learn', 'exam', 'practice', 'learn'] }, sectionIds).recursion, { percent: 100, completed: true });
  assert.deepEqual(moduleProgress([], {}, sectionIds), {});
});
