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
    const a = difficultyAt(from);
    const b = difficultyAt(to);
    return {
      speed: b.enemySpeed - a.enemySpeed,
      spawnCut: a.spawnIntervalMs - b.spawnIntervalMs,
      wordLength: b.maxWordLength - a.maxWordLength,
    };
  };

  it('ramps up faster after the knee than before it', () => {
    const before = gain(knee - 30, knee);
    const after = gain(knee, knee + 30);

    expect(after.speed).toBeGreaterThan(before.speed);
    expect(after.spawnCut).toBeGreaterThan(before.spawnCut);
    expect(after.wordLength).toBeGreaterThan(before.wordLength);
  });

  it('stays within the configured limits in an endless run', () => {
    const late = difficultyAt(100_000);

    expect(late.spawnIntervalMs).toBe(config.difficulty.minSpawnIntervalMs);
    expect(late.enemySpeed).toBe(config.difficulty.maxEnemySpeed);
  });

  it('returns whole word lengths', () => {
    expect(Number.isInteger(difficultyAt(37).maxWordLength)).toBe(true);
  });
});
