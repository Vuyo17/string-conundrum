// Module content: Introduction to Strings — aligned to CSC1015F lecture 5A
// (string literals, escape sequences, Unicode/ord/chr, + * len).

export const introModule = {
  id: 'intro',
  title: 'Introduction to Strings',
  tagline:
    'Text is data too. Learn how Python stores words as sequences of numbered characters, and the basic tools for building and measuring them.',
  minutes: 15,
  level: 'Beginner',
  prerequisite: null,

  outcomes: [
    'Create string literals with single or double quotes',
    'Use escape sequences like \\n and \\\\ correctly',
    'Convert between characters and Unicode numbers with ord() and chr()',
    'Join, repeat and measure strings with +, * and len()',
  ],

  learnSections: [
    {
      id: 'what-is-a-string',
      title: 'What a string really is',
      blocks: [
        {
          kind: 'p',
          text: 'A **string** is a sequence of characters: letters, digits, spaces and symbols, in a fixed order. Think of it as beads on a wire — each bead is one character, and the wire keeps them in order.',
        },
        {
          kind: 'code',
          code: 'greeting = "howzit %*&_96"\nname = \'Sipho\'      # single quotes work too',
          caption: 'Single and double quotes create exactly the same kind of string.',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'String literal',
          text: 'Text written directly in code, wrapped in matching single or double quotes. Without quotes, Python thinks the text is a variable name.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Quotes inside quotes',
          text: 'A string like `it\'s cold` breaks single quotes — Python thinks the string ends at the apostrophe. Wrap it in double quotes instead: `"it\'s cold"`.',
        },
      ],
    },
    {
      id: 'escape-sequences',
      title: 'Escape sequences: characters in disguise',
      blocks: [
        {
          kind: 'p',
          text: 'Some characters cannot be typed directly inside a string. An **escape sequence** starts with a backslash and stands for exactly ONE character: `\\n` is a newline and `\\\\` is a single backslash.',
        },
        {
          kind: 'code',
          code: 'print("Line 1\\nLine 2")   # \\n starts a new line\nprint("A\\\\B")             # prints A\\B  (one backslash)\nlen("Cape\\nTown")         # 9, not 10 — \\n is ONE character',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: counting escape sequences as two characters',
          text: 'Tests love asking for `len()` of a string containing `\\n`. In the source code it LOOKS like two symbols, but the string stores a single newline character. `len("Cape\\nTown")` is 9.',
        },
      ],
    },
    {
      id: 'unicode',
      title: 'Under the hood: Unicode, ord() and chr()',
      blocks: [
        {
          kind: 'p',
          text: 'The computer never stores letters — it stores numbers. **Unicode** is the agreed mapping between numbers and symbols: 65 is `A`, 66 is `B`, and 97 is `a`. Two functions move between the two worlds.',
        },
        {
          kind: 'table',
          head: ['Expression', 'Result', 'Why'],
          rows: [
            ['ord("A")', '65', 'Character to Unicode number'],
            ['chr(97)', "'a'", 'Unicode number to character'],
            ['chr(ord("a") + 2)', "'c'", 'Characters can be shifted through arithmetic'],
            ['ord("a") - ord("A")', '32', 'Lowercase letters sit 32 places after uppercase'],
          ],
        },
        {
          kind: 'p',
          text: 'This is why character arithmetic works: shifting letters by adding to their `ord()` value is exactly how the classic cypher exercises in this course are solved.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Numbers that look like text',
          text: '`int("1234")` converts a numeric string to a real integer; `str(1234)` goes the other way. Until you convert, `"10"` is just two characters — it is never equal to the number `10`.',
        },
      ],
    },
    {
      id: 'operators',
      title: 'Building and measuring: +, * and len()',
      blocks: [
        {
          kind: 'code',
          code: '"hello" + " " + "world"   # \'hello world\'  (+ joins)\n"hello" * 2               # \'hellohello\'   (* repeats)\nlen("hello")              # 5             (len measures)',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: "Common mistake: expecting * to do maths on digit strings",
          text: "`'23.4' * 2` is `'23.423.4'`, not 46.8. The quotes make it a string, and * repeats strings — it never adds their digits. This exact trap has appeared in a theory test.",
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: + between a string and a number',
          text: '`"Score: " + 10` raises a TypeError. Convert first: `"Score: " + str(10)`.',
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
            'Strings are ordered sequences of characters, wrapped in matching quotes.',
            'An escape sequence like `\\n` or `\\\\` is ONE character, not two.',
            '`ord()` turns a character into its Unicode number; `chr()` turns a number back into a character.',
            '`+` joins strings, `*` repeats them, and `len()` counts their characters.',
            'A string of digits is still a string: `"10" != 10` until you convert with `int()`.',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      id: 'ex-escape-len',
      title: 'Counting characters through an escape sequence',
      intro: 'A theory-test favourite: how long is a string that contains an escape sequence?',
      string: 'A\\nB',
      code: 's = "A\\nB"\nprint(len(s))',
      steps: [
        {
          text: 'In the source code, the literal looks like four symbols: A, backslash, n, B.',
          highlight: [],
        },
        {
          text: 'But Python translates `\\n` into a single newline character as it reads the code. The stored string is A, newline, B.',
          highlight: [1, 2],
          state: 'stored: 3 chars',
        },
        {
          text: '`len(s)` counts the stored characters, so it prints 3.',
          highlight: [],
          state: 'len(s) = 3',
          output: '3',
        },
      ],
    },
    {
      id: 'ex-shift',
      title: 'Shifting a letter with ord() and chr()',
      intro: 'The cypher pattern: move a character forward through the alphabet using its Unicode number.',
      string: 'cab',
      code: 'ch = "c"\nshifted = chr(ord(ch) + 1)\nprint(shifted)',
      steps: [
        {
          text: '`ord("c")` looks up the Unicode number for `c`, which is 99.',
          highlight: [0],
          state: 'ord("c") = 99',
        },
        {
          text: 'Adding 1 gives 100 — plain integer arithmetic.',
          highlight: [],
          state: '99 + 1 = 100',
        },
        {
          text: '`chr(100)` converts back to a character: `d`. The whole alphabet is just consecutive numbers.',
          highlight: [],
          state: 'chr(100) = "d"',
          output: 'd',
        },
      ],
    },
  ],

  visualizer: {
    type: 'indexing',
    title: 'Character Explorer',
    description:
      'Every character in a string sits at a numbered position. Type a string and an index to see how Python reaches each character — the next module covers this in depth.',
    defaults: { text: 'howzit', index: '0' },
  },

  practice: {
    apiModuleId: 'intro',
    exam: { questionCount: 10 },
  },
};
