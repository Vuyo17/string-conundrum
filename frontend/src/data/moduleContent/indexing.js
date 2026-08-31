// ─────────────────────────────────────────────────────────────────────────────
// Module content: String Indexing
//
// This file is the reference for authoring module content. Everything on the
// module page is driven by this plain-data structure, so creating a new
// module means writing a file like this one and registering it in
// `data/moduleContent/index.js` (no new components required).
//
// Supported learn blocks (rendered by components/module/ContentBlocks.jsx):
//   { kind: 'p',         text }                            paragraph, `code` spans allowed
//   { kind: 'code',      code, caption? }                  highlighted Python block
//   { kind: 'callout',   tone, title, text }               tone: 'tip' | 'warn' | 'info' | 'define'
//   { kind: 'string',    value, highlight?, negative? }    string-cell figure
//   { kind: 'keypoints', title?, items: [] }               summary card
//   { kind: 'table',     head: [], rows: [[]] }            comparison table
// ─────────────────────────────────────────────────────────────────────────────

export const indexingModule = {
  id: 'indexing',
  title: 'String Indexing',
  minutes: 20,
  level: 'Beginner',
  prerequisite: 'Introduction to Strings',

  outcomes: [
    'Read any character from a string using square brackets',
    'Explain why Python counts from 0, not 1',
    'Use negative indices to count from the end of a string',
    'Predict when an index will raise an IndexError',
  ],

  // ── 1 · Learn ──────────────────────────────────────────────────────────────
  learnSections: [
    {
      id: 'what-is-an-index',
      title: 'Every character has an address',
      blocks: [
        {
          kind: 'p',
          text: 'A string looks like one solid block of text, but Python sees it as a row of numbered boxes, one character per box. The number on each box is called its **index**.',
        },
        {
          kind: 'string',
          value: 'python',
          highlight: [],
          negative: false,
          caption: 'The string "python" is six boxes, numbered 0 to 5.',
        },
        {
          kind: 'p',
          text: 'Think of it like houses on a street: to visit a specific house you use its street number. To visit a specific character, you use its index inside square brackets, right after the string or its variable name.',
        },
        {
          kind: 'code',
          code: 'word = "python"\nprint(word[0])   # p\nprint(word[3])   # h',
          caption: 'Square brackets after a variable mean "give me the character at this address".',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'Indexing',
          text: 'Accessing a single character of a string by its position, written as `string[index]`. The result is a new string of length 1.',
        },
      ],
    },
    {
      id: 'zero-based',
      title: 'Why counting starts at 0',
      blocks: [
        {
          kind: 'p',
          text: 'Humans count "first, second, third…", so it feels natural that the first character should be number 1. Python, like almost every programming language, starts at **0** instead. The index really measures *how far from the start* a character is: the first character is 0 steps in, the second is 1 step in, and so on.',
        },
        {
          kind: 'string',
          value: 'python',
          highlight: [0],
          negative: false,
          caption: 'Index 0 is the first character: 0 steps from the start.',
        },
        {
          kind: 'code',
          code: 'word = "python"\nprint(word[1])   # y  (the SECOND character, not the first)',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'The classic off-by-one trap',
          text: 'Reading `word[1]` and expecting `p` is the single most common indexing mistake. Remember: index 1 is the *second* character. If you want the first one, ask for index 0.',
        },
      ],
    },
    {
      id: 'negative-indexing',
      title: 'Negative indices: counting from the end',
      blocks: [
        {
          kind: 'p',
          text: 'Sometimes you care about the *end* of a string, like the last character, or the one before it. Instead of first working out the length, Python lets you count backwards with negative numbers. `-1` is always the last character, `-2` the one before it, and so on.',
        },
        {
          kind: 'string',
          value: 'python',
          highlight: [5],
          negative: true,
          caption: 'Positive indices count forwards from 0; negative indices count backwards from -1. Both rows point at the same boxes.',
        },
        {
          kind: 'code',
          code: 'word = "python"\nprint(word[-1])   # n  (last character)\nprint(word[-6])   # p  (same box as word[0])',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Two names, one box',
          text: 'Every character has two addresses: a positive one and a negative one. For a string of length `n`, the index `i` and the index `i - n` point at the same character.',
        },
      ],
    },
    {
      id: 'index-error',
      title: 'When Python says no: IndexError',
      blocks: [
        {
          kind: 'p',
          text: 'A string of length 6 has boxes 0 through 5 (and -1 through -6). Ask for a box that does not exist and Python stops your program with an `IndexError`.',
        },
        {
          kind: 'code',
          code: 'word = "python"   # length 6, valid indices 0..5 and -1..-6\nprint(word[6])\n# IndexError: string index out of range',
        },
        {
          kind: 'p',
          text: 'Notice that `word[6]` fails even though the string has 6 characters. The length is 6, but because counting starts at 0, the *largest valid index* is `len(word) - 1`, which is 5.',
        },
        {
          kind: 'table',
          head: ['Expression', 'Result', 'Why'],
          rows: [
            ['word[0]', "'p'", 'First box, 0 steps from the start'],
            ['word[5]', "'n'", 'Last box: len(word) - 1 = 5'],
            ['word[len(word) - 1]', "'n'", 'Always the last character, whatever the length'],
            ['word[6]', 'IndexError', 'len(word) is one past the end'],
            ['word[-6]', "'p'", 'Furthest back you can count'],
            ['word[-7]', 'IndexError', 'Beyond the first character'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'The safe range',
          text: 'For a string `s`, every valid index lies between `-len(s)` and `len(s) - 1`, inclusive. Anything outside that range raises an IndexError.',
        },
      ],
    },
    {
      id: 'common-mistakes',
      title: 'Common mistakes in tests and exams',
      blocks: [
        {
          kind: 'p',
          text: 'Past papers reuse the same handful of indexing traps year after year. Each row below is a mistake that has cost real marks, so check yourself against all four before any test.',
        },
        {
          kind: 'table',
          head: ['Trap', 'Wrong instinct', 'The truth'],
          rows: [
            ['First character', 's[1] is the first letter', 's[0] is, since counting starts at zero'],
            ['Last character', 's[len(s)] is the last letter', 's[len(s) - 1] or s[-1]; len(s) is out of range'],
            ['Negative start', 'negative indices start at 0', 'they start at -1 for the LAST character'],
            ['Writing', "s[0] = 'x' changes the string", 'TypeError: indexing is read-only'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'How this is examined',
          text: 'A recurring MCQ lists index expressions and asks which will cause an error, mixing s[len(s)], s[-len(s)] and arithmetic like s[-8//2]. Work each one out to a plain number first, then test it against the safe range.',
        },
      ],
    },
    {
      id: 'recap',
      title: 'Key takeaways',
      blocks: [
        {
          kind: 'keypoints',
          items: [
            'Strings are rows of numbered boxes; `string[index]` reads one box.',
            'Counting starts at 0, and the index measures distance from the start.',
            'Negative indices count from the end: `-1` is always the last character.',
            'Valid indices run from `-len(s)` up to `len(s) - 1`. Anything else raises an IndexError.',
            'The last character is `s[len(s) - 1]`, or simply `s[-1]`.',
          ],
        },
      ],
    },
  ],

  // ── 2 · Worked examples ────────────────────────────────────────────────────
  // Each step can highlight cells in the figure and reveal reasoning gradually.
  examples: [
    {
      id: 'ex-first-last',
      title: 'Reading the first and last character',
      intro: 'A username checker needs the first and last letters of a name. Step through how each line resolves.',
      string: 'sipho',
      code: 'name = "sipho"\nfirst = name[0]\nlast = name[-1]\nprint(first + last)',
      steps: [
        {
          text: 'Python stores "sipho" as five boxes, indexed 0 to 4 (or -5 to -1 from the end).',
          highlight: [],
        },
        {
          text: '`name[0]` walks 0 steps from the start and reads the box: `first` becomes `"s"`.',
          highlight: [0],
          state: 'first = "s"',
        },
        {
          text: '`name[-1]` counts one back from the end: `last` becomes `"o"`. No need to know the length.',
          highlight: [4],
          state: 'last = "o"',
        },
        {
          text: 'The two single-character strings are joined with `+` and printed.',
          highlight: [0, 4],
          state: 'prints "so"',
          output: 'so',
        },
      ],
    },
    {
      id: 'ex-middle',
      title: 'Finding the middle character',
      intro: 'For a string with an odd length, the middle character sits at index `len(s) // 2`. Follow the arithmetic.',
      string: 'robot',
      code: 's = "robot"\nmid = len(s) // 2\nprint(s[mid])',
      steps: [
        {
          text: '`len(s)` is 5, so the string has five boxes, indexed 0 to 4.',
          highlight: [],
          state: 'len(s) = 5',
        },
        {
          text: '`5 // 2` is integer division: it gives 2, throwing away the remainder. So `mid = 2`.',
          highlight: [],
          state: 'mid = 2',
        },
        {
          text: '`s[2]` walks two steps in from the start and lands on `"b"`, exactly the middle box, with two boxes on each side.',
          highlight: [2],
          state: 's[2] = "b"',
          output: 'b',
        },
      ],
    },
    {
      id: 'ex-indexerror',
      title: 'Predicting an IndexError',
      intro: 'Being able to spot an out-of-range index before running the code is a real skill. Test each access against the valid range.',
      string: 'cape',
      code: 'city = "cape"\nprint(city[3])\nprint(city[4])',
      steps: [
        {
          text: '"cape" has length 4, so the valid indices are 0, 1, 2, 3 (and -1 to -4).',
          highlight: [],
          state: 'valid: 0..3',
        },
        {
          text: '`city[3]` is inside the range, so it reads the last box and prints `"e"`.',
          highlight: [3],
          state: 'city[3] = "e"',
          output: 'e',
        },
        {
          text: '`city[4]` asks for a fifth box that does not exist. Python raises `IndexError: string index out of range` and the program stops.',
          highlight: [],
          state: 'IndexError',
          error: true,
          output: 'IndexError: string index out of range',
        },
      ],
    },
  ],

  // ── 3 · Interactive visualizer ─────────────────────────────────────────────
  // `type` selects a component from components/module/visualizers/index.js.
  visualizer: {
    type: 'indexing',
    title: 'Index Explorer',
    description:
      'Type any string and any index, positive or negative, then press Visualize to watch Python walk the boxes and resolve your expression step by step.',
    defaults: { text: 'conundrum', index: '-2' },
  },

  // ── 4 · Practice ───────────────────────────────────────────────────────────
  practice: {
    apiModuleId: 'indexing', // graded through the real backend pipeline
    // Endless procedural practice (see PracticeEngine.jsx /
    // indexing_engine.py) instead of the static exercise bank — Exam still
    // draws from the bank via `exam.questionCount` below, and the
    // drag-drop warm-up still shows before the very first question.
    engine: true,
    exam: { questionCount: 10 },
    warmup: {
      type: 'drag_drop',
      title: 'Warm-up: put the addresses back',
      prompt:
        'Drag each character of "python" onto its index. Tap a tile then tap a slot if you prefer not to drag.',
      word: 'python',
    },
  },
};
