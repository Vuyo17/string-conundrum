// Registry of interactive module visualizers.
//
// A module's content file selects one with:
//   visualizer: { type: 'indexing', title, description, defaults: {...} }
//
// To add a visualizer for a new module (e.g. slicing), create the component
// in this folder and register it here — the ModulePage picks it up by type.

import { IndexingVisualizer } from './IndexingVisualizer';

export const VISUALIZERS = {
  indexing: IndexingVisualizer,
};

export function getVisualizer(type) {
  return VISUALIZERS[type] ?? null;
}
