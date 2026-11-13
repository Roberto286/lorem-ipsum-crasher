import { config, type LevelKey } from '../config';

export interface ScoreEntry {
  score: number;
  seconds: number;
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  const entry = value as ScoreEntry | null;
  return typeof entry?.score === 'number' && typeof entry.seconds === 'number';
}

/** One board per level: scores from different levels do not compare. */
export function loadScores(level: LevelKey): ScoreEntry[] {
  try {
    const stored = localStorage.getItem(`${config.scores.storageKey}.${level}`);
    const parsed: unknown = JSON.parse(stored ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isScoreEntry) : [];
  } catch {
    // Blocked storage or corrupt data: play on with an empty board.
    return [];
  }
}

export function saveScore(level: LevelKey, entry: ScoreEntry): ScoreEntry[] {
  if (entry.score <= 0) return loadScores(level);
  const scores = [...loadScores(level), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, config.scores.maxEntries);
  try {
    localStorage.setItem(`${config.scores.storageKey}.${level}`, JSON.stringify(scores));
  } catch {
    // Storage full or blocked: the caller still gets the list for this session.
  }
  return scores;
}
