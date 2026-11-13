import { config, type Curve, type LevelKey } from '../config';

export interface Difficulty {
  spawnIntervalMs: number;
  enemySpeed: number;
  maxWordLength: number;
  /** Most words a single enemy can carry. */
  maxWords: number;
}

export function sampleCurve(points: Curve, seconds: number): number {
  // Stop at the last segment even when time is past it, so its slope extrapolates forever.
  let index = points.length - 2;
  while (index > 0 && seconds < points[index][0]) index--;
  const [startTime, startValue] = points[index];
  const [endTime, endValue] = points[index + 1];
  return startValue + ((endValue - startValue) * (seconds - startTime)) / (endTime - startTime);
}

/** Time ramps every curve up; the level picked in the menu sets how crowded it gets. */
export function difficultyAt(seconds: number, level: LevelKey): Difficulty {
  const { difficulty } = config;
  const { spawnIntervalScale, maxWordsPerEnemy } = config.levels[level];
  return {
    spawnIntervalMs: Math.max(
      difficulty.minSpawnIntervalMs,
      sampleCurve(difficulty.spawnIntervalMs, seconds) * spawnIntervalScale,
    ),
    enemySpeed: Math.min(difficulty.maxEnemySpeed, sampleCurve(difficulty.enemySpeed, seconds)),
    maxWordLength: Math.round(sampleCurve(difficulty.maxWordLength, seconds)),
    maxWords: maxWordsPerEnemy,
  };
}
