import { config } from '../config';

export interface ScoreEntry {
  score: number;
  seconds: number;
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  const entry = value as ScoreEntry | null;
  return typeof entry?.score === 'number' && typeof entry.seconds === 'number';
}

export function loadScores(): ScoreEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(config.scores.storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isScoreEntry) : [];
  } catch {
    // Blocked storage or corrupt data: play on with an empty board.
    return [];
  }
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const scores = [...loadScores(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, config.scores.maxEntries);
  try {
    localStorage.setItem(config.scores.storageKey, JSON.stringify(scores));
  } catch {
    // Storage full or blocked: the caller still gets the list for this session.
  }
  return scores;
}
