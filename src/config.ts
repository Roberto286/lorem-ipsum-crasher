/** [seconds, value] keyframes: linear in between, the last segment's slope continues forever. */
export type Curve = readonly (readonly [number, number])[];

export const config = {
  locale: 'en',
  screen: { width: 480, height: 270 },
  font: { family: 'Press Start 2P', size: 8, titleSize: 16 },
  colors: {
    background: '#1a1020',
    text: '#f4e9d8',
    accent: '#ffe14d',
    dim: '#6b5a7a',
    enraged: '#ff5a5a',
    // Behind a demon's words, per enemy type: the tank's own color marks it as the miniboss.
    labelBackground: { grunt: '#000000aa', kamikaze: '#000000aa', tank: '#5a1a6ecc' },
    panel: 0x0d0812,
    panelError: 0x8a1c1c,
    typedBoxBorder: 0xffe14d,
  },
  // Everything else sits at depth 0: the HUD strip and the bottom panel hide enemies that are
  // still outside the play area, and enemy words stay readable over other demons.
  depths: { backdrop: -3, enemy: -2, enemyLabel: -1 },
  // Sheets are horizontal strips of animation frames.
  sprites: {
    player: { frameWidth: 20, frameHeight: 28 },
    imp: { frameWidth: 16, frameHeight: 16 },
    chort: { frameWidth: 16, frameHeight: 23 },
    bigDemon: { frameWidth: 32, frameHeight: 36 },
  },
  animationFps: 8,
  // Background loop volume (0 to 1): the sound effects play at full volume, so it sits below them.
  music: { volume: 0.4 },
  player: { lives: 3, hitRadius: 12 },
  // typoSpeedBoost: speed multiplier for the targeted enemy each time its word is mistyped.
  // spawnBehindPanels: pixels past the play band where top and bottom demons start, hidden by
  // the hud strip and the typed box, so they take as long to arrive as before the strip existed.
  // sideEntryShare: demons that enter from the left or right start within this middle share of
  // the edge, so they are never hidden behind the hud strip or the typed box.
  // maxVisibleWords: lines of words a label shows before a count of the hidden ones, so the
  // stack of a tank stays small in the play band.
  enemy: {
    vanishMs: 250,
    labelGap: 2,
    // Room kept between laid-out enemy labels and around the hero: 0 lets them touch.
    labelSpacing: 1,
    typoSpeedBoost: 1.3,
    spawnBehindPanels: 12,
    sideEntryShare: 0.8,
    maxVisibleWords: 3,
  },
  // One entry per demon type. sprite: sheet and animation key. speedScale: multiplier on the
  // difficulty.enemySpeed curve; maxSpeed: cap on the result, in pixels per second.
  // damage: lives lost when the demon reaches the hero.
  // deathSound: sound key played when the demon dies; one effect per type.
  // spawnSound: optional sound key played once when a demon of that type appears.
  enemyTypes: {
    grunt: { sprite: 'chort', speedScale: 1, maxSpeed: 80, damage: 1, deathSound: 'deathGrunt' },
    // Carries one word of up to maxWordLength letters on every level and enters from the sides
    // only: the top and bottom edges are so close that it would arrive in under a second.
    // maxSpeed leaves about 2.5 s to type that word from the nearest point of a side edge.
    kamikaze: {
      sprite: 'imp',
      speedScale: 2.5,
      maxSpeed: 90,
      damage: 1,
      maxWordLength: 4,
      deathSound: 'deathKamikaze',
      spawnSound: 'screechKamikaze',
    },
    // The miniboss: minWords to maxWords words on every level, typed phraseWords at a time on
    // whole-phrase levels. It enters from the sides, the long way, so there is time for them.
    // maxWordLength: cap on the difficulty.maxWordLength curve for its words, so that many of
    // them can still be typed before it arrives late in a run.
    tank: {
      sprite: 'bigDemon',
      speedScale: 0.5,
      maxSpeed: 40,
      damage: 2,
      minWords: 5,
      maxWords: 8,
      phraseWords: 2,
      maxWordLength: 6,
      deathSound: 'deathTank',
      spawnSound: 'laughTank',
    },
  },
  // The typed word flies from the hero to the demon before it takes effect.
  projectile: { flightMs: 220, spins: 1 },
  // Cutscene pictures live in the top pictureRatio of the screen (caption and hint sit below)
  // and drift from one camera look to another over moveMs, with a Phaser ease name.
  intro: { fadeMs: 400, moveMs: 7000, moveEase: 'Sine.easeInOut', pictureRatio: 0.7 },
  // Resuming shows a countdown first, so the player can find the keys again.
  pause: { resumeCountdownSeconds: 3 },
  // Words are picked with a length between (max - lengthSpread) and max.
  words: { lengthSpread: 5 },
  pointsPerLetter: 10,
  // A word is perfect when typed with no wrong letter since the previous completed word.
  // On erasable levels a wrong letter costs one level, once per word; on hell it breaks the combo
  // to x1 at once. perfectWordsPerLevel: perfect words in a row per level; maxMultiplier: the cap.
  combo: { perfectWordsPerLevel: 5, maxMultiplier: 5 },
  // maxLetters: cap on the typed buffer, typos included, so it never overflows the box.
  typedBox: { height: 24, errorFlashMs: 150, maxLetters: 31 },
  // Opaque strip on top of the screen: score, lives and time on the left, buttons on the right.
  hud: { height: 24, padding: 4 },
  // Carried spells (weight and color) drop from some demons and act on the hero, but only on a
  // clean kill: the carrier's last word typed with no wrong letter. The others, like freeze, are
  // cast by the hero roles. GameSession.cast is the one entry point. weight: relative odds among
  // the carried spells. color: label background of the carrier.
  spells: {
    // lives: lives given back, up to player.lives. The HUD text swells to pulseScale and back,
    // pulseMs each way.
    patch: { weight: 1, color: 0x1e8a3c, lives: 1, pulseMs: 150, pulseScale: 1.2 },
    // hits: demons the firewall absorbs, one per point, whole demons. A second firewall while one
    // is up does not stack: the shield is set back to hits. flashMs: screen flash when it absorbs.
    firewall: { weight: 1, color: 0xa0401a, hits: 1, flashMs: 150 },
    // typos: wrong letters forgiven, one per point; a forgiven typo keeps the combo.
    linter: { weight: 1, color: 0x1a8a8a, typos: 1 },
    // seconds: how long a cache scales the word score; scoreScale: the factor on a word's points.
    // A second cache restarts the timer instead of adding to it.
    cache: { weight: 1, color: 0x9a7a10, seconds: 8, scoreScale: 2 },
    // seconds: how long no demon moves. tint: sprite colour of a frozen demon.
    freeze: { seconds: 2, tint: 0x9fd8ff },
  },
  // Picked in the menu. Harder: enemies spawn closer together and carry more words each.
  // wholePhrase: the words form one phrase that must be typed in a single go, spaces included.
  // erasableTypos: a wrong letter stays in the buffer until erased with Backspace; without it a
  // wrong letter resets the buffer and speeds up the target.
  // kamikazeChanceScale: multiplier on the difficulty.kamikazeChance curve.
  levels: {
    easy: {
      spawnIntervalScale: 1.3,
      maxWordsPerEnemy: 1,
      wholePhrase: false,
      erasableTypos: true,
      kamikazeChanceScale: 0.5,
    },
    normal: {
      spawnIntervalScale: 1,
      maxWordsPerEnemy: 2,
      wholePhrase: false,
      erasableTypos: true,
      kamikazeChanceScale: 1,
    },
    hard: {
      spawnIntervalScale: 0.8,
      maxWordsPerEnemy: 3,
      wholePhrase: false,
      erasableTypos: true,
      kamikazeChanceScale: 1,
    },
    hell: {
      spawnIntervalScale: 0.8,
      maxWordsPerEnemy: 3,
      wholePhrase: true,
      erasableTypos: false,
      kamikazeChanceScale: 1,
    },
  },
  defaultLevel: 'normal',
  // Picked in the menu, in this order. Developer roles; each tints the hero sprite,
  // white leaves the art unchanged. A role may have a skill (command, spell, cooldownSeconds:
  // ready again that long after use) and an ultimate (command, spell, chargeWords: perfect words
  // that charge it, emptied on use). Commands are typed while ready and must not share a prefix
  // with any lorem word.
  classes: {
    junior: { tint: 0xffffff },
    devops: {
      tint: 0x9fd8ff,
      ultimate: { command: 'freeze', spell: 'freeze', chargeWords: 20 },
    },
    dba: { tint: 0xff9a3c },
    cto: { tint: 0xb98cff },
  },
  defaultClass: 'junior',
  // v2: combo scoring changed what a score is worth, so the v1 boards are no longer comparable.
  scores: { storageKey: 'loremIpsumCrasher.scores.v2', maxEntries: 5 },
  difficulty: {
    // The second keyframe is the knee: every curve gets steeper after it.
    spawnIntervalMs: [
      [0, 2400],
      [90, 1800],
      [180, 800],
    ],
    // Pixels per second, before the speedScale and maxSpeed of the enemy type.
    enemySpeed: [
      [0, 14],
      [90, 22],
      [180, 40],
    ],
    maxWordLength: [
      [0, 4],
      [90, 8],
      [180, 13],
    ],
    // Chance that a regular spawn is a kamikaze instead of a grunt, held between 0 and
    // maxKamikazeChance. It starts below zero to keep the opening of a run free of them.
    kamikazeChance: [
      [0, -0.05],
      [90, 0.1],
      [180, 0.3],
    ],
    minSpawnIntervalMs: 400,
    maxKamikazeChance: 0.35,
    // Chance that a regular spawn carries a spell, held between 0 and maxSpellChance: none at
    // the start of a run, then about one demon in ten.
    spellChance: [
      [0, 0],
      [90, 0.05],
      [180, 0.1],
    ],
    maxSpellChance: 0.12,
    // Tanks ignore the spawn interval and the dice: the first one comes after `first` seconds,
    // then one every `every` seconds.
    tankSpawnSeconds: { first: 60, every: 60 },
  },
} as const;

export type LevelKey = keyof typeof config.levels;
export type ClassKey = keyof typeof config.classes;
export type EnemyType = keyof typeof config.enemyTypes;
export type SpellKey = keyof typeof config.spells;
