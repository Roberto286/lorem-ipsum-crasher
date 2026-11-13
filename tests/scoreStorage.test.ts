import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { loadScores, saveScore } from '../src/utils/scoreStorage';

/** With `stored`, every board reads that raw value: handy to seed corrupt data. */
function stubStorage(stored?: string) {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored ?? data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('score storage', () => {
  it('keeps only the best scores, highest first', () => {
    stubStorage();
    const count = config.scores.maxEntries + 2;
    const scores = Array.from({ length: count }, (_, index) => ((index * 7) % count) * 10);

    scores.forEach((score) => saveScore('normal', { score, seconds: 1 }));

    const expected = [...scores].sort((a, b) => b - a).slice(0, config.scores.maxEntries);
    expect(loadScores('normal').map((entry) => entry.score)).toEqual(expected);
  });

  it('keeps a separate board per level', () => {
    stubStorage();

    saveScore('easy', { score: 10, seconds: 2 });

    expect(loadScores('easy')).toEqual([{ score: 10, seconds: 2 }]);
    expect(loadScores('hard')).toEqual([]);
  });

  it('ignores corrupt stored data', () => {
    stubStorage('not json');

    expect(loadScores('normal')).toEqual([]);
  });

  it('drops malformed entries', () => {
    stubStorage('[{"score":"x","seconds":1},{"score":5,"seconds":3},null]');

    expect(loadScores('normal')).toEqual([{ score: 5, seconds: 3 }]);
  });

  it('still returns the new score when storage is unavailable', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });

    expect(saveScore('normal', { score: 10, seconds: 2 })).toEqual([{ score: 10, seconds: 2 }]);
    expect(loadScores('normal')).toEqual([]);
  });
});
