export const modules = [
  {
    title: "Introduction to Strings",
    desc: "Understand what strings are in Python.",
    progress: 100,
    status: "Completed",
    time: "15 min",
  },
  {
    title: "String Indexing",
    desc: "Access characters using indexes.",
    progress: 100,
    status: "Completed",
    time: "20 min",
  },
  {
    title: "String Slicing",
    desc: "Extract parts of a string using slices.",
    progress: 60,
    status: "In progress",
    time: "25 min",
  },
  {
    title: "String Immutability",
    desc: "See why strings cannot be changed in place.",
    progress: 0,
    status: "Locked",
    time: "25 min",
  },
  {
    title: "String Comparison",
    desc: "Compare strings using operators.",
    progress: 0,
    status: "Locked",
    time: "20 min",
  },
  {
    title: "Looping Through Strings",
    desc: "Iterate over characters in a string.",
    progress: 0,
    status: "Locked",
    time: "30 min",
  },
  {
    title: "String Methods",
    desc: "Explore built-in string methods.",
    progress: 0,
    status: "Locked",
    time: "35 min",
  },
  {
    title: "String Formatting",
    desc: "Format strings in various ways.",
    progress: 0,
    status: "Locked",
    time: "35 min",
  },
];

export const letters = [
  "H",
  "e",
  "l",
  "l",
  "o",
  ",",
  " ",
  "W",
  "o",
  "r",
  "l",
  "d",
  "!",
];
export const positiveIndexes = letters.map((_, i) => i);
export const negativeIndexes = letters.map((_, i) => i - letters.length);
