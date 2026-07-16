// ─────────────────────────────────────────────────────────────────────────────
// Module content: String Slicing
//
// Follows the exact pattern of indexing.js for consistency with CSC1015F.
// Covers slicing[start:stop:step], negative indices, the "eve" exercise from lectures,
// and the capitalise sentence exercise.
// ─────────────────────────────────────────────────────────────────────────────

export const slicingModule = {
  id: 'slicing',
  title: 'String Slicing',
  tagline:
    'Extract any substring you need with powerful slice notation. Master start, stop, and step — including the exclusive stop and negative indices.',
  minutes: 25,
  level: 'Beginner',
  prerequisite: 'String Indexing',

  outcomes: [
    'Use slice notation string[start:stop:step] to extract substrings',
    'Understand that the stop index is exclusive (not included)',
    'Apply negative indices and negative step for reversal and flexible slicing',
    'Solve classic slicing problems such as extracting "eve" from "never odd or even"',
  ],

  // ── 1 · Learn ──────────────────────────────────────────────────────────────
  learnSections: [
    {
      id: 'slice-basics',
      title: 'The anatomy of a slice',
      blocks: [
        {
          kind: 'p',
          text: 'Slicing lets you pull out a **sequence** of characters instead of just one. The syntax is `string[start:stop:step]`.',
        },
        {
          kind: 'code',
          code: 's = "never odd or even"\nprint(s[1:4])      # "eve"\nprint(s[13:16])    # "eve"',
          caption: 'From the lecture exercise: multiple ways to get "eve".',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'Exclusive stop',
          text: 'The character at the `stop` index is **never included**. `s[1:4]` gives characters at positions 1, 2, and 3.',
        },
        {
          kind: 'string',
          value: 'never odd or even',
          highlight: [1,2,3],
          negative: false,
          caption: 's[1:4] highlights the "eve" substring.',
        },
      ],
    },
    {
      id: 'negative-step',
      title: 'Reversing and stepping backwards',
      blocks: [
        {
          kind: 'p',
          text: 'A negative step moves backwards through the string. This is extremely useful for reversing text or extracting characters in reverse order.',
        },
        {
          kind: 'code',
          code: 's = "never odd or even"\nprint(s[-14:-17:-1])   # "eve"\nprint(s[15:12:-1])    # "eve"',
          caption: 'Two of the eight official ways from the lecture to slice "eve".',
        },
      ],
    },
    {
      id: 'capitalise-exercise',
      title: 'Practical exercise: Capitalise a sentence',
      blocks: [
        {
          kind: 'p',
          text: 'A common real-world task: capitalise the first letter of every word in a sentence (assuming input is all lowercase).',
        },
        {
          kind: 'code',
          code: 'def capitalise(sentence):\n    words = sentence.split()\n    capitalised = [w[0].upper() + w[1:] for w in words]\n    return " ".join(capitalised)\n\nprint(capitalise("make this big"))  # "Make This Big"',
          caption: 'Solution approach shown in lectures. Use split(), upper(), and join().',
        },
      ],
    },
  ],

  // ── 2 · Worked Examples ────────────────────────────────────────────────────
  examples: [
    {
      id: 'eve-slicing',
      title: 'Eight ways to slice "eve"',
      intro: 'From the official lecture exercise: find as many ways as possible to slice the string "never odd or even" to obtain the word "eve".',
      string: 'never odd or even',
      code: 's = "never odd or even"',
      steps: [
        {
          text: 'Forward slice from index 1 to 4 (exclusive stop).',
          highlight: [1,2,3],
          state: 's[1:4]',
          output: 'eve',
        },
        {
          text: 'Negative indices from the end: positions -16 to -13.',
          highlight: [1,2,3],
          state: 's[-16:-13]',
          output: 'eve',
        },
        {
          text: 'Reverse slice with negative step: from -14 to -17 stepping -1.',
          highlight: [1,2,3],
          state: 's[-14:-17:-1]',
          output: 'eve',
        },
      ],
    },
  ],

  // ── 3 · Visualizer ─────────────────────────────────────────────────────────
  visualizer: {
    type: 'slicing',
    title: 'Interactive Slicer',
    description: 'Experiment with start, stop and step on a live string. See exactly which characters are included.',
    defaults: { text: 'never odd or even', start: '1', stop: '4', step: '1' },
  },

  // ── 4 · Practice (links to backend exercises) ──────────────────────────────
  practice: {
    apiModuleId: 'slicing',
    warmup: {
      type: 'drag_drop',
      title: 'Warm-up: Build "eve"',
      prompt: 'Drag the correct characters into the boxes to form the substring "eve" from the lecture example.',
      word: 'eve',
    },
  },
};

export default slicingModule;