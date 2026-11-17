import { config, type ClassKey, type EnemyType, type LevelKey, type SpellKey } from '../config';
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
  /** The short word the descope ultimate gave this demon: typed, it kills the demon. */
  descoped?: string;
  /** Ms left before a demon at the hero costs a life (junior's passive); unset until it arrives. */
  graceMs?: number;
  /**
   * A ghost whose word is still hidden: it cannot be typed, matched or targeted, and abilities
   * skip it. Set at spawn, cleared for good when it comes within the ghost's revealDistance.
   */
  hidden?: boolean;
  /** Ms left of a slow (devops passive): the demon walks at the role's slowFactor while it lasts. */
  slowMs?: number;
}

/** What a spell did, for the scene to show. */
export type Cast =
  // healed: lives actually gained, 0 when they were full.
  | { spell: 'patch'; healed: number }
  | { spell: 'freeze' }
  | { spell: 'throttle' }
  | { spell: 'firewall' }
  | { spell: 'linter' }
  | { spell: 'cache' }
  | { spell: 'coffee' }
  // changed: the demons whose next word a cut shortened, closest first.
  | { spell: 'truncate'; changed: EnemyState[] }
  // killed: every demon the drop removed, with its texts.
  | { spell: 'drop'; killed: EnemyState[] }
  | { spell: 'pushback' }
  | { spell: 'descope'; changed: EnemyState[] }
  // enemy, word, killed: the demon whose next word was completed, its text, and whether that was
  // its last. carried: the spell its clean kill cast, if any. burned: the closest demon the dba passive
  // cut a letter off, if any. Bare when no demon was on screen.
  | {
      spell: 'tab';
      enemy: EnemyState;
      word: string;
      killed: boolean;
      carried?: Cast;
      burned?: EnemyState;
    }
  | { spell: 'tab' }
  | { spell: 'snippet' };

export type TypeResult =
  | { kind: 'progress' }
  // A wrong letter that stays in the buffer until it is erased.
  | { kind: 'typo' }
  // enemy: the target that got faster, if a word was being typed.
  | { kind: 'error'; enemy?: EnemyState }
  // A word was completed but the enemy has more.
  | { kind: 'word'; enemy: EnemyState; word: string }
  // It was the last one. cast: the spell of a carrier, already applied.
  | { kind: 'kill'; enemy: EnemyState; word: string; cast?: Cast; burned?: EnemyState }
  // A ready ability's command was typed: its spell is cast and nothing else changes.
  | { kind: 'ability'; ability: 'skill' | 'ultimate'; cast: Cast };

export interface UpdateResult {
  spawned: EnemyState[];
  reached: EnemyState[];
  // Demons the firewall absorbed: they are in reached too.
  blocked: number;
  // Demons whose descope window ended this frame: their full words are back.
  undescoped: EnemyState[];
}

/** An ability whose command can be typed now: typing the command fires it. */
export interface ReadyAbility {
  ability: 'skill' | 'ultimate';
  command: string;
  spell: SpellKey;
}

/** The abilities a role may have: every role has a skill; devops, dba and cto also an ultimate. */
export interface RoleAbilities {
  // Every role has a tint: it keeps junior's `{ tint }` from being a weak, all-optional type.
  tint: number;
  skill?: { command: string; spell: SpellKey; cooldownSeconds: number };
  ultimate?: { command: string; spell: SpellKey; chargeWords: number; chargeSeconds: number };
  /**
   * graceSeconds: a demon reaching the hero waits that long before it costs a life. slowFactor and
   * slowSeconds: a word typed on a demon slows it to that speed multiplier for that long.
   * burnLetters: each kill cuts that many letters off the closest surviving demon's next word.
   * pushPixels: a word that leaves the demon alive pushes it back that far, never past its edge.
   */
  passive?: {
    tint?: number;
    graceSeconds?: number;
    slowFactor?: number;
    slowSeconds?: number;
    burnLetters?: number;
    pushPixels?: number;
  };
}

const abilitiesOf = (heroClass: ClassKey): RoleAbilities => config.classes[heroClass];

/** The spells a demon can carry: the keys of config.spells that have a weight. */
export type CarriedSpell = {
  [K in SpellKey]: (typeof config.spells)[K] extends { weight: number } ? K : never;
}[SpellKey];

const carriedSpells = (Object.keys(config.spells) as SpellKey[]).filter(
  (spell): spell is CarriedSpell => 'weight' in config.spells[spell],
);

/** The spell at `roll` (0 to 1) along the configured weights of the carried spells. */
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
  /** Wrong letters the linter still forgives, one per point. */
  forgiven = 0;
  // A wrong letter was typed since the last completed word, so that word cannot be perfect.
  private wordFlawed = false;
  // Milliseconds left of a freeze: while it lasts no demon moves.
  private frozenMs = 0;
  // Milliseconds left of a throttle: while it lasts every demon moves at the throttle speed.
  private throttleMs = 0;
  // Milliseconds left of a cache: while it lasts a word's points are scaled up.
  private cacheMs = 0;
  // Milliseconds left of a descope: while it lasts, the demons it touched type short words.
  private descopeMs = 0;
  // Milliseconds left of a snippet: while it lasts a demon dies to the first letters of its word.
  private snippetMs = 0;
  /** Milliseconds until the skill is ready again; 0 when ready. */
  skillCooldownMs = 0;
  /** Charge toward the ultimate: perfect words and time, up to its chargeWords. */
  ultimateCharge = 0;
  lives: number = config.player.lives;
  elapsedMs = 0;
  private untilSpawnMs = 0;
  private untilTankMs: number = config.difficulty.tankSpawnSeconds.first * 1000;
  private nextId = 0;

  constructor(
    private readonly halfWidth: number,
    private readonly halfHeight: number,
    private readonly level: LevelKey,
    private readonly heroClass: ClassKey = config.defaultClass,
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

  /** The skill can fire: a role without one never has it ready. */
  get skillReady(): boolean {
    return abilitiesOf(this.heroClass).skill !== undefined && this.skillCooldownMs <= 0;
  }

  /** The ultimate is fully charged. False for a role without one. */
  get ultimateReady(): boolean {
    const { ultimate } = abilitiesOf(this.heroClass);
    return ultimate !== undefined && this.ultimateCharge >= ultimate.chargeWords;
  }

  /** The abilities that can be used now, each with the command that fires it. */
  get readyAbilities(): ReadyAbility[] {
    const { skill, ultimate } = abilitiesOf(this.heroClass);
    const ready: ReadyAbility[] = [];
    if (skill && this.skillReady) {
      ready.push({ ability: 'skill', command: skill.command, spell: skill.spell });
    }
    if (ultimate && this.ultimateReady) {
      ready.push({ ability: 'ultimate', command: ultimate.command, spell: ultimate.spell });
    }
    return ready;
  }

  /** The ultimate's charge in percent; undefined for a role without one. */
  get ultimatePercent(): number | undefined {
    const { ultimate } = abilitiesOf(this.heroClass);
    if (!ultimate) return undefined;
    return Math.floor((this.ultimateCharge * 100) / ultimate.chargeWords);
  }

  /** The skill's command; undefined for a role without a skill. */
  get skillCommand(): string | undefined {
    return abilitiesOf(this.heroClass).skill?.command;
  }

  /** Whole seconds until the skill is ready again, rounded up. */
  get skillCooldownSeconds(): number {
    return Math.ceil(this.skillCooldownMs / 1000);
  }

  /** The ultimate's command; undefined for a role without one. */
  get ultimateCommand(): string | undefined {
    return abilitiesOf(this.heroClass).ultimate?.command;
  }

  /** The typed buffer starts a ready command: it is not a typo, whatever the demons match. */
  get typingCommand(): boolean {
    const { typed } = this;
    return typed !== '' && this.readyAbilities.some((ability) => ability.command.startsWith(typed));
  }

  update(deltaMs: number): UpdateResult {
    this.elapsedMs += deltaMs;
    this.cacheMs = Math.max(0, this.cacheMs - deltaMs);
    this.snippetMs = Math.max(0, this.snippetMs - deltaMs);
    this.skillCooldownMs = Math.max(0, this.skillCooldownMs - deltaMs);
    const { ultimate } = abilitiesOf(this.heroClass);
    if (ultimate) {
      this.ultimateCharge = Math.min(
        ultimate.chargeWords,
        this.ultimateCharge + deltaMs / (ultimate.chargeSeconds * 1000),
      );
    }
    const undescoped = this.countDescope(deltaMs);
    const { reached, blocked } = this.advanceEnemies(deltaMs);
    const spawned = [...this.spawnIfDue(deltaMs), ...this.spawnTankIfDue(deltaMs)];
    return { spawned, reached, blocked, undescoped };
  }

  typeLetter(letter: string): TypeResult {
    // A space only means something inside a phrase: between words it is habit, not a typo.
    if (letter === ' ' && this.typed === '') return { kind: 'progress' };
    const typed = this.typed + letter;
    const ready = this.readyAbilities;
    const fired = ready.find((ability) => ability.command === typed);
    if (fired) {
      this.typed = '';
      return { kind: 'ability', ability: fired.ability, cast: this.fire(fired) };
    }
    const matches = this.matching(typed);
    const commandStarted = ready.some((ability) => ability.command.startsWith(typed));
    if (matches.length === 0 && !commandStarted) return this.mistype(typed);

    const completed = matches.find((enemy) => this.nextText(enemy) === typed);
    if (completed) return this.completeWord(completed, typed);
    // The snippet kills the closest demon once the buffer holds its first letters. A ready
    // command already took that prefix, so it wins.
    const [closest] = matches;
    if (
      this.snippetMs > 0 &&
      !commandStarted &&
      closest &&
      typed.length === config.spells.snippet.letters
    ) {
      const word = this.nextText(closest);
      return this.completeWord(closest, word, word.length - typed.length, true);
    }
    this.typed = typed;
    return { kind: 'progress' };
  }

  /**
   * Completes an enemy's next word, typed as `word`: scores `scored` of its letters, counts it, and
   * kills the demon when that was its last one or `outright` says so. A clean kill casts the
   * demon's spell.
   */
  private completeWord(
    enemy: EnemyState,
    word: string,
    scored = word.length,
    outright = false,
  ): TypeResult {
    // A descoped demon dies at its short word, and a snippet kill dies at once: whatever words it
    // had left.
    const dies = outright || enemy.descoped !== undefined;
    if (!dies) enemy.words.shift();
    // A drop rewards a clean kill: read the flaw before countWord() clears it.
    const clean = !this.wordFlawed;
    const scale = this.cached ? config.spells.cache.scoreScale : 1;
    this.score += scored * config.pointsPerLetter * this.multiplier * scale;
    this.countWord();
    this.typed = '';
    if (!dies && enemy.words.length > 0) {
      // A typed word slows or pushes back the demon as the role's passive says; a new slow
      // refreshes any already on it.
      const passive = abilitiesOf(this.heroClass).passive;
      if (passive?.slowSeconds !== undefined) enemy.slowMs = passive.slowSeconds * 1000;
      if (passive?.pushPixels !== undefined) this.pushBack(enemy, passive.pushPixels);
      return { kind: 'word', enemy, word };
    }
    this.enemies = this.enemies.filter((other) => other !== enemy);
    const burned = this.burnClosest();
    const cast = enemy.spell && clean ? this.cast(enemy.spell) : undefined;
    return { kind: 'kill', enemy, word, cast, burned };
  }

  /** The dba passive: cuts the closest surviving demon's next word, if the role has a burn. */
  private burnClosest(): EnemyState | undefined {
    const letters = abilitiesOf(this.heroClass).passive?.burnLetters;
    if (letters === undefined) return undefined;
    const [closest] = this.matching('');
    return closest && this.cutNextWord(closest, letters) ? closest : undefined;
  }

  /**
   * Completes the closest demon's next word as if typed perfectly, and clears the buffer. With
   * no demon on screen it does nothing. A demon killed this way casts its carried spell too.
   */
  private tab(): Cast {
    this.typed = '';
    const [closest] = this.matching('');
    if (!closest) return { spell: 'tab' };
    // The perfect word starts clean: a wrong letter that was in the buffer is not its flaw.
    this.wordFlawed = false;
    const word = this.nextText(closest);
    const result = this.completeWord(closest, word);
    if (result.kind === 'kill') {
      return {
        spell: 'tab',
        enemy: closest,
        word,
        killed: true,
        carried: result.cast,
        burned: result.burned,
      };
    }
    return { spell: 'tab', enemy: closest, word, killed: false };
  }

  /** No demon moves while a freeze lasts. */
  get frozen(): boolean {
    return this.frozenMs > 0;
  }

  /** While a throttle lasts, every demon moves at the throttle speed. */
  get throttled(): boolean {
    return this.throttleMs > 0;
  }

  /** While a cache lasts, each word's points are scaled up. */
  get cached(): boolean {
    return this.cacheMs > 0;
  }

  /**
   * Casts a spell at once, whoever asks: a carrier that was just killed, or the hero. Spells
   * score no combo points and leave the multiplier and the streak alone. Tab is the exception:
   * it completes a word, which counts like a typed one.
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
      case 'linter':
        // A second linter does not stack: it sets the forgiven count back to typos.
        this.forgiven = config.spells.linter.typos;
        return { spell: 'linter' };
      case 'cache':
        // A second cache restarts the timer instead of adding to it.
        this.cacheMs = config.spells.cache.seconds * 1000;
        return { spell: 'cache' };
      case 'coffee':
        return this.coffee();
      case 'throttle':
        // A second throttle restarts the timer instead of adding to it.
        this.throttleMs = config.spells.throttle.seconds * 1000;
        return { spell: 'throttle' };
      case 'truncate':
        return this.truncate();
      case 'drop':
        return this.drop();
      case 'pushback':
        return this.pushback();
      case 'descope':
        return this.descope();
      case 'tab':
        return this.tab();
      case 'snippet':
        // A second snippet restarts the timer instead of adding to it.
        this.snippetMs = config.spells.snippet.seconds * 1000;
        return { spell: 'snippet' };
    }
  }

  /** Refills the skill and charges the ultimate, up to its chargeWords. */
  private coffee(): Cast {
    this.skillCooldownMs = 0;
    const { ultimate } = abilitiesOf(this.heroClass);
    if (ultimate) {
      this.ultimateCharge = Math.min(
        ultimate.chargeWords,
        this.ultimateCharge + config.spells.coffee.chargeWords,
      );
    }
    return { spell: 'coffee' };
  }

  /**
   * Cuts the next word of every demon by truncate.letters, closest first. Returns the demons
   * whose text changed.
   */
  private truncate(): Cast {
    const changed: EnemyState[] = [];
    const closest = this.matching('');
    for (const enemy of closest) {
      if (this.cutNextWord(enemy, config.spells.truncate.letters)) changed.push(enemy);
    }
    return { spell: 'truncate', changed };
  }

  /**
   * Cuts the letters off the end of the enemy's next word. The text keeps a letter and never
   * ends in a space; a word being typed keeps one letter more than the buffer, so it stays a
   * match. Takes the longest cut that shares no prefix with another demon's next word, or none
   * if no cut does. Returns whether the text changed.
   */
  private cutNextWord(enemy: EnemyState, letters: number): boolean {
    const word = enemy.words[0];
    const others = this.enemies.filter((other) => other !== enemy).map((other) => other.words[0]);
    const matching = this.typed !== '' && word.startsWith(this.typed);
    const floor = matching ? this.typed.length + 1 : 1;
    const start = Math.max(floor, word.length - letters);
    for (let keep = start; keep <= word.length; keep++) {
      const text = word.slice(0, keep).trimEnd();
      if (text.length < floor) continue;
      if (others.some((other) => text.startsWith(other) || other.startsWith(text))) continue;
      enemy.words[0] = text;
      return text !== word;
    }
    return false;
  }

  /**
   * Removes every demon on screen. Their letters score at the base rate, with neither the
   * multiplier nor a cache; the streak and the combo are left alone. Clears the typed buffer.
   */
  private drop(): Cast {
    const killed = this.enemies;
    this.enemies = [];
    for (const enemy of killed) {
      const letters = enemy.words.join('').replace(/ /g, '').length;
      this.score += letters * config.pointsPerLetter;
    }
    this.typed = '';
    return { spell: 'drop', killed };
  }

  /** Pushes every demon back by pushback.pixels, never past the edge it came in from. */
  private pushback(): Cast {
    for (const enemy of this.enemies) this.pushBack(enemy, config.spells.pushback.pixels);
    return { spell: 'pushback' };
  }

  private pushBack(enemy: EnemyState, pixels: number): void {
    enemy.distance = Math.min(this.edgeDistance(enemy.angle), enemy.distance + pixels);
  }

  /**
   * Every demon on screen gets a short word for the window, closest first. A demon that has one
   * keeps it, so a recast only restarts the timer and descopes the demons that came since.
   */
  private descope(): Cast {
    this.descopeMs = config.spells.descope.seconds * 1000;
    const changed: EnemyState[] = [];
    const closest = this.matching('');
    for (const enemy of closest) {
      if (enemy.descoped !== undefined) continue;
      const short = this.shortWord(enemy);
      if (short === undefined) continue;
      enemy.descoped = short;
      changed.push(enemy);
    }
    return { spell: 'descope', changed };
  }

  /**
   * The shortest prefix of the enemy's first word that is at least descope.letters long and,
   * while the enemy matches the buffer, longer than it. It shares no prefix with another demon's
   * full word or short word. Undefined when none qualifies: the demon keeps its words.
   */
  private shortWord(enemy: EnemyState): string | undefined {
    const first = enemy.words[0].split(' ')[0];
    const typing = this.typed !== '' && enemy.words[0].startsWith(this.typed);
    const floor = Math.max(config.spells.descope.letters, typing ? this.typed.length + 1 : 0);
    const others = this.enemies
      .filter((other) => other !== enemy)
      .flatMap((other) => [other.words[0], other.descoped ?? other.words[0]]);
    for (let length = floor; length <= first.length; length++) {
      const text = first.slice(0, length);
      if (others.some((other) => text.startsWith(other) || other.startsWith(text))) continue;
      return text;
    }
    return undefined;
  }

  private heal(lives: number): Cast {
    const healed = Math.min(lives, config.player.lives - this.lives);
    this.lives += healed;
    return { spell: 'patch', healed };
  }

  /** Spends the ability that fired: its cooldown starts or its charge empties. */
  private fire(ready: ReadyAbility): Cast {
    const { skill } = abilitiesOf(this.heroClass);
    if (ready.ability === 'ultimate') this.ultimateCharge = 0;
    else if (skill) this.skillCooldownMs = skill.cooldownSeconds * 1000;
    return this.cast(ready.spell);
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

  /**
   * Completes a word: a perfect one (no wrong letter since the last word) advances the streak
   * and charges the ultimate.
   */
  private countWord(): void {
    if (!this.wordFlawed) {
      // The ultimate charges on every perfect word, even at the multiplier cap.
      const { ultimate } = abilitiesOf(this.heroClass);
      if (ultimate) this.ultimateCharge = Math.min(ultimate.chargeWords, this.ultimateCharge + 1);
      if (this.multiplier < config.combo.maxMultiplier) {
        this.streak += 1;
        if (this.streak >= config.combo.perfectWordsPerLevel) {
          this.multiplier += 1;
          this.streak = 0;
        }
      }
    }
    this.wordFlawed = false;
  }

  /** A wrong letter: erasable levels drop one level once per word, hell breaks the combo to x1. */
  private recordWrongLetter(): void {
    // A forgiven typo keeps the combo and leaves wordFlawed as it was.
    if (this.forgiven > 0) {
      this.forgiven -= 1;
      return;
    }
    if (!this.erasableTypos) this.multiplier = 1;
    else if (!this.wordFlawed) this.multiplier = Math.max(1, this.multiplier - 1);
    this.wordFlawed = true;
    this.streak = 0;
  }

  private matching(prefix: string): EnemyState[] {
    return this.enemies
      .filter((enemy) => !enemy.hidden && this.nextText(enemy).startsWith(prefix))
      .sort((a, b) => a.distance - b.distance);
  }

  /** What the demon is typed through now: its short word while descoped, else its first word. */
  private nextText(enemy: EnemyState): string {
    return enemy.descoped ?? enemy.words[0];
  }

  /**
   * Counts the descope window down. When it ends every demon gets its full words back, and the
   * buffer is cleared if it was typing a short word and now matches nothing.
   */
  private countDescope(deltaMs: number): EnemyState[] {
    if (this.descopeMs === 0) return [];
    this.descopeMs = Math.max(0, this.descopeMs - deltaMs);
    if (this.descopeMs > 0) return [];
    const undescoped = this.enemies.filter((enemy) => enemy.descoped !== undefined);
    const wasTyped = undescoped.some((enemy) => enemy.descoped?.startsWith(this.typed));
    for (const enemy of undescoped) delete enemy.descoped;
    if (wasTyped && this.matching(this.typed).length === 0) this.typed = '';
    return undescoped;
  }

  private advanceEnemies(deltaMs: number): { reached: EnemyState[]; blocked: number } {
    // ponytail: per-frame granularity, a frame that straddles the end of a throttle is all slow; exact split if it ever matters.
    const pace = this.throttled ? config.spells.throttle.speedScale : 1;
    const movingMs = Math.max(0, deltaMs - this.frozenMs);
    this.frozenMs = Math.max(0, this.frozenMs - deltaMs);
    this.throttleMs = Math.max(0, this.throttleMs - deltaMs);
    // A graced demon waits on real time: freeze does not stretch its grace. A slowed demon walks at
    // the role's slowFactor for its slow's remaining real time.
    const slowFactor = abilitiesOf(this.heroClass).passive?.slowFactor ?? 1;
    for (const enemy of this.enemies) {
      if (enemy.graceMs !== undefined) enemy.graceMs -= deltaMs;
      else {
        const slow = enemy.slowMs !== undefined && enemy.slowMs > 0 ? slowFactor : 1;
        enemy.distance -= (enemy.speed * movingMs * pace * slow) / 1000;
      }
      if (enemy.slowMs !== undefined) enemy.slowMs -= deltaMs;
    }
    for (const enemy of this.enemies) {
      if (enemy.hidden && enemy.distance <= config.enemyTypes.ghost.revealDistance) {
        enemy.hidden = false;
      }
    }
    const graceSeconds = abilitiesOf(this.heroClass).passive?.graceSeconds;
    if (graceSeconds !== undefined) {
      for (const enemy of this.enemies) {
        if (enemy.graceMs === undefined && enemy.distance <= config.player.hitRadius) {
          enemy.distance = config.player.hitRadius;
          enemy.graceMs = graceSeconds * 1000;
        }
      }
    }
    const reached = this.enemies.filter((enemy) =>
      graceSeconds !== undefined
        ? enemy.graceMs !== undefined && enemy.graceMs <= 0
        : enemy.distance <= config.player.hitRadius,
    );
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
    const wasTyped = reached.some((enemy) => this.nextText(enemy).startsWith(this.typed));
    if (wasTyped && this.matching(this.typed).length === 0) this.typed = '';
    return { reached, blocked };
  }

  private spawnIfDue(deltaMs: number): EnemyState[] {
    this.untilSpawnMs -= deltaMs;
    if (this.untilSpawnMs > 0) return [];

    const difficulty = difficultyAt(this.elapsedMs / 1000, this.level);
    this.untilSpawnMs += difficulty.spawnIntervalMs;
    const { kamikazeChance, ghostChance, spellChance, enemySpeed } = difficulty;
    const roll = this.rng();
    if (roll < kamikazeChance) {
      const word = this.pickWords(1, config.enemyTypes.kamikaze.maxWordLength);
      return [this.spawn('kamikaze', this.sideAngle(), word, enemySpeed, spellChance)];
    }
    if (roll < kamikazeChance + ghostChance) {
      const { maxWordLength } = config.enemyTypes.ghost;
      const word = this.pickWords(1, Math.min(difficulty.maxWordLength, maxWordLength));
      const angle = this.rng() * Math.PI * 2;
      return [this.spawn('ghost', angle, word, enemySpeed, spellChance)];
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
    // A short word is taken too: a new demon must not start with it.
    const taken = this.enemies.flatMap((active) =>
      active.descoped === undefined ? active.words : [...active.words, active.descoped],
    );
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

  /** Distance from the center to the arena edge along this angle. */
  private edgeDistance(angle: number): number {
    return Math.min(
      this.halfWidth / Math.abs(Math.cos(angle)),
      this.halfHeight / Math.abs(Math.sin(angle)),
    );
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
      distance: this.edgeDistance(angle),
      speed: Math.min(maxSpeed, baseSpeed * speedScale),
      // One roll for both: under the chance it is spread evenly, so it also picks the spell.
      spell: roll < spellChance ? spellAt(roll / spellChance) : undefined,
      hidden: type === 'ghost' ? true : undefined,
    };
    this.enemies.push(enemy);
    return enemy;
  }
}
