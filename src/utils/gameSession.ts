import { config, type EnemyType, type LevelKey, type SpellKey } from '../config';
import { difficultyAt } from './difficulty';
import { pickWord } from './words';

/** Position is polar, relative to the player: the scene turns it into screen coordinates. */
export interface EnemyState {
  id: number;
  type: EnemyType;
  /**
   * Remaining texts, typed in order: the enemy dies with the last one.
   * One word each, or space-separated phrases on whole-phrase levels.
   */
  words: string[];
  angle: number;
  distance: number;
  speed: number;
  /** Cast when the enemy is killed by typing; lost if it reaches the player. */
  spell?: CarriedSpell;
}

/** What a spell did, for the scene to show. */
export type Cast =
  // healed: lives actually gained, 0 when they were full.
  { spell: 'patch'; healed: number } | { spell: 'freeze' } | { spell: 'firewall' };

export type TypeResult =
  | { kind: 'progress' }
  // A wrong letter that stays in the buffer until it is erased.
  | { kind: 'typo' }
  // enemy: the target that got faster, if a word was being typed.
  | { kind: 'error'; enemy?: EnemyState }
  // A word was completed but the enemy has more.
  | { kind: 'word'; enemy: EnemyState; word: string }
  // It was the last one. cast: the spell of a carrier, already applied.
  | { kind: 'kill'; enemy: EnemyState; word: string; cast?: Cast };

export interface UpdateResult {
  spawned: EnemyState[];
  reached: EnemyState[];
  // Demons the firewall absorbed: they are in reached too.
  blocked: number;
}

/** The spells a demon can carry: the keys of config.spells that have a weight. */
export type CarriedSpell = {
  [K in SpellKey]: (typeof config.spells)[K] extends { weight: number } ? K : never;
}[SpellKey];

const carriedSpells = (Object.keys(config.spells) as SpellKey[]).filter(
  (spell): spell is CarriedSpell => 'weight' in config.spells[spell],
);

/** The spell at `roll` (0 to 1) along the configured weights. */
function spellAt(roll: number): CarriedSpell {
  const total = carriedSpells.reduce((sum, spell) => sum + config.spells[spell].weight, 0);
  let left = roll * total;
  return (
    carriedSpells.find((spell) => (left -= config.spells[spell].weight) < 0) ?? carriedSpells[0]
  );
}

/** Whole game state and rules, free of rendering so it runs in tests. */
export class GameSession {
  enemies: EnemyState[] = [];
  typed = '';
  score = 0;
  /** Score multiplier, from 1 up to config.combo.maxMultiplier. */
  multiplier = 1;
  /** Perfect words toward the next multiplier level. */
  streak = 0;
  /** Demons the firewall still absorbs, one per point. */
  shield = 0;
  // A wrong letter was typed since the last completed word, so that word cannot be perfect.
  private wordFlawed = false;
  // Milliseconds left of a freeze: while it lasts no demon moves.
  private frozenMs = 0;
  lives: number = config.player.lives;
  elapsedMs = 0;
  private untilSpawnMs = 0;
  private untilTankMs: number = config.difficulty.tankSpawnSeconds.first * 1000;
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
    const { reached, blocked } = this.advanceEnemies(deltaMs);
    const spawned = [...this.spawnIfDue(deltaMs), ...this.spawnTankIfDue(deltaMs)];
    return { spawned, reached, blocked };
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
    // A drop rewards a clean kill: read the flaw before countWord() clears it.
    const clean = !this.wordFlawed;
    this.score += typed.length * config.pointsPerLetter * this.multiplier;
    this.countWord();
    this.typed = '';
    if (completed.words.length > 0) return { kind: 'word', enemy: completed, word: typed };
    this.enemies = this.enemies.filter((enemy) => enemy !== completed);
    const cast = completed.spell && clean ? this.cast(completed.spell) : undefined;
    return { kind: 'kill', enemy: completed, word: typed, cast };
  }

  /** No demon moves while a freeze lasts. */
  get frozen(): boolean {
    return this.frozenMs > 0;
  }

  /**
   * Casts a spell at once, whoever asks: a carrier that was just killed, or the hero. Spells
   * score no combo points and leave the multiplier and the streak alone.
   */
  cast(spell: SpellKey): Cast {
    switch (spell) {
      case 'patch':
        return this.heal(config.spells.patch.lives);
      case 'freeze':
        // A second freeze restarts the timer instead of adding to it.
        this.frozenMs = config.spells.freeze.seconds * 1000;
        return { spell: 'freeze' };
      case 'firewall':
        // A second firewall does not stack: it sets the shield back to hits.
        this.shield = config.spells.firewall.hits;
        return { spell: 'firewall' };
    }
  }

  private heal(lives: number): Cast {
    const healed = Math.min(lives, config.player.lives - this.lives);
    this.lives += healed;
    return { spell: 'patch', healed };
  }

  /** Removes the last typed letter; strict levels have nothing to erase. */
  eraseLetter(): void {
    if (this.erasableTypos) this.typed = this.typed.slice(0, -1);
  }

  private get erasableTypos(): boolean {
    return config.levels[this.level].erasableTypos;
  }

  private mistype(typed: string): TypeResult {
    this.recordWrongLetter();
    if (this.erasableTypos) {
      if (typed.length <= config.typedBox.maxLetters) this.typed = typed;
      return { kind: 'typo' };
    }
    const enemy = this.target;
    if (enemy) enemy.speed *= config.enemy.typoSpeedBoost;
    this.typed = '';
    return { kind: 'error', enemy };
  }

  /** Completes a word: a perfect one (no wrong letter since the last word) advances the streak. */
  private countWord(): void {
    if (!this.wordFlawed && this.multiplier < config.combo.maxMultiplier) {
      this.streak += 1;
      if (this.streak >= config.combo.perfectWordsPerLevel) {
        this.multiplier += 1;
        this.streak = 0;
      }
    }
    this.wordFlawed = false;
  }

  /** A wrong letter: erasable levels drop one level once per word, hell breaks the combo to x1. */
  private recordWrongLetter(): void {
    if (!this.erasableTypos) this.multiplier = 1;
    else if (!this.wordFlawed) this.multiplier = Math.max(1, this.multiplier - 1);
    this.wordFlawed = true;
    this.streak = 0;
  }

  private matching(prefix: string): EnemyState[] {
    return this.enemies
      .filter((enemy) => enemy.words[0].startsWith(prefix))
      .sort((a, b) => a.distance - b.distance);
  }

  private advanceEnemies(deltaMs: number): { reached: EnemyState[]; blocked: number } {
    const movingMs = Math.max(0, deltaMs - this.frozenMs);
    this.frozenMs = Math.max(0, this.frozenMs - deltaMs);
    for (const enemy of this.enemies) enemy.distance -= (enemy.speed * movingMs) / 1000;
    const reached = this.enemies.filter((enemy) => enemy.distance <= config.player.hitRadius);
    if (reached.length === 0) return { reached, blocked: 0 };

    this.enemies = this.enemies.filter((enemy) => !reached.includes(enemy));
    // The shield takes whole demons, one per point, in the order they reached the hero.
    const blocked = Math.min(this.shield, reached.length);
    this.shield -= blocked;
    const hitting = reached.slice(blocked);
    if (hitting.length > 0) {
      const damage = hitting.reduce((sum, enemy) => sum + config.enemyTypes[enemy.type].damage, 0);
      this.lives = Math.max(0, this.lives - damage);
      // Losing a life starts the combo over.
      this.multiplier = 1;
      this.streak = 0;
    }
    // The half-typed word may have just hit the player: do not leave its letters behind. A
    // buffer holding a typo matched nobody to begin with, so it stays for the player to fix.
    const wasTyped = reached.some((enemy) => enemy.words[0].startsWith(this.typed));
    if (wasTyped && this.matching(this.typed).length === 0) this.typed = '';
    return { reached, blocked };
  }

  private spawnIfDue(deltaMs: number): EnemyState[] {
    this.untilSpawnMs -= deltaMs;
    if (this.untilSpawnMs > 0) return [];

    const difficulty = difficultyAt(this.elapsedMs / 1000, this.level);
    this.untilSpawnMs += difficulty.spawnIntervalMs;
    const { kamikazeChance, spellChance, enemySpeed } = difficulty;
    if (this.rng() < kamikazeChance) {
      const word = this.pickWords(1, config.enemyTypes.kamikaze.maxWordLength);
      return [this.spawn('kamikaze', this.sideAngle(), word, enemySpeed, spellChance)];
    }
    const angle = this.rng() * Math.PI * 2;
    const wordCount = 1 + Math.floor(this.rng() * difficulty.maxWords);
    const words = this.pickWords(wordCount, difficulty.maxWordLength);
    return [this.spawn('grunt', angle, this.phrases(words, wordCount), enemySpeed, spellChance)];
  }

  /** The miniboss comes on its own clock, whatever the spawn interval and the rng say. */
  private spawnTankIfDue(deltaMs: number): EnemyState[] {
    this.untilTankMs -= deltaMs;
    if (this.untilTankMs > 0) return [];

    const { minWords, maxWords, phraseWords, maxWordLength } = config.enemyTypes.tank;
    const difficulty = difficultyAt(this.elapsedMs / 1000, this.level);
    this.untilTankMs += config.difficulty.tankSpawnSeconds.every * 1000;
    const wordCount = minWords + Math.floor(this.rng() * (maxWords - minWords + 1));
    const words = this.pickWords(wordCount, Math.min(difficulty.maxWordLength, maxWordLength));
    // Short phrases: all its words in one would be too long to type in a single go.
    const texts = this.phrases(words, phraseWords);
    // The miniboss always carries a spell: a roll is always under a chance of 1.
    const { enemySpeed } = difficulty;
    return [this.spawn('tank', this.sideAngle(), texts, enemySpeed, 1)];
  }

  /** The texts to type: the words as they are, or joined `size` at a time on phrase levels. */
  private phrases(words: string[], size: number): string[] {
    if (!config.levels[this.level].wholePhrase) return words;
    const phrases: string[] = [];
    for (let start = 0; start < words.length; start += size) {
      phrases.push(words.slice(start, start + size).join(' '));
    }
    return phrases;
  }

  /** Words clear of prefix collisions with everything on screen and with each other. */
  private pickWords(count: number, maxLength: number): string[] {
    const taken = this.enemies.flatMap((active) => active.words);
    // Each pick joins the list the next one must avoid, the enemy's own words included.
    return Array.from({ length: count }, () => {
      const word = pickWord(maxLength, taken, this.rng);
      taken.push(word);
      return word;
    });
  }

  /** An angle whose ray leaves the arena through the left or right edge. */
  private sideAngle(): number {
    const side = this.rng() < 0.5 ? 1 : -1;
    const y = (this.rng() * 2 - 1) * this.halfHeight * config.enemy.sideEntryShare;
    return Math.atan2(y, side * this.halfWidth);
  }

  /** spellChance: the last roll of a spawn decides whether it carries a spell, and which. */
  private spawn(
    type: EnemyType,
    angle: number,
    words: string[],
    baseSpeed: number,
    spellChance: number,
  ): EnemyState {
    const { speedScale, maxSpeed } = config.enemyTypes[type];
    const roll = this.rng();
    const enemy: EnemyState = {
      id: this.nextId++,
      type,
      words,
      angle,
      // Distance from the center to the arena edge along this angle.
      distance: Math.min(
        this.halfWidth / Math.abs(Math.cos(angle)),
        this.halfHeight / Math.abs(Math.sin(angle)),
      ),
      speed: Math.min(maxSpeed, baseSpeed * speedScale),
      // One roll for both: under the chance it is spread evenly, so it also picks the spell.
      spell: roll < spellChance ? spellAt(roll / spellChance) : undefined,
    };
    this.enemies.push(enemy);
    return enemy;
  }
}
