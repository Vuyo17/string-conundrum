// Kept free of React imports so utils (and their node:test suites) can check a
// type without loading the components. Must list every key of VISUALIZERS in
// ./index.js, and is mirrored by VISUALIZER_TYPES in
// backend/app/services/admin_content.py.
export const VISUALIZER_TYPES = ['indexing', 'slicing'];
