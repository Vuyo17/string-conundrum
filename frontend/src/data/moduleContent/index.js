// ─────────────────────────────────────────────────────────────────────────────
// Module content registry.
//
// To add a new module:
//   1. Create `data/moduleContent/<id>.js` following the shape documented in
//      `indexing.js` (the reference module).
//   2. Import it below and add it to MODULE_CONTENT.
//   3. Make sure the module in `data/modules.js` uses the same `id`.
// That's it: the ModulePage renders everything from the content object.
//
// Translations live in `data/moduleContent/<lang>/<id>.js` and hold the SAME
// shape, but may be partial — `getModuleContent` deep-merges them over the
// English base, so an untranslated field falls back to English rather than
// blanking the lesson. Ids and every `code` block stay English.
// ─────────────────────────────────────────────────────────────────────────────

import { introModule } from './intro';
import { indexingModule } from './indexing';
import { slicingModule } from './slicing';
import { immutabilityModule } from './immutability';
import { comparisonModule } from './comparison';
import { loopingModule } from './looping';
import { methodsModule } from './methods';
import { formattingModule } from './formatting';

// isiXhosa overlays. Machine-translated by scripts/translate_content_nllb.py.
import { introModuleXh } from './xh/intro';
import { indexingModuleXh } from './xh/indexing';
import { immutabilityModuleXh } from './xh/immutability';
import { comparisonModuleXh } from './xh/comparison';
import { loopingModuleXh } from './xh/looping';
import { formattingModuleXh } from './xh/formatting';
import { methodsModuleXh } from './xh/methods';
import { slicingModuleXh } from './xh/slicing';

export const MODULE_CONTENT = {
  [introModule.id]: introModule,
  [indexingModule.id]: indexingModule,
  [slicingModule.id]: slicingModule,
  [immutabilityModule.id]: immutabilityModule,
  [comparisonModule.id]: comparisonModule,
  [loopingModule.id]: loopingModule,
  [methodsModule.id]: methodsModule,
  [formattingModule.id]: formattingModule,
};

// Partial overlays. A module with no entry here simply renders in English.
const TRANSLATIONS = {
  xh: {
    [introModule.id]: introModuleXh,
    [indexingModule.id]: indexingModuleXh,
    [immutabilityModule.id]: immutabilityModuleXh,
    [comparisonModule.id]: comparisonModuleXh,
    [loopingModule.id]: loopingModuleXh,
    [formattingModule.id]: formattingModuleXh,
    [methodsModule.id]: methodsModuleXh,
    [slicingModule.id]: slicingModuleXh,
  },
};

// Arrays merge by position, so a translation can localise the first three
// blocks of a section and leave the rest in English.
function deepMerge(base, overlay) {
  if (overlay === undefined || overlay === null) return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(overlay)) return overlay;
    return base.map((item, i) => deepMerge(item, overlay[i]));
  }
  if (base && typeof base === 'object') {
    if (typeof overlay !== 'object' || Array.isArray(overlay)) return overlay;
    const out = { ...base };
    for (const key of Object.keys(overlay)) {
      out[key] = deepMerge(base[key], overlay[key]);
    }
    return out;
  }
  return overlay;
}

export function getModuleContent(id, lang = 'en') {
  const base = MODULE_CONTENT[id] ?? null;
  if (!base) return null;
  const overlay = TRANSLATIONS[lang]?.[id];
  return overlay ? deepMerge(base, overlay) : base;
}
