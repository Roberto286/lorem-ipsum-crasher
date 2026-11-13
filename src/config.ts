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
    labelBackground: '#000000aa',
    panel: 0x0d0812,
    panelError: 0x8a1c1c,
    typedBoxBorder: 0xffe14d,
  },
  // Everything else sits at depth 0: enemy words stay readable over the HUD and over other
  // demons, and enemies coming from below stay hidden behind the bottom panel.
  depths: { hud: -3, enemy: -2, enemyLabel: -1 },
  // Sheets are horizontal strips of animation frames.
  sprites: {
    player: { frameWidth: 20, frameHeight: 28 },
    imp: { frameWidth: 16, frameHeight: 16 },
    chort: { frameWidth: 16, frameHeight: 23 },
    bigDemon: { frameWidth: 32, frameHeight: 36 },
  },
  animationFps: 8,
  player: { lives: 3, hitRadius: 12 },
  // typoSpeedBoost: speed multiplier for the targeted enemy each time its word is mistyped.
  enemy: { vanishMs: 250, labelGap: 2, typoSpeedBoost: 1.3 },
  // The typed word flies from the hero to the demon before it takes effect.
  projectile: { flightMs: 220, spins: 1 },
  intro: { fadeMs: 400 },
  // Words are picked with a length between (max - lengthSpread) and max.
  words: { lengthSpread: 5 },
  pointsPerLetter: 10,
  // maxLetters: cap on the typed buffer, typos included, so it never overflows the box.
  typedBox: { height: 24, errorFlashMs: 150, maxLetters: 40 },
  // Picked in the menu. Harder: enemies spawn closer together and carry more words each.
  // wholePhrase: the words form one phrase that must be typed in a single go, spaces included.
  // erasableTypos: a wrong letter stays in the buffer until erased with Backspace; without it a
  // wrong letter resets the buffer and speeds up the target.
  levels: {
    easy: { spawnIntervalScale: 1.3, maxWordsPerEnemy: 1, wholePhrase: false, erasableTypos: true },
    normal: { spawnIntervalScale: 1, maxWordsPerEnemy: 2, wholePhrase: false, erasableTypos: true },
    hard: { spawnIntervalScale: 0.8, maxWordsPerEnemy: 3, wholePhrase: false, erasableTypos: true },
    hell: { spawnIntervalScale: 0.8, maxWordsPerEnemy: 3, wholePhrase: true, erasableTypos: false },
  },
  defaultLevel: 'normal',
  scores: { storageKey: 'loremIpsumCrasher.scores', maxEntries: 5 },
  difficulty: {
    // The second keyframe is the knee: every curve gets steeper after it.
    spawnIntervalMs: [
      [0, 2400],
      [90, 1800],
      [180, 800],
    ],
    // Pixels per second.
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
    minSpawnIntervalMs: 400,
    maxEnemySpeed: 80,
  },
} as const;

export type LevelKey = keyof typeof config.levels;
