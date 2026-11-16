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
  enemy: { vanishMs: 250, labelGap: 2, typoSpeedBoost: 1.3, spawnBehindPanels: 12 },
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
  typedBox: { height: 24, errorFlashMs: 150, maxLetters: 40 },
  // Opaque strip on top of the screen: score, lives and time on the left, buttons on the right.
  hud: { height: 24, padding: 4 },
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
  // v2: combo scoring changed what a score is worth, so the v1 boards are no longer comparable.
  scores: { storageKey: 'loremIpsumCrasher.scores.v2', maxEntries: 5 },
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
