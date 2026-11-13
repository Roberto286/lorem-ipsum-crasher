import { config, type LevelKey } from '../config';
import { difficultyAt } from './difficulty';
import { pickWord } from './words';

/** Position is polar, relative to the player: the scene turns it into screen coordinates. */
export interface EnemyState {
  id: number;
  /** Remaining words, typed in order: the enemy dies with the last one. */
  words: string[];
  angle: number;
  distance: number;
  speed: number;
}

export type TypeResult =
  | { kind: 'progress' }
  // enemy: the target that got faster, if a word was being typed.
  | { kind: 'error'; enemy?: EnemyState }
  // word: a word was completed but the enemy has more; kill: it was the last one.
  | { kind: 'word' | 'kill'; enemy: EnemyState; word: string };

export interface UpdateResult {
  spawned: EnemyState[];
  reached: EnemyState[];
}

/** Whole game state and rules, free of rendering so it runs in tests. */
export class GameSession {
  enemies: EnemyState[] = [];
  typed = '';
  score = 0;
  lives: number = config.player.lives;
  elapsedMs = 0;
  private untilSpawnMs = 0;
  private nextId = 0;

  constructor(
    private readonly halfWidth: number,
    private readonly halfHeight: number,
    private readonly level: LevelKey,
    private readonly rng: () => number = Math.random,
  ) {}

  get isOver(): boolean {
    return this.lives <= 0;
  }

  /** The enemy the player is typing at: the closest one whose word starts with the buffer. */
  get target(): EnemyState | undefined {
    return this.typed === '' ? undefined : this.matching(this.typed)[0];
  }

  update(deltaMs: number): UpdateResult {
    this.elapsedMs += deltaMs;
    const reached = this.advanceEnemies(deltaMs);
    const spawned = this.spawnIfDue(deltaMs);
    return { spawned, reached };
  }

  typeLetter(letter: string): TypeResult {
    const typed = this.typed + letter;
    const matches = this.matching(typed);
    if (matches.length === 0) {
      const enemy = this.target;
      if (enemy) enemy.speed *= config.enemy.typoSpeedBoost;
      this.typed = '';
      return { kind: 'error', enemy };
    }

    const completed = matches.find((enemy) => enemy.words[0] === typed);
    if (!completed) {
      this.typed = typed;
      return { kind: 'progress' };
    }

    completed.words.shift();
    this.score += typed.length * config.pointsPerLetter;
    this.typed = '';
    if (completed.words.length > 0) return { kind: 'word', enemy: completed, word: typed };
    this.enemies = this.enemies.filter((enemy) => enemy !== completed);
    return { kind: 'kill', enemy: completed, word: typed };
  }

  private matching(prefix: string): EnemyState[] {
    return this.enemies
      .filter((enemy) => enemy.words[0].startsWith(prefix))
      .sort((a, b) => a.distance - b.distance);
  }

  private advanceEnemies(deltaMs: number): EnemyState[] {
    for (const enemy of this.enemies) enemy.distance -= (enemy.speed * deltaMs) / 1000;
    const reached = this.enemies.filter((enemy) => enemy.distance <= config.player.hitRadius);
    if (reached.length === 0) return reached;

    this.enemies = this.enemies.filter((enemy) => !reached.includes(enemy));
    this.lives = Math.max(0, this.lives - reached.length);
    // The half-typed word may have just hit the player: do not leave a buffer nothing matches.
    if (this.matching(this.typed).length === 0) this.typed = '';
    return reached;
  }

  private spawnIfDue(deltaMs: number): EnemyState[] {
    this.untilSpawnMs -= deltaMs;
    if (this.untilSpawnMs > 0) return [];

    const difficulty = difficultyAt(this.elapsedMs / 1000, this.level);
    this.untilSpawnMs += difficulty.spawnIntervalMs;
    const angle = this.rng() * Math.PI * 2;
    const words = this.enemies.flatMap((active) => active.words);
    const wordCount = 1 + Math.floor(this.rng() * difficulty.maxWords);
    const enemy: EnemyState = {
      id: this.nextId++,
      // Each pick joins the list the next one must avoid, the enemy's own words included.
      words: Array.from({ length: wordCount }, () => {
        const word = pickWord(difficulty.maxWordLength, words, this.rng);
        words.push(word);
        return word;
      }),
      angle,
      // Distance from the center to the arena edge along this angle.
      distance: Math.min(
        this.halfWidth / Math.abs(Math.cos(angle)),
        this.halfHeight / Math.abs(Math.sin(angle)),
      ),
      speed: difficulty.enemySpeed,
    };
    this.enemies.push(enemy);
    return [enemy];
  }
}
