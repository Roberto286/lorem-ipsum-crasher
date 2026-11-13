import { config, type LevelKey } from '../config';
import { difficultyAt } from './difficulty';
import { pickWord } from './words';

/** Position is polar, relative to the player: the scene turns it into screen coordinates. */
export interface EnemyState {
  id: number;
  /**
   * Remaining texts, typed in order: the enemy dies with the last one.
   * One word each, or a single space-separated phrase on whole-phrase levels.
   */
  words: string[];
  angle: number;
  distance: number;
  speed: number;
}

export type TypeResult =
  | { kind: 'progress' }
  // A wrong letter that stays in the buffer until it is erased.
  | { kind: 'typo' }
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

  /** Every enemy whose next word starts with the buffer, closest first. */
  get matches(): EnemyState[] {
    return this.typed === '' ? [] : this.matching(this.typed);
  }

  /** The enemy the player is typing at: the closest match. */
  get target(): EnemyState | undefined {
    return this.matches[0];
  }

  update(deltaMs: number): UpdateResult {
    this.elapsedMs += deltaMs;
    const reached = this.advanceEnemies(deltaMs);
    const spawned = this.spawnIfDue(deltaMs);
    return { spawned, reached };
  }

  typeLetter(letter: string): TypeResult {
    // A space only means something inside a phrase: between words it is habit, not a typo.
    if (letter === ' ' && this.typed === '') return { kind: 'progress' };
    const typed = this.typed + letter;
    const matches = this.matching(typed);
    if (matches.length === 0) return this.mistype(typed);

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

  /** Removes the last typed letter; strict levels have nothing to erase. */
  eraseLetter(): void {
    if (this.erasableTypos) this.typed = this.typed.slice(0, -1);
  }

  private get erasableTypos(): boolean {
    return config.levels[this.level].erasableTypos;
  }

  private mistype(typed: string): TypeResult {
    if (this.erasableTypos) {
      if (typed.length <= config.typedBox.maxLetters) this.typed = typed;
      return { kind: 'typo' };
    }
    const enemy = this.target;
    if (enemy) enemy.speed *= config.enemy.typoSpeedBoost;
    this.typed = '';
    return { kind: 'error', enemy };
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
    // The half-typed word may have just hit the player: do not leave its letters behind. A
    // buffer holding a typo matched nobody to begin with, so it stays for the player to fix.
    const wasTyped = reached.some((enemy) => enemy.words[0].startsWith(this.typed));
    if (wasTyped && this.matching(this.typed).length === 0) this.typed = '';
    return reached;
  }

  private spawnIfDue(deltaMs: number): EnemyState[] {
    this.untilSpawnMs -= deltaMs;
    if (this.untilSpawnMs > 0) return [];

    const difficulty = difficultyAt(this.elapsedMs / 1000, this.level);
    this.untilSpawnMs += difficulty.spawnIntervalMs;
    const angle = this.rng() * Math.PI * 2;
    const taken = this.enemies.flatMap((active) => active.words);
    const wordCount = 1 + Math.floor(this.rng() * difficulty.maxWords);
    // Each pick joins the list the next one must avoid, the enemy's own words included.
    const words = Array.from({ length: wordCount }, () => {
      const word = pickWord(difficulty.maxWordLength, taken, this.rng);
      taken.push(word);
      return word;
    });
    const enemy: EnemyState = {
      id: this.nextId++,
      words: config.levels[this.level].wholePhrase ? [words.join(' ')] : words,
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
