// ─────────────────────────────────────────────────────────────────────────────
// Module content registry.
//
// To add a new module:
//   1. Create `data/moduleContent/<id>.js` following the shape documented in
//      `indexing.js` (the reference module).
//   2. Import it below and add it to MODULE_CONTENT.
//   3. Make sure the module in `data/modules.js` uses the same `id`.
// That's it: the ModulePage renders everything from the content object.
// ─────────────────────────────────────────────────────────────────────────────

import { introModule } from './intro';
import { indexingModule } from './indexing';
import { slicingModule } from './slicing';
import { immutabilityModule } from './immutability';
import { comparisonModule } from './comparison';
import { loopingModule } from './looping';
import { methodsModule } from './methods';
import { formattingModule } from './formatting';

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

export function getModuleContent(id) {
  return MODULE_CONTENT[id] ?? null;
}

export function hasModuleContent(id) {
  return Boolean(MODULE_CONTENT[id]);
}
