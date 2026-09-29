import { VISUALIZER_TYPES } from '../components/module/visualizers/types.js';

export const SECTION_IDS = ['learn', 'examples', 'visualize', 'practice', 'exam'];

// Keep built-in translations until a lecturer changes that piece of copy.
// New or edited copy is shown verbatim instead of an untranslated locale key.
export function localiseModules(modules, t, defaults) {
  return modules.map((module) => {
    const original = defaults[module.id];
    return {
      ...module,
      title: original && module.title === original.title
        ? t(`modules.items.${module.id}.title`) : module.title,
      description: original && module.description === original.desc
        ? t(`modules.items.${module.id}.desc`) : module.description,
    };
  });
}

const asText = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const asList = (value) => (Array.isArray(value) ? value : []);

// Lecturer content is free-form JSON, so every block is coerced to the exact
// shape its renderer reads, and anything that would render empty is dropped.
function normaliseBlock(block) {
  if (!block || typeof block !== 'object') return null;
  switch (block.kind ?? 'p') {
    case 'p': {
      const text = asText(block.text).trim();
      return text ? { kind: 'p', text } : null;
    }
    case 'code': {
      const code = asText(block.code || block.text);
      return code.trim() ? { kind: 'code', code, caption: block.caption } : null;
    }
    case 'callout': {
      const text = asText(block.text).trim();
      return text ? { kind: 'callout', tone: block.tone, title: block.title, text } : null;
    }
    case 'keypoints': {
      const raw = typeof block.items === 'string' ? block.items.split('\n') : asList(block.items);
      const items = raw.map((item) => asText(item).trim()).filter(Boolean);
      return items.length ? { kind: 'keypoints', title: block.title, items } : null;
    }
    case 'table': {
      const head = asList(block.head).map(asText);
      const rows = asList(block.rows).filter(Array.isArray).map((row) => row.map(asText));
      return head.length && rows.length ? { kind: 'table', head, rows } : null;
    }
    case 'string': {
      const value = asText(block.value);
      return value ? {
        kind: 'string',
        value,
        highlight: asList(block.highlight),
        negative: Boolean(block.negative),
        caption: block.caption,
      } : null;
    }
    default:
      return null;
  }
}

function normaliseLearnSections(sections) {
  return asList(sections)
    .filter((section) => section && typeof section === 'object')
    .map((section, i) => ({
      ...section,
      id: asText(section.id) || `section-${i + 1}`,
      title: asText(section.title),
      blocks: asList(section.blocks).map(normaliseBlock).filter(Boolean),
    }));
}

// A worked example is a stepper, so one without steps has nothing to show.
function normaliseExamples(examples) {
  return asList(examples)
    .filter((example) => example && typeof example === 'object' && asList(example.steps).length > 0)
    .map((example, i) => ({
      ...example,
      id: asText(example.id) || `example-${i + 1}`,
      title: asText(example.title),
      intro: asText(example.intro),
      code: asText(example.code),
      string: asText(example.string),
      steps: example.steps.map((step) => ({
        ...(step && typeof step === 'object' ? step : {}),
        text: asText(step?.text),
        highlight: asList(step?.highlight),
      })),
    }));
}

function normaliseVisualizer(visualizer) {
  return visualizer && typeof visualizer === 'object' && VISUALIZER_TYPES.includes(visualizer.type)
    ? visualizer
    : null;
}

const DEFAULT_EXAM = { questionCount: 10, balanceTypes: true };

// Resolves what a module page renders: lecturer-authored content when there is
// any, otherwise the bundled lesson, otherwise a lesson built from the
// module's description. The result always has every field ModulePage reads.
export function modulePageContent(module, bundled) {
  if (!module) return bundled;
  const hasLecturerContent = module.content && typeof module.content === 'object'
    && Object.keys(module.content).length > 0;
  const base = hasLecturerContent ? module.content : (bundled ?? {});

  let learnSections = normaliseLearnSections(base.learnSections);
  if (learnSections.length === 0 && module.description) {
    learnSections = [{
      id: 'overview', title: module.title, blocks: [{ kind: 'p', text: module.description }],
    }];
  }
  const outcomes = asList(base.outcomes ?? module.objectives).map(asText).filter(Boolean);
  const practice = base.practice && typeof base.practice === 'object'
    ? base.practice
    : { exam: DEFAULT_EXAM };

  return {
    ...base,
    id: module.id,
    title: module.title,
    minutes: module.minutes,
    level: module.level,
    outcomes,
    learnSections,
    examples: normaliseExamples(base.examples),
    visualizer: normaliseVisualizer(base.visualizer),
    practice: { ...practice, apiModuleId: module.id, moduleTitle: module.title },
  };
}

// The sections a student actually sees for a module, in the lecturer's order.
// Examples and Visualize only exist when the content has them, and the Exam
// only once the module has questions to draw from. Mirrored server-side by
// admin_content.available_sections().
export function availableSections(module, content) {
  const order = Array.isArray(module?.section_ids) && module.section_ids.length
    ? module.section_ids
    : SECTION_IDS;
  const noQuestions = module?.question_count === 0;
  const available = order.filter((id, i) => {
    if (!SECTION_IDS.includes(id) || order.indexOf(id) !== i) return false;
    if (id === 'examples') return content.examples.length > 0;
    if (id === 'visualize') return Boolean(content.visualizer);
    if (id === 'exam') return Boolean(content.practice?.exam) && !noQuestions;
    return true;
  });
  // Learn always renders (it falls back to the description), so a module
  // whose chosen sections are all empty still has a page to open.
  return available.length ? available : ['learn'];
}

// Practice is never part of completion: a module completes on exposure to
// its lesson sections plus an Exam pass.
export function gatingSections(module, content) {
  return availableSections(module, content).filter((id) => id !== 'practice');
}

export function moduleProgress(modules, sectionsByModule, contentFor) {
  return Object.fromEntries(modules.map((module) => {
    const required = gatingSections(module, contentFor(module));
    const done = new Set(sectionsByModule[module.id] ?? []);
    const completedCount = required.filter((id) => done.has(id)).length;
    return [module.id, {
      percent: required.length ? Math.round(100 * completedCount / required.length) : 0,
      completed: required.length > 0 && completedCount === required.length,
    }];
  }));
}
