import { getModuleContent } from '../data/moduleContent';

// The full possible stage sequence for a module's flow: Learn -> Examples ->
// (Visualize, if the module has one) -> Practice -> (Exam, if configured).
export const SECTION_IDS = ['learn', 'examples', 'visualize', 'practice', 'exam'];

// The section ids a given module actually has. Content shape doesn't vary by
// language, so 'en' is always safe to read here.
export function getModuleSectionIds(moduleId) {
  const content = getModuleContent(moduleId, 'en');
  if (!content) return SECTION_IDS;
  return SECTION_IDS.filter((id) => {
    if (id === 'visualize') return Boolean(content.visualizer);
    if (id === 'exam') return Boolean(content.practice?.exam);
    return true;
  });
}
