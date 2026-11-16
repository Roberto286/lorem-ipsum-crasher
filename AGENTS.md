# Repository Guidelines

## Project Overview

Lorem Ipsum Crasher is a desktop-only browser typing game built with Phaser 4, TypeScript and Vite. Demons walk toward the hero at the center of the screen, each carrying lorem-ipsum words; typing a word hurls it at the demon. A demon that reaches the hero costs a life.

There is no README, CI, changelog or release process. This file is the only project documentation.

## Architecture & Data Flow

The core rule: **game rules are render-free, scenes only draw and forward input.**

- `src/utils/gameSession.ts` — `GameSession` owns all run state (enemies, typed buffer, score, score multiplier and streak, lives, spawn timer) and has no Phaser dependency, so it runs headless in tests. Enemy positions are polar (`angle`, `distance`) relative to the player.
- Enemy types: `EnemyState.type` (`EnemyType`, a key of `config.enemyTypes`) picks the sprite, the speed (scale and cap on the `enemySpeed` curve), the lives lost when the demon reaches the hero and the word rules. A regular spawn is a `grunt`, or a `kamikaze` (one short word, fast, side edges only) with the chance of the `kamikazeChance` curve. The `tank` miniboss comes on its own timer (`config.difficulty.tankSpawnSeconds`) with many words, in short phrases on whole-phrase levels; its label shows `config.enemy.maxVisibleWords` texts and a count of the rest.
- Spells: `EnemyState.spell` (a `CarriedSpell`: the keys of `config.spells` with a `weight`) marks a carrier. A regular spawn carries one with the chance of the `spellChance` curve; a tank always does. Freeze is not carried: no demon carries it, the hero roles cast it. `GameSession.cast(spell)` applies a spell and returns its `Cast`. `typeLetter` casts the carrier's spell only on a clean kill (its last word typed with no wrong letter, read before `countWord()` clears the flaw); a carrier that dies dirty or reaches the hero casts nothing. The spell roll is the last rng call of a spawn, so seeded runs stay stable. `freeze` sets `GameSession.frozen`, a global timer (`frozenMs`) that `advanceEnemies` honours: no demon moves while it lasts, and a spawn during it stays put too. `GameScene.drawEnemies` passes it to `Enemy.setFrozen` every frame, which tints the sprite and pauses its walk.
  `firewall` is carried like `patch`. Casting it sets `GameSession.shield` to `config.spells.firewall.hits`; `advanceEnemies` lets the shield absorb whole demons that reach the hero, one per point, in `reached` order. An absorbed demon deals no damage and keeps the combo; a second firewall does not stack.
  `linter` is carried like `patch`. Casting it sets `GameSession.forgiven` to `config.spells.linter.typos`; `recordWrongLetter` spends one per wrong letter and returns early, so the combo, streak and the word's perfect flag stay as they were. Erasable and hell buffer rules still apply. A second linter does not stack.
  `cache` is carried like `patch`. Casting it sets `GameSession.cacheMs` to `config.spells.cache.seconds` times 1000 and `update()` counts it down, whether or not a freeze is on. While `cached`, a completed word's points are multiplied by `scoreScale`; combo and streak are untouched. A second cache restarts the timer.
- Role abilities: a role's `skill` and `ultimate` in `config.classes` fire when their typed command is typed while ready (`readyAbilities`). Commands never share a prefix with lorem words, so typing one never clashes with a demon. The skill runs a `skillCooldownMs` cooldown; the ultimate charges one step per perfect word and one per `chargeSeconds` of play (`ultimateCharge`, up to `chargeWords`) and empties when used. Typing a command returns `kind: 'ability'` and changes no score, combo or flaw state. The devops skill is `throttle`: every demon moves at `throttle.speedScale` while it lasts, and a second one restarts the timer. The devops ultimate is `freeze`. The cto skill is `pushback`: every demon moves back `pushback.pixels`, never past the edge it came in from.
  The cto ultimate is `descope`: every demon on screen gets a short word of at least `descope.letters` letters, free of shared prefixes, for `descope.seconds`. Typing it kills the demon whatever words it had left. The window ends by restoring the full words.
- DBA: the skill is `truncate`, which cuts `truncate.letters` letters off the end of every demon's next word. It never cuts below one letter and never leaves two demons sharing a prefix. The ultimate is `drop`: it removes every demon, scoring their remaining letters at the base rate (no multiplier or cache). It charges slower than `freeze`.
- HUD: active drops (`FW`, `LINT`, `CACHE`) render right-aligned in the typed box, not the top strip; `typedBox.maxLetters` is 31 so the centred buffer clears them. The left part of the typed box lists each ability by its command (skill above ultimate, a lone one centred): white while locked, with its first letters yellow as the charge fills; yellow as a whole when ready, and the typed prefix of a ready command turns red.
- `src/scenes/GameScene.ts` — renders `GameSession` state, converts polar positions to screen coordinates, plays sounds and tweens.

Key press flow:

```
listenForKeys (utils/keyboard.ts)
  → GameScene.handleLetter
  → GameSession.typeLetter → TypeResult
      'progress'      buffer grew
      'typo'          levels with erasableTypos: wrong letter stays in the buffer, Backspace erases it
      'error'         hell only: buffer cleared, target speeds up (config.enemy.typoSpeedBoost), enrages
      'word' | 'kill' hurlWord (entities/wordProjectile.ts) → onHit → Enemy.setWords / Enemy.vanish
      'ability'       ready role command typed: its spell is cast, buffer cleared, no score change
```

Frame flow:

```
GameScene.update → session.update(delta) → { spawned, reached }
  → create / destroy Enemy objects → draw enemies → draw HUD
session.isOver → endRun → saveScore → scene.start('MenuScene', run)
```

Scene order (`src/main.ts`): `BootScene` (asset loading, animations, desktop check, starts the music loop) → `IntroScene` (cutscene pages; each page has a camera `move`, a second camera keeps caption and hint fixed) → `MenuScene` (level and class picker, the typed commands of the picked role read from `config.classes`, high scores, also the game-over screen via `create(lastRun)`) → `GameScene`.

`GameScene` layout: opaque HUD strip on top (`config.hud`), play band in the middle, opaque typed-box panel at the bottom. Enemy labels are laid out by `layoutLabels` (`src/utils/labelLayout.ts`): closest demon first, kept inside the play band and clear of each other and of the hero. Every enemy whose top word starts with the typed buffer gets that prefix highlighted (`GameSession` exposes the matches; `target` is the closest one).

Pause: Escape, the button, or window blur/hidden (`Phaser.Core.Events.BLUR` / `HIDDEN`) pause the run. Resuming runs a countdown (`config.pause.resumeCountdownSeconds`) on the scene clock, because tweens stay paused until it ends.

Cross-scene state lives in the Phaser `registry`: `level` and `heroClass` (both set in `BootScene`, changed in `MenuScene`) and `muted` (toggled in `GameScene`, undefined means unmuted). High scores persist in `localStorage` per level and class through `src/utils/scoreStorage.ts`; zero-point runs are not saved.

## Key Directories

| Path            | Purpose                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/scenes/`   | Phaser scenes: rendering, input wiring, scene transitions                                                                                               |
| `src/entities/` | Game objects: `Enemy` (sprite + label wrapper), `Player` (extends `Phaser.GameObjects.Sprite`), `hurlWord`                                              |
| `src/utils/`    | Phaser-free logic (`gameSession`, `difficulty`, `words`, `labelLayout`, `scoreStorage`, `i18n`) plus scene helpers (`keyboard`, `ui`)                   |
| `src/assets/`   | `audio/` (effects `.wav`, `music.ogg` + `.mp3`), `backgrounds/`, `font/`, `sprites/*.png` (frame strips); `CREDITS.txt`                                 |
| `scripts/`      | `generate_music.py`: regenerates the music loop (Python stdlib + `ffmpeg`); `generate_sfx.py`: regenerates the enemy sounds in `audio/` (Python stdlib) |
| `tests/`        | Vitest unit tests, flat, one file per `src/utils` module                                                                                                |
| `dist/`         | Build output, git-ignored; never edit                                                                                                                   |

## Development Commands

```sh
npm ci                # install from package-lock.json
npm run dev           # Vite dev server
npm run build         # tsc --noEmit && vite build → dist/
npm run preview       # serve the built dist/
npm test              # vitest run (single pass)
npm run lint          # eslint .
npm run format        # prettier --write . (rewrites files)
npx tsc --noEmit      # typecheck only (covers src, tests, vite.config.ts)
npx vitest run tests/words.test.ts          # one file
npx vitest run -t "keeps only the best scores"   # one test by name
```

Before finishing a change, run `npm run lint`, `npm test` and `npx tsc --noEmit`.

## Code Conventions & Common Patterns

**Formatting and linting**

- Prettier: single quotes, `printWidth: 100`, otherwise defaults (2 spaces, semicolons, trailing commas).
- ESLint flat config: `@eslint/js` recommended + `typescript-eslint` recommended + `camelcase: 'error'`.
- TypeScript is `strict` with `noUnusedLocals` and `noUnusedParameters`. The codebase has no `eslint-disable`, `@ts-ignore` or `@ts-expect-error`; keep it that way.

**Naming**

- Files exporting a class are PascalCase (`GameScene.ts`, `Enemy.ts`); files exporting functions are camelCase (`wordProjectile.ts`, `scoreStorage.ts`).
- Scene keys are string literals matching the class name: `super('GameScene')`, `this.scene.start('MenuScene', run)`.
- Tests are `tests/<module>.test.ts`, mirroring `src/utils/<module>.ts`.

**Patterns to follow**

- **All tunables live in `src/config.ts`**, one `as const` object. Do not hardcode numbers, colors, depths or timings in scenes; add a key to `config` with a `//` comment explaining it. Types such as `LevelKey` are derived from it (`keyof typeof config.levels`).
- **Difficulty is data**: `Curve` keyframes (`[seconds, value]`) in `config.difficulty`, sampled by `sampleCurve` / `difficultyAt(seconds, level)` in `src/utils/difficulty.ts`.
- **Results as discriminated unions**, not exceptions: `TypeResult` switches on `kind`. Nothing in the codebase throws. The only `try/catch` is the silent `localStorage` fallback in `scoreStorage.ts`.
- **Dependency injection through defaulted parameters**: `GameSession(halfWidth, halfHeight, level, heroClass = config.defaultClass, rng = Math.random)`, `pickWord(maxLength, activeWords, rng)`. Tests pass deterministic RNGs. Use `private readonly` constructor parameter properties.
- **No `async`/`await`**: timing uses Phaser tweens, `time.delayedCall` and `onComplete` callbacks.
- **Scene fields** use `!` definite assignment and are (re)initialized in `create()`, because Phaser reuses scene instances across restarts.
- **Text and buttons** go through `addText` / `addButton` in `src/utils/ui.ts`, and every user-visible string through `t(key, values)` in `src/utils/i18n.ts` (add the key to the `en` dictionary; `{name}` placeholders).
- **Keyboard input** goes through `listenForKeys(scene, onKey)`, which uses a native `window` keydown listener, skips key repeats and unregisters on scene shutdown.
- **Draw order** uses `config.depths` (negative depths for backdrop and enemies; HUD strip, panels and everything else sit at 0).
- **Words**: `pickWord` avoids prefix collisions with words already on screen; preserve that invariant when touching spawning.
- **Comments** explain why, not what: short `/** */` on exports, `//` for non-obvious decisions.

**Commits**

Conventional Commits with a lowercase subject: `feat: hurl the typed word at the demon`, `fix: ...`, `chore: ...`, and `feat!:` for breaking changes.

## Important Files

- `index.html` — page shell with the `#game` mount; loads `/src/main.ts`.
- `src/main.ts` — creates `Phaser.Game` (480×270, `pixelArt`, `Scale.FIT`) and registers scenes.
- `src/config.ts` — every gameplay, layout and visual constant; levels (`easy`, `normal`, `hard`, `hell`).
- `src/utils/gameSession.ts` — game rules; start here for any gameplay change.
- `src/scenes/GameScene.ts` — the play loop and HUD.
- `src/scenes/BootScene.ts` — asset preloading and animation creation; register new sprites and sounds here, with frame sizes in `config.sprites`.
- `vite.config.ts` — `base: './'` and `assetsInlineLimit: 0`. Phaser's loader fetches assets by URL, so assets must never be inlined as data URIs.
- `eslint.config.js`, `.prettierrc`, `tsconfig.json` — style and type rules.

## Runtime/Tooling Preferences

- Package manager: **npm** (`package-lock.json`, lockfile v3). Do not introduce another lockfile.
- Node: no `engines` or `.nvmrc`; use a current LTS that satisfies Vite 8 and Vitest 5.
- ESM only (`"type": "module"`); `moduleResolution: bundler`, so imports omit file extensions.
- Stack: Phaser `^4.2.1` (only runtime dependency), TypeScript 6, Vite 8, Vitest 5, ESLint 10, Prettier 3. Import Phaser as `import * as Phaser from 'phaser'`.
- Avoid new dependencies; the project deliberately has one runtime dependency.

## Testing & QA

- Framework: Vitest, default Node environment (no jsdom), no `vitest.config.*`; it picks up `vite.config.ts`.
- Globals are off: `import { describe, expect, it } from 'vitest'` in every test file.
- Only Phaser-free modules in `src/utils/` are tested. Put new game rules in `GameSession` or another pure util so they can be tested without Phaser; scenes and entities have no tests.
- Style: `describe` per unit, `it('plain-English behavior sentence')`.
- Determinism: inject RNGs (`() => 0`, a seeded LCG, or `index / 100` sweeps) instead of mocking `Math.random`.
- Browser globals are stubbed inline: `vi.stubGlobal('localStorage', ...)` with `afterEach(() => vi.unstubAllGlobals())` (see `tests/scoreStorage.test.ts`).
- Assert against `config` values (`config.pointsPerLetter`, `config.player.lives`), not hardcoded numbers, so tuning does not break tests.
- No coverage tooling or thresholds are configured.
- Visual and scene changes need a manual check with `npm run dev` in a desktop browser (mobile clients only get a notice).
