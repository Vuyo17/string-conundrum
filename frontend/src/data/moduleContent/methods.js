// Module content: String Length and Built-in Methods — the five core
// methods (count, find, replace, lower, upper), dot notation, and the
// find-vs-count and non-overlap traps from past papers.

export const methodsModule = {
  id: 'methods',
  title: 'String Methods',
  tagline:
    'Strings are objects: they carry their own toolbox. Five methods do most of the work — knowing exactly what each returns is what exams test.',
  minutes: 35,
  level: 'Intermediate',
  prerequisite: 'Looping Through Strings',

  outcomes: [
    'Call methods with dot notation and explain how it differs from functions',
    'Use count(), find(), replace(), lower() and upper() correctly',
    'Predict the output of chained method calls',
    'Avoid the find-vs-count and overlapping-count traps',
  ],

  learnSections: [
    {
      id: 'objects-and-dots',
      title: 'Objects and dot notation',
      blocks: [
        {
          kind: 'p',
          text: 'Every Python string is an **object** — a value that bundles data (the characters) with behaviour (its methods). Functions take the string as a parameter, like `len(s)`; methods are called ON the string with a dot, like `s.lower()`.',
        },
        {
          kind: 'code',
          code: 's = "Howzit"\nlen(s)        # function — string goes in the brackets\ns.lower()     # method  — called on the string with a dot\ns.len()       # AttributeError — len is not a method',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'Method',
          text: 'A function that belongs to an object and is called with dot notation: `object.method(arguments)`. It automatically works on the object it is attached to.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: mixing the two syntaxes',
          text: '`s.len()` and `lower(s)` both fail. If it measures or converts INTO another type, it is usually a function (`len`, `ord`, `int`); if it produces a transformed string, it is usually a method.',
        },
      ],
    },
    {
      id: 'the-five',
      title: 'The five core methods',
      blocks: [
        {
          kind: 'table',
          head: ['Method', 'Returns', 'Example'],
          rows: [
            ['s.count(x)', 'How many non-overlapping times x appears', '"banana".count("an") is 2'],
            ['s.find(x)', 'Index of the FIRST occurrence, or -1', '"banana".find("na") is 2'],
            ['s.replace(a, b)', 'A new string with every a replaced by b', '"aha".replace("a", "o") is "oho"'],
            ['s.lower()', 'A new all-lowercase copy', '"MiXed".lower() is "mixed"'],
            ['s.upper()', 'A new all-uppercase copy', '"MiXed".upper() is "MIXED"'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: find vs count',
          text: '`count()` answers "how many?"; `find()` answers "where is the first one?". Reading `"banana".find("na")` as 2 occurrences (instead of index 2) is a classic wrong MCQ option.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: expecting overlaps to count',
          text: '`"banana".count("ana")` is 1, not 2. After matching at index 1, counting continues AFTER the match — the overlapping "ana" at index 3 is never seen.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'find() returning -1 is a feature',
          text: 'When the search string is absent, `find()` returns -1 instead of crashing. Real programs (and exam answers) test `if s.find(x) != -1:` before using the position.',
        },
      ],
    },
    {
      id: 'chaining',
      title: 'Chaining methods',
      blocks: [
        {
          kind: 'p',
          text: 'Because every method RETURNS a string, calls can be chained: each method runs on the result of the previous one, strictly left to right.',
        },
        {
          kind: 'code',
          code: 'spell = "Alakazam"\nprint(spell.replace("aka", "oo").upper())\n# step 1: replace → "Aloozam"\n# step 2: upper   → "ALOOZAM"',
          caption: 'Note the capital A does not match lowercase "aka" — replace is case-sensitive too.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'How this is examined',
          text: 'The lecture quiz and several past papers use exactly this shape: a replace followed by an upper/lower, with wrong options that apply the calls in the wrong order or ignore case. Resolve one call at a time, writing down each intermediate string.',
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
            'Methods use dot notation (`s.upper()`); functions take the string as a parameter (`len(s)`).',
            '`count()` = how many (non-overlapping); `find()` = index of the first, or -1.',
            '`replace()`, `lower()` and `upper()` all return NEW strings — the original never changes.',
            'Chained calls resolve left to right: work out each intermediate string.',
            'Every method is case-sensitive; normalise with lower() when case should not matter.',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      id: 'ex-chain',
      title: 'Resolving a method chain',
      intro: 'Chained calls are just a pipeline. Trace one link at a time — never both at once.',
      string: 'Alakazam',
      code: 'spell = "Alakazam"\nprint(spell.replace("aka", "oo").upper())',
      steps: [
        {
          text: 'First call: replace("aka", "oo"). Scan for lowercase "aka" — it starts at index 2. The capital A at index 0 cannot start a match.',
          highlight: [2, 3, 4],
          state: 'match at index 2',
        },
        {
          text: 'Those three characters are replaced by "oo", producing the new string "Aloozam". The original "Alakazam" is unchanged.',
          highlight: [],
          state: '"Aloozam"',
        },
        {
          text: 'Second call: .upper() runs on "Aloozam" and returns "ALOOZAM", which print displays.',
          highlight: [],
          state: '"ALOOZAM"',
          output: 'ALOOZAM',
        },
      ],
    },
    {
      id: 'ex-overlap',
      title: 'Why count() misses the overlap',
      intro: 'A three-character search inside "banana" — the result surprises almost everyone once.',
      string: 'banana',
      code: 'print("banana".count("ana"))',
      steps: [
        {
          text: 'The scan starts at index 0. "ban" is not "ana"; at index 1, "ana" matches.',
          highlight: [1, 2, 3],
          state: 'match #1 at index 1',
        },
        {
          text: 'Counting resumes AFTER the whole match — at index 4, not index 2. From index 4 only "na" remains: too short to match.',
          highlight: [4, 5],
          state: 'no further match',
        },
        {
          text: 'Total: 1. The overlapping "ana" starting at index 3 was skipped over, because non-overlapping counting never looks back.',
          highlight: [3, 4, 5],
          state: 'count = 1',
          output: '1',
        },
      ],
    },
  ],

  visualizer: null,

  practice: {
    apiModuleId: 'methods',
    exam: { questionCount: 10 },
  },
};
