import { shuffle } from './exerciseHelpers.js';

export function drawExam(exercises, count, balanceTypes = false) {
  const shuffled = shuffle(exercises);
  if (!balanceTypes) return shuffled.slice(0, count);

  // Take turns between formats so a large MCQ bank cannot crowd out coding,
  // multiple-selection or fill-in questions. Exhausted groups are skipped.
  const groups = new Map();
  for (const exercise of shuffled) {
    if (!groups.has(exercise.type)) groups.set(exercise.type, []);
    groups.get(exercise.type).push(exercise);
  }

  const paper = [];
  const target = Math.min(count, exercises.length);
  while (paper.length < target) {
    for (const group of groups.values()) {
      if (group.length && paper.length < target) paper.push(group.pop());
    }
  }
  return shuffle(paper);
}
