// Module content: String Formatting: .format() with positional arguments,
// alignment and width, float precision, and f-strings (with the missing-f trap).

export const formattingModule = {
  id: 'formatting',
  title: 'String Formatting',
  minutes: 35,
  level: 'Intermediate',
  prerequisite: 'String Methods',

  outcomes: [
    'Fill templates with .format() using positional numbers',
    'Control alignment and width with <, > and ^',
    'Round and pad numbers with format specs like 6.2f',
    'Use f-strings, and spot the missing-f trap',
  ],

  learnSections: [
    {
      id: 'format-basics',
      title: 'Templates and positional holes',
      blocks: [
        {
          kind: 'p',
          text: 'Think of a **template** as a form letter: the fixed text is written once, with numbered holes where values get poured in. `{0}` means "the first argument of format()", `{1}` the second, and the same hole may be used more than once, in any order.',
        },
        {
          kind: 'code',
          code: '"{0} {1}".format("one", "two")   # \'one two\'\n"{1} {0}".format("one", "two")   # \'two one\'\n"{0} {0}".format("go")           # \'go go\'',
          caption: 'The number selects the argument; the position of the hole selects where it lands.',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'Format specification',
          text: 'Extra instructions after a colon inside the hole: `{0:>20}` means "argument 0, right-aligned in a field 20 wide". The part after the colon is the format spec.',
        },
      ],
    },
    {
      id: 'alignment',
      title: 'Alignment and width',
      blocks: [
        {
          kind: 'p',
          text: 'A width makes the hole a fixed-size field, padded with spaces. The arrow points where the VALUE goes: `<` pushes it left, `>` pushes it right, `^` centres it.',
        },
        {
          kind: 'table',
          head: ['Expression', 'Result', 'Why'],
          rows: [
            ['"{0:<6}".format("one")', "'one   '", 'Left-aligned: value first, 3 spaces after'],
            ['"{0:>6}".format("one")', "'   one'", 'Right-aligned: 3 spaces first'],
            ['"{0:^6}".format("one")', "' one  '", 'Centred: extra space goes to the right'],
            ['"{1:^4}".format("AA", "BB")', "' BB '", 'Argument 1 is "BB", centred in width 4'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: reading the arrow backwards',
          text: 'The arrow shows where the value sits, not where the padding goes. `>` = value on the right = spaces on the LEFT. Past MCQs offer both paddings as options.',
        },
      ],
    },
    {
      id: 'numbers',
      title: 'Formatting numbers: width.precision',
      blocks: [
        {
          kind: 'p',
          text: 'For floats, the spec `W.Pf` means: total field width W, with exactly P digits after the decimal point, ROUNDED. Numbers right-align by default, so any padding lands on the left.',
        },
        {
          kind: 'code',
          code: '"{0:6.2f}".format(3.14159)   # \'  3.14\'\n"{0:5.3f}".format(1.23456789) # \'1.235\'  (rounded up)\n"{0:.2f}".format(7)          # \'7.00\'   (width optional)',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Count the field like an examiner',
          text: "For '  3.14': the text 3.14 is 4 characters, the width is 6, so 2 spaces pad the left. Width counts EVERYTHING: digits, the decimal point and the sign.",
        },
      ],
    },
    {
      id: 'fstrings',
      title: 'f-strings: formatting inline',
      blocks: [
        {
          kind: 'p',
          text: 'An **f-string** puts the expression straight inside the braces: `f"Hi {name}"`. The same format specs work after a colon: `f"R{amount:.2f}"`. Modern course material and test questions use both styles.',
        },
        {
          kind: 'code',
          code: 'name = "Zola"\nprint(f"Hi {name}")    # Hi Zola\nprint("Hi {name}")     # Hi {name}  ← no f: braces are literal!',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: forgetting the f prefix',
          text: 'Without the f, the string is ordinary text and `{name}` prints exactly as typed. No error, no substitution, which is precisely why it makes such a good exam question.',
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
            '`{0}`, `{1}` pick format() arguments by position; a hole may repeat.',
            '`<`, `>`, `^` align the value left, right or centre inside the given width.',
            '`W.Pf` gives a float P rounded decimals inside a field W wide; numbers right-align by default.',
            'f-strings evaluate expressions in the braces: `f"R{amount:.2f}"`.',
            'Without the f prefix, braces are just characters, so `{name}` prints literally.',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      id: 'ex-align',
      title: 'Reading a positional, centred hole',
      intro: 'One hole, two arguments, a centre-align: every part of the format language in one line.',
      string: ' BB ',
      code: 'print("{1:^4}".format("AA", "BB"))',
      steps: [
        {
          text: 'The 1 before the colon picks argument number 1, counting from zero, that is "BB". "AA" is never used.',
          highlight: [],
          state: 'value: "BB"',
        },
        {
          text: 'The spec ^4 centres the value in a field 4 characters wide. "BB" is 2 wide, leaving 2 spaces to share.',
          highlight: [1, 2],
          state: 'centre in width 4',
        },
        {
          text: 'One space lands on each side: the printed field is space, B, B, space.',
          highlight: [0, 3],
          state: "' BB '",
          output: ' BB ',
        },
      ],
    },
    {
      id: 'ex-float',
      title: 'Width and precision on a float',
      intro: 'The 6.2f spec, decoded digit by digit.',
      string: '  3.14',
      code: 'print("{0:6.2f}".format(3.14159))',
      steps: [
        {
          text: 'The .2f part: keep exactly 2 digits after the decimal point, rounding, so 3.14159 becomes 3.14.',
          highlight: [2, 3, 4, 5],
          state: 'rounded: 3.14',
        },
        {
          text: 'The 6 is the TOTAL width. "3.14" occupies 4 characters (the point counts), so 2 characters of padding are needed.',
          highlight: [],
          state: 'width 6, text 4',
        },
        {
          text: 'Numbers right-align by default, so both padding spaces go on the left.',
          highlight: [0, 1],
          state: "'  3.14'",
          output: '  3.14',
        },
      ],
    },
  ],

  visualizer: null,

  practice: {
    apiModuleId: 'formatting',
    // Endless procedural practice (see PracticeEngine.jsx /
    // formatting_engine.py) instead of the static exercise bank — Exam
    // still draws from the bank via `exam.questionCount` below.
    engine: true,
    exam: { questionCount: 10 },
  },
};
