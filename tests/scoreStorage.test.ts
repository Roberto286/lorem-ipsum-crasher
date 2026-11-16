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
    const scores = Array.from({ length: count }, (_, index) => (((index * 3) % count) + 1) * 10);

    scores.forEach((score) => saveScore('normal', 'junior', { score, seconds: 1 }));

    const expected = [...scores].sort((a, b) => b - a).slice(0, config.scores.maxEntries);
    expect(loadScores('normal', 'junior').map((entry) => entry.score)).toEqual(expected);
  });

  it('keeps a separate board per level', () => {
    stubStorage();

    saveScore('easy', 'junior', { score: 10, seconds: 2 });

    expect(loadScores('easy', 'junior')).toEqual([{ score: 10, seconds: 2 }]);
    expect(loadScores('hard', 'junior')).toEqual([]);
  });

  it('keeps a separate board per class', () => {
    stubStorage();

    saveScore('normal', 'devops', { score: 10, seconds: 2 });

    expect(loadScores('normal', 'devops')).toEqual([{ score: 10, seconds: 2 }]);
    expect(loadScores('normal', 'dba')).toEqual([]);
    expect(loadScores('normal', 'junior')).toEqual([]);
  });

  it('keeps zero-point runs off the board', () => {
    stubStorage();
    saveScore('normal', 'junior', { score: 10, seconds: 2 });

    expect(saveScore('normal', 'junior', { score: 0, seconds: 19 })).toEqual([
      { score: 10, seconds: 2 },
    ]);
    expect(loadScores('normal', 'junior')).toEqual([{ score: 10, seconds: 2 }]);
  });

  it('ignores corrupt stored data', () => {
    stubStorage('not json');

    expect(loadScores('normal', 'junior')).toEqual([]);
  });

  it('drops malformed entries', () => {
    stubStorage('[{"score":"x","seconds":1},{"score":5,"seconds":3},null]');

    expect(loadScores('normal', 'junior')).toEqual([{ score: 5, seconds: 3 }]);
  });

  it('still returns the new score when storage is unavailable', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });

    expect(saveScore('normal', 'junior', { score: 10, seconds: 2 })).toEqual([
      { score: 10, seconds: 2 },
    ]);
    expect(loadScores('normal', 'junior')).toEqual([]);
  });
});
