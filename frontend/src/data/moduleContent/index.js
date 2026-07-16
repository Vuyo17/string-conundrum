// ─────────────────────────────────────────────────────────────────────────────
// Module content registry.
//
// To add a new module:
//   1. Create `data/moduleContent/<id>.js` following the shape documented in
//      `indexing.js` (the reference module).
//   2. Import it below and add it to MODULE_CONTENT.
//   3. Make sure the module in `data/modules.js` uses the same `id`.
// That's it — the ModulePage renders everything from the content object.
// ─────────────────────────────────────────────────────────────────────────────

import { indexingModule } from './indexing';
import { slicingModule } from './slicing';

export const MODULE_CONTENT = {
  [indexingModule.id]: indexingModule,
  [slicingModule.id]: slicingModule,
};

export function getModuleContent(id) {
  return MODULE_CONTENT[id] ?? null;
}

export function hasModuleContent(id) {
  return Boolean(MODULE_CONTENT[id]);
}
