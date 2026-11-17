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
    labelBackground: {
      grunt: '#000000aa',
      kamikaze: '#000000aa',
      ghost: '#000000aa',
      tank: '#5a1a6ecc',
    },
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
  // A taller typed box cuts the play band's half-height by 4 px, so this adds 4 px: GameScene
  // passes playHeight / 2 + spawnBehindPanels, which stays 123 px at both heights.
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
    spawnBehindPanels: 16,
    sideEntryShare: 0.8,
    maxVisibleWords: 3,
    // spawnSoundGapMs: a spawn sound does not play again within this many ms of the same sound.
    spawnSoundGapMs: 1500,
  },
  // One entry per demon type. sprite: sheet and animation key. speedScale: multiplier on the
  // difficulty.enemySpeed curve; maxSpeed: cap on the result, in pixels per second.
  // damage: lives lost when the demon reaches the hero.
  // deathSound: sound key played when the demon dies; one effect per type.
  // spawnSound: optional sound key played once when a demon of that type appears.
  // alpha, tint: optional sprite opacity and colour of a ghost, which has no sheet of its own.
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
    // Carries one word of up to maxWordLength letters on every level, hidden (the label shows
    // ???) until the demon comes within revealDistance px of the hero, then it fades in over
    // revealMs. Reveal is sticky: a pushback does not hide it again. It enters from any edge.
    // Timing: the walk from the reveal to the hero is (revealDistance - player.hitRadius) /
    // maxSpeed = (100 - 12) / 35 = 2.5 s at best. Typing 6 letters at 5 to 6 letters a second
    // takes about 1.1 s, so about 1.4 s is left to read the word and start. A hell typo
    // speeds the demon up and shortens that.
    ghost: {
      sprite: 'chort',
      alpha: 0.7,
      tint: 0x9fffc0,
      speedScale: 1,
      maxSpeed: 35,
      damage: 1,
      maxWordLength: 6,
      revealDistance: 100,
      revealMs: 400,
      deathSound: 'deathGrunt',
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
  // visibleLetters: most characters the centre slot shows. A longer correct phrase shows a leading
  // '…' and its last visibleLetters - 1 letters, so the newest letters stay in view.
  typedBox: { height: 32, errorFlashMs: 150, maxLetters: 31, visibleLetters: 31 },
  // The typed box's ability lines: px each sits from the box centre, skill above, ultimate below.
  abilityLineOffset: 5,
  // Layout of the how-to-play screen, px. margin: left and right edge; titleTop: top of the page
  // title; bodyTop: top of the first block; blockGap: between blocks; headingGap: under a block's
  // heading; iconColumn: width kept left of a block that has a sprite or swatch; swatch: side of a
  // drop's colour square; footerOffset: distance of the footer from the bottom edge; hintMargin:
  // gap between the menu's help hint and the screen corner.
  help: {
    margin: 8,
    titleTop: 6,
    bodyTop: 30,
    blockGap: 12,
    headingGap: 3,
    iconColumn: 40,
    swatch: 8,
    footerOffset: 8,
    hintMargin: 4,
  },
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
    // Refills the skill's cooldown and adds chargeWords to the ultimate's charge, up to its chargeWords.
    coffee: { weight: 1, color: 0x6f4e37, chargeWords: 5 },
    // seconds: how long no demon moves (the devops ultimate). tint: sprite colour of a frozen demon.
    freeze: { seconds: 5, tint: 0x9fd8ff },
    // seconds: how long every demon moves at speedScale times its speed. A second throttle
    // restarts the timer. Not carried: only the devops skill casts it.
    throttle: { seconds: 4, speedScale: 0.5 },
    // letters: letters cut from the end of each demon's next text by the dba skill. The text
    // keeps at least one letter. Not carried: only the dba skill casts it.
    truncate: { letters: 2 },
    // shakeMs: how long the screen shakes when the dba ultimate drops every demon. Not carried:
    // only the dba ultimate casts it.
    drop: { shakeMs: 250 },
    // pixels: distance the cto skill pushes every demon back by, never past the edge it came in
    // from. Not carried: only the cto skill casts it.
    pushback: { pixels: 40 },
    // seconds: how long the cto ultimate lasts. Each demon on screen at the cast needs only a
    // short word, at least letters long; typing it kills the demon whatever words it had left.
    // Not carried: only the cto ultimate casts it.
    descope: { seconds: 6, letters: 3 },
    // Not carried: only the junior skill casts it. Completes the closest demon's next word as if
    // typed perfectly, so a demon whose word is its last dies.
    tab: {},
    // seconds: how long the junior ultimate lasts. While it does, typing the first letters of the
    // closest demon's next word correctly kills that demon outright. A second snippet restarts the
    // timer. Not carried: only the junior ultimate casts it.
    snippet: { seconds: 6, letters: 2 },
  },
  // Picked in the menu. Harder: enemies spawn closer together and carry more words each.
  // wholePhrase: the words form one phrase that must be typed in a single go, spaces included.
  // erasableTypos: a wrong letter stays in the buffer until erased with Backspace; without it a
  // wrong letter resets the buffer and speeds up the target.
  // kamikazeChanceScale: multiplier on the difficulty.kamikazeChance curve.
  // ghostChanceScale: multiplier on the difficulty.ghostChance curve.
  levels: {
    easy: {
      spawnIntervalScale: 1.3,
      maxWordsPerEnemy: 1,
      wholePhrase: false,
      erasableTypos: true,
      kamikazeChanceScale: 0.5,
      ghostChanceScale: 0.5,
    },
    normal: {
      spawnIntervalScale: 1,
      maxWordsPerEnemy: 2,
      wholePhrase: false,
      erasableTypos: true,
      kamikazeChanceScale: 1,
      ghostChanceScale: 1,
    },
    hard: {
      spawnIntervalScale: 0.8,
      maxWordsPerEnemy: 3,
      wholePhrase: false,
      erasableTypos: true,
      kamikazeChanceScale: 1,
      ghostChanceScale: 1,
    },
    hell: {
      spawnIntervalScale: 0.8,
      maxWordsPerEnemy: 3,
      wholePhrase: true,
      erasableTypos: false,
      kamikazeChanceScale: 1,
      ghostChanceScale: 1,
    },
  },
  defaultLevel: 'normal',
  // Picked in the menu, in this order. Developer roles; each tints the hero sprite,
  // white leaves the art unchanged. A role may have a skill (command, spell, cooldownSeconds:
  // ready again that long after use) and an ultimate (command, spell, chargeWords: perfect words
  // that charge it, chargeSeconds: one word of charge per this many seconds, so perfect words
  // stay the main source; emptied on use). Commands are typed while ready and must not share
  // a prefix with any lorem word. A role may have a passive: graceSeconds (a demon reaching the hero
  // stops there and costs no life that long, still typeable), tint (sprite tint while graced or slowed),
  // slowFactor (speed multiplier on a demon the hero has typed a word of, for slowSeconds; a new word refreshes it).
  // burnLetters (letters cut off the closest surviving demon's next word on each kill),
  // pushPixels (pixels a demon the hero types a word of, without killing it, is pushed back).
  classes: {
    junior: {
      tint: 0xffffff,
      skill: { command: 'tab', spell: 'tab', cooldownSeconds: 8 },
      ultimate: { command: 'snippet', spell: 'snippet', chargeWords: 25, chargeSeconds: 7 },
      // Grace: a demon that reaches the junior waits at the hero before it costs a life. A kill in time costs nothing.
      passive: { graceSeconds: 1.5, tint: 0xffe066 },
    },
    devops: {
      tint: 0x9fd8ff,
      skill: { command: 'throttle', spell: 'throttle', cooldownSeconds: 12 },
      ultimate: { command: 'freeze', spell: 'freeze', chargeWords: 20, chargeSeconds: 6 },
      // Slow: a demon the devops types a word of walks at 80% speed for 2 s. Freeze and throttle stack with it.
      passive: { tint: 0x9fd8ff, slowFactor: 0.8, slowSeconds: 2 },
    },
    dba: {
      tint: 0xff9a3c,
      skill: { command: 'truncate', spell: 'truncate', cooldownSeconds: 10 },
      // Charges slower than the devops freeze: drop clears every demon, not just stops them.
      ultimate: { command: 'drop', spell: 'drop', chargeWords: 30, chargeSeconds: 8 },
      // Burn: each kill cuts the last letter off the closest surviving demon's next word.
      passive: { burnLetters: 1 },
    },
    cto: {
      tint: 0xb98cff,
      skill: { command: 'pushback', spell: 'pushback', cooldownSeconds: 8 },
      ultimate: { command: 'descope', spell: 'descope', chargeWords: 25, chargeSeconds: 7 },
      // Push: each word the cto types that leaves the demon alive pushes it back 8 px, never past its edge.
      passive: { pushPixels: 8 },
    },
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
    // Chance that a regular spawn is a ghost, held between 0 and maxGhostChance. It crosses zero
    // at 45 s, after the player has met grunts, kamikazes and the first spells. It shares the
    // spawn's type roll with the kamikaze: a roll under kamikazeChance is a kamikaze, the next
    // ghostChance of it a ghost, the rest grunts.
    ghostChance: [
      [0, -0.1],
      [90, 0.1],
      [180, 0.3],
    ],
    minSpawnIntervalMs: 400,
    maxKamikazeChance: 0.35,
    maxGhostChance: 0.15,
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
