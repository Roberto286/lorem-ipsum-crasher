import { config } from '../config';

const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

export const loremWords = [...new Set(loremIpsum.toLowerCase().match(/[a-z]+/g))];

const wordLengths = loremWords.map((word) => word.length);
const shortestLength = Math.min(...wordLengths);
const longestLength = Math.max(...wordLengths);

export function pickWord(maxLength: number, activeWords: string[], rng = Math.random): string {
  const max = Math.min(Math.max(maxLength, shortestLength), longestLength);
  const candidates = loremWords.filter(
    (word) => word.length <= max && word.length >= max - config.words.lengthSpread,
  );
  // A word that is a prefix of another on screen (or the reverse) would be killed by accident.
  const free = candidates.filter(
    (word) => !activeWords.some((active) => active.startsWith(word) || word.startsWith(active)),
  );
  const pool = free.length > 0 ? free : candidates;
  return pool[Math.floor(rng() * pool.length)];
}
