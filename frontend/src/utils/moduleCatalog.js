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

export function modulePageContent(module, bundled) {
  if (!module) return bundled;
  const baseContent = module.content && Object.keys(module.content).length
    ? module.content
    : bundled ?? {
      id: module.id,
      outcomes: Array.isArray(module.objectives) ? module.objectives : [],
      learnSections: module.description ? [{
        id: 'overview', title: module.title,
        blocks: [{ kind: 'p', text: module.description }],
      }] : [],
      examples: [],
      visualizer: null,
      practice: { apiModuleId: module.id, exam: { questionCount: 10, balanceTypes: true } },
    };
  const content = { ...baseContent };
  if (!content.outcomes && Array.isArray(module.objectives)) content.outcomes = module.objectives;
  if (!content.learnSections && module.description) {
    content.learnSections = [{ id: 'overview', title: module.title, blocks: [{ kind: 'p', text: module.description }] }];
  }
  if (!content.practice) content.practice = { apiModuleId: module.id, exam: { questionCount: 10, balanceTypes: true } };
  return {
    ...content,
    title: module.title,
    minutes: module.minutes,
    level: module.level,
    practice: { ...content.practice, apiModuleId: module.id, moduleTitle: module.title },
  };
}

export function moduleProgress(modules, sectionsByModule, sectionIdsFor) {
  return Object.fromEntries(modules.map((module) => {
    const required = module.section_ids ?? sectionIdsFor(module.id);
    const done = new Set(sectionsByModule[module.id] ?? []);
    const completedCount = required.filter(id => done.has(id)).length;
    return [module.id, {
      percent: required.length ? Math.round(100 * completedCount / required.length) : 0,
      completed: required.length > 0 && completedCount === required.length,
    }];
  }));
}
