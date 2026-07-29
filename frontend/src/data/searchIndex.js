// ─────────────────────────────────────────────────────────────────────────────
// Global search index.
//
// Everything the top-bar search can find is derived from data that already
// exists: the sidebar screens, `data/modules.js`, and the module content in
// `data/moduleContent/`. Adding a module (or a learn section inside one)
// therefore makes it searchable with no changes here.
//
// A result carries enough information to navigate to it:
//   screen    which shell screen to open
//   moduleId  module to open on the Modules screen (optional)
//   section   module page section: learn | examples | visualize | practice
//   anchor    DOM id inside that section to scroll to (optional)
// ─────────────────────────────────────────────────────────────────────────────

import { modules } from './modules';
import { MODULE_CONTENT } from './moduleContent';
import en from '../locales/en.json';

// The index is built once at module load, so it is English-only — matching the
// module content it searches, which is still largely English. Module titles now
// live in the locale bundles, so read them from there.
const moduleCopy = (id) => en.modules.items[id] ?? { title: id, desc: '' };

// Screens, plus the words a learner is likely to type instead of the label.
const PAGES = [
  {
    screen: 'Modules',
    title: 'Learning Modules',
    subtitle: 'Every string topic, step by step',
    keywords: ['lessons', 'course', 'learn', 'topics', 'theory'],
  },
  {
    screen: 'Visualiser',
    title: 'Visualiser',
    subtitle: 'Watch a string change one step at a time',
    keywords: ['visualizer', 'animation', 'diagram', 'demo', 'memory'],
  },
  {
    screen: 'Code Space',
    title: 'Code Space',
    subtitle: 'Write and run Python in the browser',
    keywords: ['editor', 'playground', 'run code', 'repl', 'python', 'ide', 'console'],
  },
  {
    screen: 'Challenges',
    title: 'Challenges',
    subtitle: 'Coding problems with stdin/stdout test cases',
    keywords: ['problems', 'leetcode', 'coding', 'exercises', 'tests'],
  },
  {
    screen: 'Leaderboard',
    title: 'Leaderboard',
    subtitle: 'See how you rank against everyone else',
    keywords: ['ranking', 'scores', 'points', 'top', 'rank'],
  },
  {
    screen: 'Settings',
    title: 'Settings',
    subtitle: 'Theme, account and preferences',
    keywords: ['theme', 'dark mode', 'light mode', 'account', 'profile', 'sign out'],
  },
];

// Authored copy uses `**bold**` and `` `code` `` markers; they would otherwise
// break matches like "index" inside "**index**".
function plain(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[*`_]/g, ' ');
}

// Pull every piece of readable text out of a learn block so that searching for
// something written deep inside a lesson ("IndexError", "upper()") still finds
// the section that teaches it.
function blockTerms(blocks = []) {
  const terms = [];
  for (const block of blocks) {
    if (block.text) terms.push(block.text);
    if (block.title) terms.push(block.title);
    if (block.caption) terms.push(block.caption);
    if (block.code) terms.push(block.code);
    if (block.value) terms.push(block.value);
    if (Array.isArray(block.items)) terms.push(...block.items);
    if (Array.isArray(block.head)) terms.push(...block.head);
    if (Array.isArray(block.rows)) terms.push(...block.rows.flat());
  }
  return terms;
}

function entry({ key, kind, title, subtitle, screen, moduleId, section, anchor, terms }) {
  return {
    key,
    kind,
    title,
    subtitle,
    screen,
    moduleId: moduleId ?? null,
    section: section ?? null,
    anchor: anchor ?? null,
    // One lowercase blob per entry: matching is a substring test, so building
    // it once at module load keeps every keystroke cheap.
    haystack: plain([title, subtitle, ...(terms ?? [])].filter(Boolean).join(' ')).toLowerCase(),
    titleText: plain(title).toLowerCase(),
    subtitleText: plain(subtitle ?? '').toLowerCase(),
  };
}

function buildIndex() {
  const entries = [];

  for (const page of PAGES) {
    entries.push(entry({
      key: `page:${page.screen}`,
      kind: 'page',
      title: page.title,
      subtitle: page.subtitle,
      screen: page.screen,
      terms: [page.screen, ...page.keywords],
    }));
  }

  for (const mod of modules) {
    const content = MODULE_CONTENT[mod.id];
    const { title: modTitle, desc: modDesc } = moduleCopy(mod.id);

    entries.push(entry({
      key: `module:${mod.id}`,
      kind: 'module',
      title: modTitle,
      subtitle: modDesc,
      screen: 'Modules',
      moduleId: mod.id,
      section: 'learn',
      terms: [mod.id, ...(content?.outcomes ?? [])],
    }));

    if (!content) continue;

    for (const section of content.learnSections ?? []) {
      entries.push(entry({
        key: `topic:${mod.id}:${section.id}`,
        kind: 'topic',
        title: section.title,
        subtitle: modTitle,
        screen: 'Modules',
        moduleId: mod.id,
        section: 'learn',
        anchor: `learn-${section.id}`,
        terms: blockTerms(section.blocks),
      }));
    }

    for (const example of content.examples ?? []) {
      entries.push(entry({
        key: `example:${mod.id}:${example.id}`,
        kind: 'example',
        title: example.title,
        subtitle: `Worked example · ${modTitle}`,
        screen: 'Modules',
        moduleId: mod.id,
        section: 'examples',
        anchor: `example-${example.id}`,
        terms: [example.intro, example.code, example.string],
      }));
    }

    if (content.visualizer) {
      entries.push(entry({
        key: `visualize:${mod.id}`,
        kind: 'visualize',
        title: content.visualizer.title ?? `Visualize ${modTitle}`,
        subtitle: `Visualizer · ${modTitle}`,
        screen: 'Modules',
        moduleId: mod.id,
        section: 'visualize',
        terms: [content.visualizer.description, content.visualizer.type],
      }));
    }

    if (content.practice) {
      entries.push(entry({
        key: `practice:${mod.id}`,
        kind: 'practice',
        title: `Practice: ${modTitle}`,
        subtitle: 'Graded questions and exam mode',
        screen: 'Modules',
        moduleId: mod.id,
        section: 'practice',
        terms: ['exam', 'quiz', 'questions', 'test yourself', content.practice.warmup?.title],
      }));
    }
  }

  return entries;
}

export const SEARCH_INDEX = buildIndex();

// Where an entry's own title beats a deep body match, and a whole page or
// module beats a fragment of one, so "slicing" offers the module first.
const KIND_BONUS = { page: 30, module: 28, topic: 6, visualize: 2, example: 0, practice: 0 };

function scoreToken(item, token) {
  const title = item.titleText;
  if (title.startsWith(token)) return 100;
  // Word-start match: "index" should rank "String Indexing" high.
  if (new RegExp(`\\b${escapeRegExp(token)}`).test(title)) return 75;
  if (title.includes(token)) return 45;
  if (item.subtitleText.includes(token)) return 25;
  if (item.haystack.includes(token)) return 10;
  return 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search everything. Every whitespace-separated token must match somewhere
 * (an AND search), so extra words narrow rather than widen the list.
 *
 * @param {string} rawQuery      what the user typed
 * @param {object} [options]
 * @param {(screen: string) => boolean} [options.canAccess]
 *        drops results on screens this user cannot open (guests)
 * @param {number} [options.limit] max results, default 8
 */
export function searchAll(rawQuery, { canAccess, limit = 8 } = {}) {
  const query = (rawQuery ?? '').trim().toLowerCase();
  if (!query) return [];

  const tokens = query.split(/\s+/).filter(Boolean);
  const hits = [];

  for (const item of SEARCH_INDEX) {
    if (canAccess && !canAccess(item.screen)) continue;

    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const score = scoreToken(item, token);
      if (score === 0) { matchedAll = false; break; }
      total += score;
    }
    if (!matchedAll) continue;

    hits.push({ ...item, score: total + (KIND_BONUS[item.kind] ?? 0) });
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return hits.slice(0, limit);
}
