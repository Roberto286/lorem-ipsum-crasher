import { config, type Curve } from '../config';

export interface Difficulty {
  spawnIntervalMs: number;
  enemySpeed: number;
  maxWordLength: number;
}

export function sampleCurve(points: Curve, seconds: number): number {
  // Stop at the last segment even when time is past it, so its slope extrapolates forever.
  let index = points.length - 2;
  while (index > 0 && seconds < points[index][0]) index--;
  const [startTime, startValue] = points[index];
  const [endTime, endValue] = points[index + 1];
  return startValue + ((endValue - startValue) * (seconds - startTime)) / (endTime - startTime);
}

export function difficultyAt(seconds: number): Difficulty {
  const { difficulty } = config;
  return {
    spawnIntervalMs: Math.max(
      difficulty.minSpawnIntervalMs,
      sampleCurve(difficulty.spawnIntervalMs, seconds),
    ),
    enemySpeed: Math.min(difficulty.maxEnemySpeed, sampleCurve(difficulty.enemySpeed, seconds)),
    maxWordLength: Math.round(sampleCurve(difficulty.maxWordLength, seconds)),
  };
}
