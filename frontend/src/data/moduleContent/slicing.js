// Module content: String Slicing: aligned to CSC1015F lecture 5C.
// Slicing (especially with negative steps) is the single most-examined string
// topic in this course's past papers, so this module is deliberately thorough.

export const slicingModule = {
  id: 'slicing',
  title: 'String Slicing',
  minutes: 25,
  level: 'Beginner',
  prerequisite: 'String Indexing',

  outcomes: [
    'Extract any substring with s[start:stop:step]',
    'Predict the defaults when start, stop or step are left out',
    'Read and write reversed slices using a negative step',
    'Answer "which slice produces X" exam questions with confidence',
  ],

  learnSections: [
    {
      id: 'slice-basics',
      title: 'Cutting a piece out of a string',
      blocks: [
        {
          kind: 'p',
          text: 'Indexing reads one character; **slicing** reads a whole run of them. Think of the string as a loaf of bread with a cut BETWEEN each slice: `start` says where the knife goes in, `stop` says where it comes out, and the stop slice itself stays on the board.',
        },
        {
          kind: 'string',
          value: 'Hello World',
          highlight: [2, 3, 4],
          negative: true,
          caption: '"Hello World"[2:5] collects indices 2, 3, 4, and it stops BEFORE index 5.',
        },
        {
          kind: 'code',
          code: 's = "Hello World"\ns[2:5]    # \'llo\'  (start included, stop excluded)\ns[0:5]    # \'Hello\'\ns[6:11]   # \'World\'',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'Slice',
          text: '`s[start:stop:step]` returns a NEW string containing the characters from `start`, ending before `stop`, moving `step` positions at a time.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: treating stop as inclusive',
          text: 'The number after the colon is the first index NOT included. `s[0:5]` has exactly 5 characters (5 - 0), never 6. A handy check: the length of a simple slice is stop minus start.',
        },
      ],
    },
    {
      id: 'defaults',
      title: 'The defaults: what blanks mean',
      blocks: [
        {
          kind: 'p',
          text: 'Any of the three parts can be left out, and exams test exactly this. With a **positive step**: a missing start means 0, a missing stop means the end, and a missing step means 1.',
        },
        {
          kind: 'code',
          code: 'greet = "Hello Lethu"\ngreet[:5]    # \'Hello\'   (from the beginning)\ngreet[6:]    # \'Lethu\'   (to the very end)\ngreet[:]     # \'Hello Lethu\'  (a full copy)',
        },
        {
          kind: 'p',
          text: 'With a **negative step**, the defaults flip: a missing start means the LAST character, and a missing stop means "just past the first character". That is why `s[::-1]` reverses a string.',
        },
        {
          kind: 'code',
          code: 's = "trains"\ns[::-1]    # \'sniart\'  (the classic reversal)\ns[1:-1]    # \'rain\'    (drop first AND last character)',
          caption: 'Both of these patterns have been asked, almost word for word, in past exams.',
        },
      ],
    },
    {
      id: 'negative-step',
      title: 'Walking backwards: negative steps',
      blocks: [
        {
          kind: 'p',
          text: 'A negative step processes the string from back to front. The walk starts at `start`, hops `step` positions each time, and stops when it reaches `stop`, which must be BEHIND the start, or nothing is collected.',
        },
        {
          kind: 'string',
          value: 'Jabberwocky',
          highlight: [10, 8, 6, 4, 2, 0],
          negative: true,
          caption: '"Jabberwocky"[::-2] visits indices 10, 8, 6, 4, 2, 0 and produces \'ycwebJ\'.',
        },
        {
          kind: 'table',
          head: ['Expression', 'Result', 'Why'],
          rows: [
            ['"Jabberwocky"[::2]', "'Jbewcy'", 'Forwards, every 2nd character from index 0'],
            ['"Jabberwocky"[::-2]', "'ycwebJ'", 'Backwards from the last character'],
            ['"Jabberwocky"[5:0:-2]', "'rba'", 'Indices 5, 3, 1, and stop 0 is excluded'],
            ['"Jabberwocky"[:5:-1]', "'ykcow'", 'From the end, back to (not including) index 5'],
            ['"hello"[3:1]', "'' (empty)", 'Stop is behind start with a forward step: nothing collected'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: expecting an IndexError',
          text: 'Slicing never raises an IndexError. Out-of-range bounds are clamped and impossible walks return the empty string. Only single-character indexing is strict.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'How this is examined',
          text: 'Two patterns dominate past papers: "what is the value of `(expr)[a:b:-1]`" and "which slice of `w` produces this string". For the second kind, write the indices under the target characters and read off the pattern.',
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
            '`s[start:stop:step]`: start is included, stop is excluded.',
            'Positive-step defaults: start 0, stop end, step 1. `s[:]` copies the whole string.',
            'Negative-step defaults: start at the LAST character, stop just past the first. `s[::-1]` reverses.',
            'Slicing never raises IndexError, and impossible slices give the empty string.',
            'To drop the first and last characters: `s[1:-1]`. To test a palindrome: `s == s[::-1]`.',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      id: 'ex-neg-slice',
      title: 'Predicting a backwards slice',
      intro: 'The most common exam pattern: a concatenation, then a negative-step slice. Work it in two stages.',
      string: 'GoMaMa',
      code: "s = ('Go' + 'Ma'*2)\nprint(s[-1:-4:-1])",
      steps: [
        {
          text: "First resolve the expression: 'Ma'*2 is 'MaMa', so s is 'GoMaMa', which is six characters, indices 0 to 5 (or -6 to -1).",
          highlight: [],
          state: "s = 'GoMaMa'",
        },
        {
          text: 'The slice starts at -1: the last character, `a` at index 5.',
          highlight: [5],
          state: 'collect: a',
        },
        {
          text: 'Step -1 moves one position left each time: index -2 is `M`, index -3 is `a`.',
          highlight: [5, 4, 3],
          state: "collect: 'aMa'",
        },
        {
          text: 'The next hop would be -4, but -4 is the stop, and stop is always excluded. The walk ends with \'aMa\'.',
          highlight: [5, 4, 3],
          state: "s[-1:-4:-1] = 'aMa'",
          output: 'aMa',
        },
      ],
    },
    {
      id: 'ex-which-slice',
      title: 'Reverse-engineering a slice',
      intro: '"Which slice of w produces X?" Solve it by writing indices under the target characters.',
      string: 'Python',
      code: 'w = "Python"\n# Which slice gives "otP"?',
      steps: [
        {
          text: 'Find each target character in w and note its index: `o` is at 4, `t` at 2, `P` at 0.',
          highlight: [4, 2, 0],
          state: 'indices: 4, 2, 0',
        },
        {
          text: 'The indices fall by 2 each time, so the step is -2. The walk starts at 4, which is index -2 from the back.',
          highlight: [4],
          state: 'start -2, step -2',
        },
        {
          text: 'After 0 the walk must simply run off the front, so leave stop blank: `w[-2::-2]` produces \'otP\'. Careful: `w[::-2]` starts at the LAST character and gives \'nhy\' instead.',
          highlight: [4, 2, 0],
          state: "w[-2::-2] = 'otP'",
          output: 'otP',
        },
      ],
    },
  ],

  visualizer: {
    type: 'slicing',
    title: 'Slice Machine',
    description:
      'Type any string and set the three dials, and leave any of them blank to use Python\'s defaults. Press Visualize to watch the walk collect characters one hop at a time.',
    defaults: { text: 'Jabberwocky', start: '', stop: '', step: '-2' },
  },

  practice: {
    apiModuleId: 'slicing',
    // Endless procedural practice (see PracticeEngine.jsx) instead of the
    // static exercise bank the modules without their own engine use — Exam
    // still draws from the bank via `exam.questionCount` below.
    engine: true,
    exam: { questionCount: 10 },
  },
};
