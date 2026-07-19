// Registry of interactive module visualizers.
//
// A module's content file selects one with:
//   visualizer: { type: 'indexing', title, description, defaults: {...} }
// Set `visualizer: null` in a content file to omit the Visualize section.
//
// To add a visualizer for a new module, create the component in this folder
// and register it here — the ModulePage picks it up by type.

import { IndexingVisualizer } from './IndexingVisualizer';
import { SlicingVisualizer } from './SlicingVisualizer';

export const VISUALIZERS = {
  indexing: IndexingVisualizer,
  slicing: SlicingVisualizer,
};

export function getVisualizer(type) {
  return VISUALIZERS[type] ?? null;
}
