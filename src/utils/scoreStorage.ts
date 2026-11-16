import { config, type ClassKey, type LevelKey } from '../config';

export interface ScoreEntry {
  score: number;
  seconds: number;
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  const entry = value as ScoreEntry | null;
  return typeof entry?.score === 'number' && typeof entry.seconds === 'number';
}

/** One board per level and class: scores from different levels or classes do not compare. */
function boardKey(level: LevelKey, heroClass: ClassKey): string {
  return `${config.scores.storageKey}.${level}.${heroClass}`;
}

export function loadScores(level: LevelKey, heroClass: ClassKey): ScoreEntry[] {
  try {
    const stored = localStorage.getItem(boardKey(level, heroClass));
    const parsed: unknown = JSON.parse(stored ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isScoreEntry) : [];
  } catch {
    // Blocked storage or corrupt data: play on with an empty board.
    return [];
  }
}

export function saveScore(level: LevelKey, heroClass: ClassKey, entry: ScoreEntry): ScoreEntry[] {
  if (entry.score <= 0) return loadScores(level, heroClass);
  const scores = [...loadScores(level, heroClass), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, config.scores.maxEntries);
  try {
    localStorage.setItem(boardKey(level, heroClass), JSON.stringify(scores));
  } catch {
    // Storage full or blocked: the caller still gets the list for this session.
  }
  return scores;
}
