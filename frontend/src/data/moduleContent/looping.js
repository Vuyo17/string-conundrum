// Module content: Looping Through Strings: both iteration styles and the
// "first principles" patterns the CSC1015F exams demand (no count()/find()).

export const loopingModule = {
  id: 'looping',
  title: 'Looping Through Strings',
  minutes: 30,
  level: 'Intermediate',
  prerequisite: 'String Comparison',

  outcomes: [
    'Iterate over characters directly with for ch in s',
    'Iterate over positions with for i in range(len(s))',
    'Choose the right style for a given problem',
    'Write the exam-standard first-principles patterns: count, filter, build',
  ],

  learnSections: [
    {
      id: 'two-styles',
      title: 'Two ways to walk a string',
      blocks: [
        {
          kind: 'p',
          text: 'Python offers two loop styles over a string. **By character** hands you each character in turn, simple and clean. **By position** hands you each index, which you use to look characters up, essential when the POSITION matters or you need neighbours.',
        },
        {
          kind: 'code',
          code: 'word = "Hello"\n\n# style 1: by character\nfor ch in word:\n    print(ch * 2, end="")     # HHeelllloo\n\n# style 2: by position\nfor i in range(len(word)):\n    print(word[i] * 2, end="")  # identical output',
          caption: 'Both loops visit every character exactly once, and this doubled-letter example is straight from the course lectures.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: the range is off by one',
          text: '`range(len(word))` is exactly right: it produces 0 up to len - 1. Writing `range(len(word) + 1)` causes an IndexError on the last pass; `range(len(word) - 1)` silently skips the final character.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Which style to choose',
          text: 'Need only the characters? Use `for ch in s`. Need indices, every second character, or a backwards walk? Use `range`, for example `range(len(s)-1, -1, -1)` visits the string in reverse.',
        },
      ],
    },
    {
      id: 'first-principles',
      title: 'The three first-principles patterns',
      blocks: [
        {
          kind: 'p',
          text: 'Nearly every "write a program, and you may NOT use count()/find()/replace()" exam question is one of three patterns, or a combination of them.',
        },
        {
          kind: 'code',
          code: '# 1. COUNT: how many times does target appear?\ncount = 0\nfor ch in text:\n    if ch == target:\n        count += 1',
          caption: 'Counting pattern: an accumulator plus a comparison.',
        },
        {
          kind: 'code',
          code: '# 2. BUILD: construct a new string as you go\nresult = ""\nfor ch in text:\n    if ch in redact:\n        result += "_"\n    else:\n        result += ch',
          caption: 'Building pattern: because strings are immutable, grow a NEW one with +=.',
        },
        {
          kind: 'code',
          code: '# 3. SCAN with position: compare across two strings\nfor i in range(len(guess)):\n    if guess[i] == answer[i]:\n        print("*", end="")\n    else:\n        print("-", end="")',
          caption: 'Position pattern: used in the course\'s Wordle exercise, where letters must line up.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'How this is examined',
          text: 'Past papers ask for: counting occurrences of each letter of one string inside another, redacting letters with "_", reversing a sentence character by character, and capitalising every word, all built from these three patterns.',
        },
      ],
    },
    {
      id: 'while-loops',
      title: 'While loops over strings',
      blocks: [
        {
          kind: 'p',
          text: 'A while loop does the same walk with the index managed by hand. Exams like it because the loop CONDITION is where the traps live.',
        },
        {
          kind: 'code',
          code: 's = "loop"\ni = 0\nwhile i < len(s):\n    print(s[i], end="")\n    i += 1        # forget this line = infinite loop',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Common mistake: a condition that stops early',
          text: '`while i < len(s) - 1` looks harmless but drops the last character. Compare the condition to the set of valid indices (0 to len-1) before answering any predict-the-output question.',
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
            '`for ch in s` visits characters; `for i in range(len(s))` visits positions.',
            '`range(len(s))` covers exactly the valid indices, with no +1 and no -1.',
            'COUNT with an accumulator, BUILD with `result += ...`, SCAN with an index.',
            '"From first principles" means these patterns, not count(), find() or replace().',
            'In while loops, check the condition against the last valid index before predicting output.',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      id: 'ex-count',
      title: 'Counting without count()',
      intro: 'The exam-standard counting pattern, traced on a real word.',
      string: 'beekeeper',
      code: 't = "beekeeper"\nc = 0\nfor ch in t:\n    if ch == \'e\':\n        c += 1\nprint(c)',
      steps: [
        {
          text: 'Start an accumulator at zero, then visit every character of the text in order.',
          highlight: [],
          state: 'c = 0',
        },
        {
          text: "Indices 1 and 2 are both 'e', so the accumulator climbs to 2. The 'b' and 'k' are visited too, but the if statement ignores them.",
          highlight: [1, 2],
          state: 'c = 2',
        },
        {
          text: "The remaining matches sit at indices 4, 5 and 7. Five 'e's in total.",
          highlight: [1, 2, 4, 5, 7],
          state: 'c = 5',
          output: '5',
        },
      ],
    },
    {
      id: 'ex-build',
      title: 'Building a redacted string',
      intro: 'The building pattern: since strings are immutable, grow a new one character by character.',
      string: 'banana',
      code: 'm = "banana"\nr = "an"\nout = ""\nfor ch in m:\n    if ch in r:\n        out += "_"\n    else:\n        out += ch\nprint(out)',
      steps: [
        {
          text: 'out starts empty. The first character `b` is not in "an", so it is kept: out is "b".',
          highlight: [0],
          state: 'out = "b"',
        },
        {
          text: 'Every remaining character is either `a` or `n`, all members of the redact string, so each one appends an underscore instead.',
          highlight: [1, 2, 3, 4, 5],
          state: 'out = "b_____"',
        },
        {
          text: 'The original string is untouched throughout; only the new string was built. This is the immutability-safe way to "edit" text.',
          highlight: [],
          state: 'printed',
          output: 'b_____',
        },
      ],
    },
  ],

  visualizer: {
    type: 'indexing',
    title: 'Loop Walker',
    description:
      'A loop is just a controlled walk through the indices. Pick a string and an index to see the walk a for loop makes to reach it.',
    defaults: { text: 'iteration', index: '8' },
  },

  practice: {
    apiModuleId: 'looping',
    exam: { questionCount: 10 },
  },
};
