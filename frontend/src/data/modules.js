// `id` must match the backend module_id in backend/app/data/exercises.json —
// it is also the key used to look up page content in data/moduleContent/, and
// the title/description under `modules.items.<id>` in the locale bundles.
//
// Titles and descriptions deliberately live in the locale files rather than
// here: they are learner-facing copy, and keeping one copy per language beats
// keeping an English copy here that has to be mirrored into en.json.
export const modules = [
  { id: "intro", minutes: 15 },
  { id: "indexing", minutes: 20 },
  { id: "slicing", minutes: 25 },
  { id: "immutability", minutes: 25 },
  { id: "comparison", minutes: 20 },
  { id: "looping", minutes: 30 },
  { id: "methods", minutes: 35 },
  { id: "formatting", minutes: 35 },
];

export const letters = [
  "H",
  "e",
  "l",
  "l",
  "o",
  ",",
  " ",
  "W",
  "o",
  "r",
  "l",
  "d",
  "!",
];
export const positiveIndexes = letters.map((_, i) => i);
export const negativeIndexes = letters.map((_, i) => i - letters.length);

