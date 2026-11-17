import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { difficultyAt, sampleCurve } from '../src/utils/difficulty';

describe('sampleCurve', () => {
  const curve = [
    [0, 0],
    [10, 10],
    [20, 30],
  ] as const;

  it('interpolates linearly between keyframes', () => {
    expect(sampleCurve(curve, 5)).toBe(5);
  });

  it('uses the segment that contains the time', () => {
    expect(sampleCurve(curve, 15)).toBe(20);
  });

  it('continues the last slope past the final keyframe', () => {
    expect(sampleCurve(curve, 30)).toBe(50);
  });
});

describe('difficultyAt', () => {
  const knee = config.difficulty.enemySpeed[1][0];
  const gain = (from: number, to: number) => {
    const a = difficultyAt(from, 'normal');
    const b = difficultyAt(to, 'normal');
    return {
      speed: b.enemySpeed - a.enemySpeed,
      spawnCut: a.spawnIntervalMs - b.spawnIntervalMs,
      wordLength: b.maxWordLength - a.maxWordLength,
      kamikazeChance: b.kamikazeChance - a.kamikazeChance,
    };
  };

  it('ramps up faster after the knee than before it', () => {
    const before = gain(knee - 30, knee);
    const after = gain(knee, knee + 30);

    expect(after.speed).toBeGreaterThan(before.speed);
    expect(after.spawnCut).toBeGreaterThan(before.spawnCut);
    expect(after.wordLength).toBeGreaterThan(before.wordLength);
    expect(after.kamikazeChance).toBeGreaterThan(before.kamikazeChance);
  });

  it('stays within the configured limits in an endless run', () => {
    const late = difficultyAt(100_000, 'easy');

    expect(late.spawnIntervalMs).toBe(config.difficulty.minSpawnIntervalMs);
    expect(late.kamikazeChance).toBe(
      config.difficulty.maxKamikazeChance * config.levels.easy.kamikazeChanceScale,
    );
  });

  it('sends no kamikazes at the start, then more and more of them', () => {
    const chanceAt = (seconds: number) => difficultyAt(seconds, 'normal').kamikazeChance;

    for (const level of ['easy', 'normal', 'hard', 'hell'] as const) {
      expect(difficultyAt(0, level).kamikazeChance).toBe(0);
    }
    expect(chanceAt(knee)).toBeGreaterThan(0);
    expect(chanceAt(knee + 30)).toBeGreaterThan(chanceAt(knee));
  });

  it('sends fewer kamikazes on easy', () => {
    expect(difficultyAt(knee, 'easy').kamikazeChance).toBeLessThan(
      difficultyAt(knee, 'normal').kamikazeChance,
    );
  });

  it('sends no ghosts at the start, none before the basics are learned, then more', () => {
    const chanceAt = (seconds: number) => difficultyAt(seconds, 'normal').ghostChance;
    const [, [kneeSeconds]] = config.difficulty.ghostChance;

    for (const level of ['easy', 'normal', 'hard', 'hell'] as const) {
      expect(difficultyAt(0, level).ghostChance).toBe(0);
    }
    expect(chanceAt(30)).toBe(0);
    expect(chanceAt(60)).toBeGreaterThan(0);
    expect(chanceAt(kneeSeconds)).toBeGreaterThan(chanceAt(60));
    expect(difficultyAt(100_000, 'easy').ghostChance).toBe(
      config.difficulty.maxGhostChance * config.levels.easy.ghostChanceScale,
    );
  });

  it('returns whole word lengths', () => {
    expect(Number.isInteger(difficultyAt(37, 'normal').maxWordLength)).toBe(true);
  });

  it('sends more enemies with more words on harder levels', () => {
    const [easy, normal, hard] = (['easy', 'normal', 'hard'] as const).map((level) =>
      difficultyAt(30, level),
    );

    expect(normal.spawnIntervalMs).toBeLessThan(easy.spawnIntervalMs);
    expect(hard.spawnIntervalMs).toBeLessThan(normal.spawnIntervalMs);
    expect(normal.maxWords).toBeGreaterThan(easy.maxWords);
    expect(hard.maxWords).toBe(3);
  });

  it('gives spells to no demons at the start, then more of them, up to a cap', () => {
    const chanceAt = (seconds: number) => difficultyAt(seconds, 'normal').spellChance;

    expect(chanceAt(0)).toBe(0);
    expect(chanceAt(knee)).toBeGreaterThan(0);
    expect(chanceAt(knee + 30)).toBeGreaterThan(chanceAt(knee));
    expect(chanceAt(100_000)).toBe(config.difficulty.maxSpellChance);
  });
});
