import { getModuleContent } from '../data/moduleContent';

// The full possible stage sequence for a module's flow: Learn -> Examples ->
// (Visualize, if the module has one) -> Practice -> (Exam, if configured).
export const SECTION_IDS = ['learn', 'examples', 'visualize', 'practice', 'exam'];

// The sections that count toward module completion (and so toward unlocking
// the next module / the Challenges gate). Practice is deliberately excluded:
// it's still a real, navigable section — students can do it and see their own
// pass/fail there — but a module can complete on Learn + Examples + Visualize
// exposure plus an Exam pass alone, without ever touching Practice.
const GATING_SECTION_IDS = SECTION_IDS.filter((id) => id !== 'practice');

// The gating section ids a given module actually has. Content shape doesn't
// vary by language, so 'en' is always safe to read here.
export function getModuleSectionIds(moduleId) {
  const content = getModuleContent(moduleId, 'en');
  if (!content) return ['learn', 'exam'];
  return GATING_SECTION_IDS.filter((id) => {
    if (id === 'visualize') return Boolean(content.visualizer);
    if (id === 'exam') return Boolean(content.practice?.exam);
    return true;
  });
}
