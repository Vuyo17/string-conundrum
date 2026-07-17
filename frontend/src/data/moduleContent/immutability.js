// Module content: String Immutability — strings are read-only; every
// "change" builds a new string. A quiet but persistent exam theme.

export const immutabilityModule = {
  id: 'immutability',
  title: 'String Immutability',
  tagline:
    'Strings cannot be edited — ever. Understanding what that really means explains why methods "don\'t work" and why s = s.upper() does.',
  minutes: 20,
  level: 'Beginner',
  prerequisite: 'String Slicing',

  outcomes: [
    'Explain why s[0] = "x" raises a TypeError',
    'Predict what happens when a method result is thrown away',
    'Rebuild a "changed" string using slicing and concatenation',
    'Trace string variables through function calls correctly',
  ],

  learnSections: [
    {
      id: 'read-only',
      title: 'Strings are carved in stone',
      blocks: [
        {
          kind: 'p',
          text: 'Indexing lets you READ any character, but never WRITE one. A string is **immutable**: once created, its characters are fixed forever, like letters carved into stone. You can carve a new stone, but you cannot edit the old one.',
        },
        {
          kind: 'code',
          code: 's = "cat"\nprint(s[0])   # \'c\' — reading is fine\ns[0] = "b"    # TypeError: \'str\' object does not\n              # support item assignment',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'Immutable',
          text: 'An object whose contents cannot change after it is created. Strings, integers and tuples are immutable; lists are not.',
        },
      ],
    },
    {
      id: 'methods-return-new',
      title: 'Methods return new strings',
      blocks: [
        {
          kind: 'p',
          text: 'If strings cannot change, what do `upper()` and `replace()` do? They build and RETURN a brand-new string. The original survives untouched — so if you ignore the return value, nothing visible happens.',
        },
        {
          kind: 'code',
          code: 's = "cat"\ns.upper()        # returns \'CAT\'... which is thrown away\nprint(s)         # cat\n\ns = s.upper()    # capture the new string by reassigning\nprint(s)         # CAT',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: calling a method and ignoring the result',
          text: 'The single most common immutability trap in tests: a line like `s.upper()` on its own changes nothing. Always ask — where does the returned string GO?',
        },
        {
          kind: 'code',
          code: 's = "cat"\nt = s.replace("c", "b")\nprint(s, t)      # cat bat  — s is unchanged, t holds the copy',
        },
      ],
    },
    {
      id: 'rebuilding',
      title: 'Rebuilding instead of editing',
      blocks: [
        {
          kind: 'p',
          text: 'To "change" one character, build a fresh string from pieces of the old one: slice around the character and concatenate the replacement into the gap, then rebind the variable.',
        },
        {
          kind: 'code',
          code: 's = "cat"\ns = "b" + s[1:]        # \'bat\'  — new first letter\ns = s[:2] + "d"        # \'bad\'  — new last letter',
          caption: 'The variable now points at a NEW string; the old one is discarded.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Why functions cannot modify string parameters',
          text: 'Inside a function, `s = s + "!"` makes the LOCAL name point at a new string. The caller\'s variable still points at the original — a favourite "what is printed?" exam setup.',
        },
        {
          kind: 'code',
          code: 'def extend(s):\n    s = s + "!"      # rebinds the local name only\n\nword = "go"\nextend(word)\nprint(word)          # go  — not \'go!\'',
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
            'Strings are immutable: `s[0] = "x"` always raises TypeError.',
            'Methods like `upper()` and `replace()` return NEW strings — the original is never modified.',
            'A method call whose result is not captured achieves nothing visible.',
            'To "change" a string, rebuild it: `s = "b" + s[1:]`.',
            'Reassigning a string parameter inside a function does not affect the caller\'s variable.',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      id: 'ex-lost-result',
      title: 'The vanishing uppercase',
      intro: 'Trace this test-style snippet carefully — the trap is in what happens to the return value.',
      string: 'cat',
      code: 's = "cat"\ns.upper()\nprint(s)',
      steps: [
        {
          text: '`s` is bound to the three-character string "cat".',
          highlight: [0, 1, 2],
          state: 's = "cat"',
        },
        {
          text: '`s.upper()` builds a brand-new string "CAT" and returns it. But the line does nothing with the returned value, so it is immediately discarded. `s` still points at "cat".',
          highlight: [],
          state: 'returned "CAT" discarded',
        },
        {
          text: 'The print shows the original, unchanged string.',
          highlight: [0, 1, 2],
          state: 's is still "cat"',
          output: 'cat',
        },
      ],
    },
    {
      id: 'ex-rebuild',
      title: 'Changing a letter the legal way',
      intro: 'You cannot assign to s[0], but you can construct the string you want.',
      string: 'mat',
      code: 's = "mat"\ns = "c" + s[1:]\nprint(s)',
      steps: [
        {
          text: 'The goal: turn "mat" into "cat". Direct assignment to s[0] would raise TypeError.',
          highlight: [0],
          state: 'target: "cat"',
        },
        {
          text: '`s[1:]` slices off everything after the first character: "at". Slicing reads, so it is allowed.',
          highlight: [1, 2],
          state: 's[1:] = "at"',
        },
        {
          text: '"c" + "at" builds the new string "cat", and the assignment points s at it. The old "mat" is simply abandoned.',
          highlight: [],
          state: 's = "cat"',
          output: 'cat',
        },
      ],
    },
  ],

  visualizer: {
    type: 'indexing',
    title: 'Read-Only Explorer',
    description:
      'Indexing can reach any character — but only to read it. Explore the boxes, and remember: no expression here could ever change one.',
    defaults: { text: 'immutable', index: '3' },
  },

  practice: {
    apiModuleId: 'immutability',
    exam: { questionCount: 10 },
  },
};
