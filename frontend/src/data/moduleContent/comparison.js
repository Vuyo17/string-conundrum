// Module content: String Comparison: lexicographic order, case
// sensitivity, and the `in` operator. Exam questions here hinge on Unicode.

export const comparisonModule = {
  id: 'comparison',
  title: 'String Comparison',
  minutes: 20,
  level: 'Beginner',
  prerequisite: 'String Immutability',

  outcomes: [
    'Compare strings with ==, <, > using dictionary order',
    'Explain why comparison is case-sensitive, using ord() values',
    'Use the in operator to test for substrings',
    'Spot the uppercase-before-lowercase trap in exam questions',
  ],

  learnSections: [
    {
      id: 'lexicographic',
      title: 'Dictionary order, letter by letter',
      blocks: [
        {
          kind: 'p',
          text: 'Python compares strings the way a dictionary sorts words: walk both strings together, character by character, and the FIRST difference decides everything. Later characters are never even looked at.',
        },
        {
          kind: 'code',
          code: '"bat" < "man"        # True   (decided at b vs m)\n"apple" < "apricot"  # True   (ap equal, then p < r)\n"app" < "apple"      # True   (a prefix is smaller)',
        },
        {
          kind: 'callout',
          tone: 'define',
          title: 'Lexicographic order',
          text: 'Comparison by the Unicode numbers of corresponding characters, left to right. If one string runs out first and everything so far matched, the shorter string is smaller.',
        },
        {
          kind: 'p',
          text: 'Under the hood, each character comparison is just a comparison of `ord()` values. That single fact explains every "weird" result in this module.',
        },
      ],
    },
    {
      id: 'case-sensitivity',
      title: 'Case matters everywhere',
      blocks: [
        {
          kind: 'p',
          text: 'In Unicode, ALL uppercase letters (65-90) come before ALL lowercase letters (97-122). So `"Cat"` and `"cat"` are different strings, and any lowercase letter is "greater than" any uppercase one.',
        },
        {
          kind: 'table',
          head: ['Expression', 'Result', 'Why'],
          rows: [
            ['"Cat" == "cat"', 'False', 'Different first characters: C (67) vs c (99)'],
            ["'a' > 'Z'", 'True', 'ord("a") is 97; ord("Z") is 90'],
            ['"Zebra" < "apple"', 'True', 'Uppercase Z (90) sorts before lowercase a (97)'],
            ['"10" == 10', 'False', 'A string is never equal to a number'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: "Common mistake: assuming 'a' < 'Z'",
          text: 'Alphabet intuition says a comes before Z, but Unicode says otherwise. `\'a\' > \'Z\'` is True because 97 > 90. This exact comparison style appears in multiple past papers.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Case-insensitive comparison',
          text: 'To compare while ignoring case, normalise both sides first: `a.lower() == b.lower()`. Past exam solutions use exactly this to accept both "n" and "N" from a user.',
        },
      ],
    },
    {
      id: 'in-operator',
      title: 'The in operator: substring testing',
      blocks: [
        {
          kind: 'p',
          text: '`x in s` is True when the string `x` appears somewhere inside `s` as a contiguous run of characters. It is the cleanest membership test Python offers, and it is also case-sensitive.',
        },
        {
          kind: 'code',
          code: '"gram" in "programming"          # True\n"python" in "Python programming" # False (case!)\n"xyz" not in "programming"       # True',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'How this is examined',
          text: 'Past MCQs list several `in` expressions and ask which is True. The wrong options nearly always differ from the right one only by the case of a single letter, so read every character.',
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
            'Strings compare in dictionary order: the first differing character decides.',
            'Every character comparison is an `ord()` comparison underneath.',
            'All UPPERCASE letters sort before all lowercase letters, so `\'a\' > \'Z\'` is True.',
            '`==` between a string and a number is always False, even for `"10"` and 10.',
            '`x in s` tests for a substring, and it is case-sensitive like everything else.',
          ],
        },
      ],
    },
  ],

  examples: [
    {
      id: 'ex-lex',
      title: 'Racing two words to the first difference',
      intro: 'Comparison stops at the first mismatch. Watch how little of each string is actually inspected.',
      string: 'apricot',
      code: 'print("apple" < "apricot")',
      steps: [
        {
          text: 'Compare index 0 of both words: `a` vs `a`. Equal, so keep going.',
          highlight: [0],
          state: 'a == a',
        },
        {
          text: 'Index 1: `p` vs `p`. Still equal.',
          highlight: [1],
          state: 'p == p',
        },
        {
          text: 'Index 2: `p` (112) vs `r` (114). Different! Since 112 < 114, "apple" is smaller. The remaining characters of both words are never examined.',
          highlight: [2],
          state: 'p < r decides',
          output: 'True',
        },
      ],
    },
    {
      id: 'ex-case-trap',
      title: 'The uppercase trap',
      intro: 'A one-character comparison that most students get wrong on first sight.',
      string: 'aZ',
      code: "print('a' > 'Z')",
      steps: [
        {
          text: 'Instinct says: a is the first letter of the alphabet, Z is the last, so surely a < Z?',
          highlight: [],
          state: 'intuition: False?',
        },
        {
          text: "Python compares Unicode numbers: ord('a') is 97 and ord('Z') is 90. All lowercase letters live in a higher band than all uppercase letters.",
          highlight: [0, 1],
          state: '97 vs 90',
        },
        {
          text: '97 > 90, so the expression is True. When in doubt on a comparison question, convert to ord() values.',
          highlight: [0],
          state: 'True',
          output: 'True',
        },
      ],
    },
  ],

  visualizer: null,

  practice: {
    apiModuleId: 'comparison',
    exam: { questionCount: 10 },
  },
};
