/**
 * Creates a participant-facing Google Form for first-year UCT evaluation testing.
 *
 * Focus: collect stronger evidence for the paper on
 * - conceptual understanding (objective quiz)
 * - perceived learning/confidence shifts
 * - usefulness of backend-driven features (visualiser, targeted feedback, practice)
 * - usability and friction points
 *
 * Run createUCTFirstYearEvaluationForm() once in Google Apps Script.
 */
function createUCTFirstYearEvaluationForm() {
  var form = FormApp.create('UCT First-Year Evaluation - String Conundrum');
  form.setDescription(
    'University of Cape Town - Department of Computer Science\n\n' +
    'This form is for first-year computer science students evaluating String Conundrum. ' +
    'Please answer honestly. Your responses are used for research and system improvement.\n\n' +
    'Estimated completion time: 12-15 minutes.'
  );

  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setShuffleQuestions(false);
  form.setIsQuiz(true);

  var scale5 = ['1', '2', '3', '4', '5'];
  var agree5 = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
  var confidenceRows = [
    'String indexing',
    'String slicing',
    'String immutability',
    'String comparison',
    'Tracing code step-by-step'
  ];

  // ---------------------------------------------------------------------------
  // Section 1: Session and participant context
  // ---------------------------------------------------------------------------
  form.addSectionHeaderItem()
    .setTitle('Section 1 - Participant Information')
    .setHelpText('No unnecessary personally identifying information should be entered.');

  form.addTextItem()
    .setTitle('Participant code')
    .setHelpText('Example: FY-01')
    .setRequired(true);

  form.addDateItem()
    .setTitle('Date')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Are you currently a first-year student at UCT?')
    .setChoiceValues(['Yes', 'No'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How much Python experience do you have?')
    .setChoiceValues([
      'A little (basic class exposure)',
      'Some (class plus practice)',
      'A lot (projects or extended practice)'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Which module(s) did you complete in this session?')
    .setChoiceValues([
      'Introduction to Strings only',
      'String Immutability only',
      'Both Introduction and Immutability',
      'Other / additional modules'
    ])
    .setRequired(true);

  // ---------------------------------------------------------------------------
  // Section 2: Confidence (before/after)
  // ---------------------------------------------------------------------------
  form.addPageBreakItem().setTitle('Section 2 - Confidence Before and After');

  form.addGridItem()
    .setTitle('Before this session, how confident were you in each concept?')
    .setHelpText('1 = not confident at all, 5 = very confident')
    .setRows(confidenceRows)
    .setColumns(scale5)
    .setRequired(true);

  form.addGridItem()
    .setTitle('After this session, how confident are you in each concept?')
    .setHelpText('1 = not confident at all, 5 = very confident')
    .setRows(confidenceRows)
    .setColumns(scale5)
    .setRequired(true);

  form.addScaleItem()
    .setTitle('How mentally demanding was this session?')
    .setBounds(1, 9)
    .setLabels('Very low effort', 'Very high effort')
    .setRequired(true);

  // ---------------------------------------------------------------------------
  // Section 3: Feature usefulness (paper-relevant)
  // ---------------------------------------------------------------------------
  form.addPageBreakItem().setTitle('Section 3 - Feature Usefulness and Learning Support');

  form.addGridItem()
    .setTitle('Rate your agreement with the statements below')
    .setRows([
      'The step-by-step visualiser made code behaviour easier to understand.',
      'Seeing highlighted indices/slices helped me reason about string operations.',
      'The feedback after wrong answers helped me correct misconceptions.',
      'Practice questions felt relevant to what I was struggling with.',
      'The tool helped me distinguish between changing a value and reassigning a variable.',
      'The isiXhosa translation support made the content easier to understand.',
      'The isiXhosa transpiler (isiXhosa keywords converted to Python) worked as I expected.',
      'The Code Space section helped me experiment and learn effectively.',
      'Challenges were useful for testing my understanding.',
      'The leaderboard increased my motivation to practise.'
    ])
    .setColumns(agree5)
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Which parts of the platform did you use in this session? (select all that apply)')
    .setChoiceValues([
      'Practice questions',
      'Code Space',
      'Challenges',
      'Leaderboard',
      'isiXhosa translation mode',
      'isiXhosa transpiler (writing code with isiXhosa keywords)',
      'None of the above'
    ]);

  form.addMultipleChoiceItem()
    .setTitle('Which feature helped you the most?')
    .setChoiceValues([
      'Visualiser',
      'Practice questions',
      'Code Space',
      'Challenges',
      'Leaderboard',
      'isiXhosa translation',
      'isiXhosa transpiler',
      'Feedback/explanations',
      'Worked examples',
      'None of the above'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Which issues did you experience? (select all that apply)')
    .setChoiceValues([
      'I was unsure what to do next at some point',
      'Navigation was confusing',
      'Feedback was unclear',
      'I clicked an option but the result display was confusing',
      'I did not trust whether my answer was graded correctly',
      'isiXhosa translation terms were unclear or inconsistent',
      'isiXhosa transpiler behaviour was confusing',
      'Challenges felt too difficult or unclear',
      'Leaderboard was unclear or not useful',
      'Code Space was confusing to use',
      'The session felt too long',
      'No major issues'
    ]);

  form.addParagraphTextItem()
    .setTitle('If something was confusing, describe the exact step and what you expected to happen.');

  // ---------------------------------------------------------------------------
  // Section 4: Applied knowledge check (auto-graded)
  // ---------------------------------------------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 4 - Applied Knowledge Check')
    .setHelpText('Answer from your own understanding. This section is auto-scored.');

  var q1 = form.addMultipleChoiceItem();
  q1.setTitle('Q1. What is the output?\nword = "Python"\nprint(word[1])')
    .setChoices([
      q1.createChoice('y', true),
      q1.createChoice('P', false),
      q1.createChoice('t', false),
      q1.createChoice('th', false)
    ])
    .setRequired(true)
    .setPoints(1)
    .setFeedbackForIncorrect(FormApp.createFeedback().setText('Index 1 refers to the second character.').build());

  var q2 = form.addMultipleChoiceItem();
  q2.setTitle('Q2. What is the output?\nword = "Python"\nprint(word[1:4])')
    .setChoices([
      q2.createChoice('yth', true),
      q2.createChoice('ytho', false),
      q2.createChoice('Pyt', false),
      q2.createChoice('thon', false)
    ])
    .setRequired(true)
    .setPoints(1)
    .setFeedbackForIncorrect(FormApp.createFeedback().setText('Slice stop index is exclusive.').build());

  var q3 = form.addMultipleChoiceItem();
  q3.setTitle('Q3. What happens here?\nword = "Python"\nword[0] = "J"')
    .setChoices([
      q3.createChoice('It raises a TypeError because strings are immutable.', true),
      q3.createChoice('word becomes "Jython".', false),
      q3.createChoice('Nothing changes and no error is raised.', false),
      q3.createChoice('It raises an IndexError.', false)
    ])
    .setRequired(true)
    .setPoints(1)
    .setFeedbackForIncorrect(FormApp.createFeedback().setText('String characters cannot be changed in place.').build());

  var q4 = form.addMultipleChoiceItem();
  q4.setTitle('Q4. What is printed?\ntext = "hello"\nprint(text.upper())\nprint(text)')
    .setChoices([
      q4.createChoice('HELLO then hello', true),
      q4.createChoice('HELLO then HELLO', false),
      q4.createChoice('hello then hello', false),
      q4.createChoice('TypeError', false)
    ])
    .setRequired(true)
    .setPoints(1)
    .setFeedbackForIncorrect(FormApp.createFeedback().setText('upper() returns a new string; it does not mutate the original.').build());

  var q5 = form.addMultipleChoiceItem();
  q5.setTitle('Q5. What is the output?\nfirst = "hello"\nsecond = "Hello"\nprint(first == second)')
    .setChoices([
      q5.createChoice('False', true),
      q5.createChoice('True', false),
      q5.createChoice('None', false),
      q5.createChoice('TypeError', false)
    ])
    .setRequired(true)
    .setPoints(1);

  // ---------------------------------------------------------------------------
  // Section 5: SUS (for comparability with prior runs)
  // ---------------------------------------------------------------------------
  form.addPageBreakItem().setTitle('Section 5 - System Usability Scale (SUS)');

  form.addGridItem()
    .setTitle('System Usability Scale - select one response per statement')
    .setRows([
      'I think that I would like to use this tool frequently.',
      'I found the tool unnecessarily complex.',
      'I thought the tool was easy to use.',
      'I think that I would need support from a technical person to use this tool.',
      'I found the various functions in this tool were well integrated.',
      'I thought there was too much inconsistency in this tool.',
      'I would imagine that most people would learn to use this tool very quickly.',
      'I found the tool very cumbersome to use.',
      'I felt very confident using the tool.',
      'I needed to learn a lot of things before I could get going with this tool.'
    ])
    .setColumns(scale5)
    .setRequired(true);

  // ---------------------------------------------------------------------------
  // Section 6: Open responses
  // ---------------------------------------------------------------------------
  form.addPageBreakItem().setTitle('Section 6 - Open Feedback');

  form.addParagraphTextItem()
    .setTitle('What part of String Conundrum helped your learning the most, and why?')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What one change would most improve the tool for first-year students?')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Any additional comments for the researchers?');

  form.setConfirmationMessage('Thank you for participating. Your response has been recorded.');

  Logger.log('Edit URL: ' + form.getEditUrl());
  Logger.log('Live form URL: ' + form.getPublishedUrl());
  return form;
}
