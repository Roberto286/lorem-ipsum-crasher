import { config } from '../config';
import { difficultyAt } from './difficulty';
import { pickWord } from './words';

/** Position is polar, relative to the player: the scene turns it into screen coordinates. */
export interface EnemyState {
  id: number;
  word: string;
  angle: number;
  distance: number;
  speed: number;
}

export type TypeResult = { kind: 'progress' | 'error' } | { kind: 'kill'; enemy: EnemyState };

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
    private readonly rng: () => number = Math.random,
  ) {}

  get isOver(): boolean {
    return this.lives <= 0;
  }

  update(deltaMs: number): UpdateResult {
    this.elapsedMs += deltaMs;
    const reached = this.advanceEnemies(deltaMs);
    const spawned = this.spawnIfDue(deltaMs);
    return { spawned, reached };
  }

  typeLetter(letter: string): TypeResult {
    const typed = this.typed + letter;
    const matches = this.enemies.filter((enemy) => enemy.word.startsWith(typed));
    if (matches.length === 0) {
      this.typed = '';
      return { kind: 'error' };
    }

    const [target] = matches
      .filter((enemy) => enemy.word === typed)
      .sort((a, b) => a.distance - b.distance);
    if (!target) {
      this.typed = typed;
      return { kind: 'progress' };
    }

    this.enemies = this.enemies.filter((enemy) => enemy !== target);
    this.score += target.word.length * config.pointsPerLetter;
    this.typed = '';
    return { kind: 'kill', enemy: target };
  }

  private advanceEnemies(deltaMs: number): EnemyState[] {
    for (const enemy of this.enemies) enemy.distance -= (enemy.speed * deltaMs) / 1000;
    const reached = this.enemies.filter((enemy) => enemy.distance <= config.player.hitRadius);
    if (reached.length === 0) return reached;

    this.enemies = this.enemies.filter((enemy) => !reached.includes(enemy));
    this.lives = Math.max(0, this.lives - reached.length);
    // The half-typed word may have just hit the player: do not leave a buffer nothing matches.
    if (!this.enemies.some((enemy) => enemy.word.startsWith(this.typed))) this.typed = '';
    return reached;
  }

  private spawnIfDue(deltaMs: number): EnemyState[] {
    this.untilSpawnMs -= deltaMs;
    if (this.untilSpawnMs > 0) return [];

    const difficulty = difficultyAt(this.elapsedMs / 1000);
    this.untilSpawnMs += difficulty.spawnIntervalMs;
    const angle = this.rng() * Math.PI * 2;
    const enemy: EnemyState = {
      id: this.nextId++,
      word: pickWord(
        difficulty.maxWordLength,
        this.enemies.map((active) => active.word),
        this.rng,
      ),
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
