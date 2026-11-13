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
    enraged: '#ff5a5a',
    labelBackground: '#000000aa',
    panel: 0x0d0812,
    panelError: 0x8a1c1c,
    typedBoxBorder: 0xffe14d,
  },
  // Everything else sits at depth 0: enemy words stay readable over the HUD, and enemies coming
  // from below stay hidden behind the bottom panel.
  depths: { hud: -2, enemy: -1 },
  player: { lives: 3, hitRadius: 12 },
  // typoSpeedBoost: speed multiplier for the targeted enemy each time its word is mistyped.
  enemy: { vanishMs: 250, labelOffset: 14, typoSpeedBoost: 1.3 },
  // Words are picked with a length between (max - lengthSpread) and max.
  words: { lengthSpread: 5 },
  pointsPerLetter: 10,
  typedBox: { height: 24, errorFlashMs: 150 },
  menuInputDelayMs: 600,
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
