import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { loremWords, pickWord } from '../src/utils/words';

/** Runs a pick with 100 evenly spread rng values to cover the whole candidate pool. */
const sweep = (pick: (rng: () => number) => string) =>
  Array.from({ length: 100 }, (_, index) => pick(() => index / 100));

describe('loremWords', () => {
  it('holds unique lowercase words the player can type with letter keys', () => {
    expect(new Set(loremWords).size).toBe(loremWords.length);
    expect(loremWords.every((word) => /^[a-z]+$/.test(word))).toBe(true);
  });
});

describe('pickWord', () => {
  it('keeps the length between max minus spread and max', () => {
    const lengths = sweep((rng) => pickWord(8, [], rng)).map((word) => word.length);

    expect(Math.max(...lengths)).toBeLessThanOrEqual(8);
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(8 - config.words.lengthSpread);
  });

  it('returns a word for any requested length', () => {
    for (let maxLength = 0; maxLength <= 30; maxLength++) {
      expect(loremWords).toContain(pickWord(maxLength, [], () => 0.5));
    }
  });

  it('avoids words that share a prefix with a word on screen', () => {
    const picks = sweep((rng) => pickWord(6, ['dolore'], rng));

    expect(picks).not.toContain('do');
    expect(picks).not.toContain('dolor');
    expect(picks).not.toContain('dolore');
  });

  it('falls back to a conflicting word when every candidate conflicts', () => {
    expect(loremWords).toContain(pickWord(6, loremWords, () => 0.5));
  });
});
