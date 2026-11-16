import { describe, expect, it } from 'vitest';
import { config, type LevelKey } from '../src/config';
import { difficultyAt } from '../src/utils/difficulty';
import { GameSession, type EnemyState } from '../src/utils/gameSession';

const halfWidth = 200;
const halfHeight = 100;
const newSession = (rng = () => 0, level: LevelKey = 'normal') =>
  new GameSession(halfWidth, halfHeight, level, rng);
// Ids start high so they never collide with enemies the session spawns itself.
const enemy = (word: string, overrides: Partial<EnemyState> = {}): EnemyState => ({
  id: 100,
  type: 'grunt',
  words: [word],
  angle: 0,
  distance: 100,
  speed: 0,
  ...overrides,
});
const type = (session: GameSession, text: string) =>
  [...text].map((letter) => session.typeLetter(letter));
/** Answers the first rng call of a session, the type roll of its first spawn, with `roll`. */
const rollThen = (roll: number, rest: () => number) => {
  let calls = 0;
  return () => (calls++ === 0 ? roll : rest());
};
const sharesPrefix = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);
const onScreen = ['dolore', 'incididunt', 'exercitation', 'ut', 'sit'];
const levels = Object.keys(config.levels) as LevelKey[];

describe('spawning', () => {
  it('spawns the first enemy on the side edge of the arena', () => {
    const { spawned } = newSession(() => 0).update(16);

    expect(spawned).toHaveLength(1);
    expect(spawned[0].distance).toBeCloseTo(halfWidth, 0);
  });

  it('spawns on the top or bottom edge for vertical angles', () => {
    const { spawned } = newSession(() => 0.25).update(16);

    expect(spawned[0].distance).toBeCloseTo(halfHeight, 0);
  });

  it('waits for the spawn interval before spawning again', () => {
    const session = newSession();
    const interval = difficultyAt(0, 'normal').spawnIntervalMs;

    session.update(16);
    session.update(interval / 2);
    expect(session.enemies).toHaveLength(1);

    session.update(interval);
    expect(session.enemies).toHaveLength(2);
  });

  it('spawns grunts at the curve speed scaled and capped by their type', () => {
    const { speedScale, maxSpeed } = config.enemyTypes.grunt;
    const [early] = newSession().update(16).spawned;
    // A high roll: late in a run a low one would send a kamikaze instead.
    const [late] = newSession(() => 0.99).update(100_000_000).spawned;

    expect(early.type).toBe('grunt');
    expect(early.speed).toBeCloseTo(difficultyAt(0, 'normal').enemySpeed * speedScale, 1);
    expect(late.speed).toBe(maxSpeed);
  });

  it('gives enemies up to the word limit of the level', () => {
    const wordCounts = (level: LevelKey) => {
      let seed = 1;
      const session = newSession(() => (seed = (seed * 16807) % 2147483647) / 2147483647, level);
      // Long steps: every update spawns one enemy.
      return Array.from({ length: 200 }, () => session.update(5000).spawned[0].words.length);
    };

    expect(new Set(wordCounts('easy'))).toEqual(new Set([1]));
    expect(new Set(wordCounts('hard'))).toEqual(new Set([1, 2, 3]));
  });
});

describe('kamikazes', () => {
  const { kamikaze } = config.enemyTypes;
  const [, [kneeSeconds], [lateSeconds]] = config.difficulty.kamikazeChance;
  const spawnAt = (seconds: number, rng: () => number, level: LevelKey = 'normal') =>
    newSession(rng, level).update(seconds * 1000).spawned[0];
  /** A forced kamikaze per level and per rng value from 0 to 0.99. */
  const sweep = () =>
    levels.flatMap((level) =>
      Array.from({ length: 100 }, (_, index) =>
        spawnAt(
          lateSeconds,
          rollThen(0, () => index / 100),
          level,
        ),
      ),
    );

  it('take the place of a grunt when the roll falls under their chance', () => {
    const { kamikazeChance } = difficultyAt(lateSeconds, 'normal');

    expect(spawnAt(lateSeconds, () => kamikazeChance / 2).type).toBe('kamikaze');
    expect(spawnAt(lateSeconds, () => kamikazeChance).type).toBe('grunt');
  });

  it('carry one short word on every level', () => {
    for (const { type, words } of sweep()) {
      expect(type).toBe('kamikaze');
      expect(words).toHaveLength(1);
      expect(words[0]).toMatch(/^[a-z]+$/);
      expect(words[0].length).toBeLessThanOrEqual(kamikaze.maxWordLength);
    }
  });

  it('always enter through the left or right edge, clear of its corners', () => {
    const spawned = sweep();

    for (const { angle, distance } of spawned) {
      expect(Math.abs(Math.cos(angle)) * distance).toBeCloseTo(halfWidth);
      expect(Math.abs(Math.sin(angle)) * distance).toBeLessThan(halfHeight);
    }
    expect(new Set(spawned.map(({ angle }) => Math.sign(Math.cos(angle))))).toEqual(
      new Set([1, -1]),
    );
  });

  it('outrun grunts, but never their own speed cap', () => {
    const atKnee = spawnAt(
      kneeSeconds,
      rollThen(0, () => 0.5),
    );
    const gruntAtKnee = spawnAt(kneeSeconds, () => 0.99);
    const endless = spawnAt(
      100_000,
      rollThen(0, () => 0.5),
    );

    expect(atKnee.speed).toBeGreaterThan(gruntAtKnee.speed);
    expect(atKnee.speed).toBeLessThanOrEqual(kamikaze.maxSpeed);
    expect(endless.speed).toBe(kamikaze.maxSpeed);
  });

  it('never share a prefix with a word on screen', () => {
    for (let index = 0; index < 100; index++) {
      const session = newSession(rollThen(0, () => index / 100));
      session.enemies.push(enemy(onScreen[0], { words: [...onScreen] }));
      const [spawned] = session.update(lateSeconds * 1000).spawned;

      expect(onScreen.filter((word) => sharesPrefix(word, spawned.words[0]))).toEqual([]);
    }
  });
});

describe('tanks', () => {
  const { tank } = config.enemyTypes;
  const { first, every } = config.difficulty.tankSpawnSeconds;
  /** The tanks of 100 sessions, one per rng value, that jump straight to a tank time. */
  const tanksAt = (level: LevelKey, seconds: number = first) =>
    Array.from({ length: 100 }, (_, index) =>
      newSession(() => index / 100, level)
        .update(seconds * 1000)
        .spawned.filter((spawned) => spawned.type === 'tank'),
    ).flat();

  it('arrive at the configured time and pace, whatever the rng rolls', () => {
    for (const roll of [0, 0.5, 0.99]) {
      const session = newSession(() => roll);
      const arrivals: number[] = [];
      for (let second = 1; second <= first + 2 * every; second++) {
        const { spawned } = session.update(1000);
        if (spawned.some((enemy) => enemy.type === 'tank')) arrivals.push(second);
      }

      expect(arrivals).toEqual([first, first + every, first + 2 * every]);
    }
  });

  it('carry many words on every level, easy included', () => {
    for (const level of levels.filter((level) => !config.levels[level].wholePhrase)) {
      const tanks = tanksAt(level);
      const counts = tanks.map(({ words }) => words.length);

      expect(tanks).toHaveLength(100);
      expect(Math.min(...counts)).toBe(tank.minWords);
      expect(Math.max(...counts)).toBe(tank.maxWords);
      expect(tanks.flatMap(({ words }) => words).every((word) => /^[a-z]+$/.test(word))).toBe(true);
    }
  });

  it('carry their words as several short phrases on hell', () => {
    for (const { words } of tanksAt('hell')) {
      const sizes = words.map((phrase) => phrase.split(' ').length);
      const total = sizes.reduce((sum, size) => sum + size, 0);

      expect(words.length).toBeGreaterThan(1);
      expect(sizes.slice(0, -1).every((size) => size === tank.phraseWords)).toBe(true);
      expect(sizes.at(-1)).toBeLessThanOrEqual(tank.phraseWords);
      expect(total).toBeGreaterThanOrEqual(tank.minWords);
      expect(total).toBeLessThanOrEqual(tank.maxWords);
    }
  });

  it('keep every word within their length cap late in a run', () => {
    const late = first + 10 * every;

    expect(difficultyAt(late, 'normal').maxWordLength).toBeGreaterThan(tank.maxWordLength);
    for (const level of ['normal', 'hell'] as const) {
      const tanks = tanksAt(level, late);
      // Hell carries phrases: the cap is on each of their words.
      const lengths = tanks.flatMap(({ words }) => words.join(' ').split(' ')).map((w) => w.length);

      expect(tanks).toHaveLength(100);
      expect(Math.max(...lengths)).toBeLessThanOrEqual(tank.maxWordLength);
    }
  });

  it('walk in from a side edge at their share of the curve speed', () => {
    for (const { angle, distance, speed } of tanksAt('normal')) {
      expect(Math.abs(Math.cos(angle)) * distance).toBeCloseTo(halfWidth);
      expect(speed).toBeCloseTo(difficultyAt(first, 'normal').enemySpeed * tank.speedScale);
    }
  });

  it('cost their own damage in lives when they reach the player', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { type: 'tank', distance: 0 }));

    session.update(16);

    expect(tank.damage).toBeGreaterThan(config.enemyTypes.grunt.damage);
    expect(session.lives).toBe(config.player.lives - tank.damage);
  });

  it('cannot push the lives below zero', () => {
    const session = newSession();
    session.lives = 1;
    session.enemies.push(enemy('sit', { type: 'tank', distance: 0 }));

    session.update(16);

    expect(session.lives).toBe(0);
    expect(session.isOver).toBe(true);
  });

  it('count each of their words toward the combo, and break it when they land', () => {
    const perLevel = config.combo.perfectWordsPerLevel;
    const session = newSession();
    const boss = enemy('sit', { type: 'tank', words: Array(perLevel + 2).fill('sit') });
    session.enemies.push(boss);

    for (let word = 0; word <= perLevel; word++) type(session, 'sit');
    expect(session.multiplier).toBe(2);
    expect(session.streak).toBe(1);

    boss.distance = 0;
    session.update(16);
    expect(session.multiplier).toBe(1);
    expect(session.streak).toBe(0);
  });

  it('never share a prefix with a word on screen or among their own', () => {
    for (const level of ['normal', 'hell'] as const) {
      for (let index = 0; index < 100; index++) {
        const session = newSession(() => index / 100, level);
        session.enemies.push(enemy(onScreen[0], { words: [...onScreen] }));
        session.update(first * 1000);
        const texts = session.enemies.flatMap(({ words }) => words);

        expect(session.enemies.map((enemy) => enemy.type)).toContain('tank');
        expect(
          texts.filter((text, at) =>
            texts.some((other, otherAt) => at !== otherAt && sharesPrefix(text, other)),
          ),
        ).toEqual([]);
      }
    }
  });
});

describe('typing', () => {
  it('kills the enemy whose word is typed and scores its letters', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    const results = type(session, 'sit');

    expect(results.at(-1)).toMatchObject({ kind: 'kill', word: 'sit', enemy: { id: 100 } });
    expect(session.enemies).toHaveLength(0);
    expect(session.score).toBe(3 * config.pointsPerLetter);
    expect(session.typed).toBe('');
  });

  it('takes one word at a time off a multi-word enemy until it dies', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { words: ['sit', 'amet'] }));

    expect(type(session, 'sit').at(-1)).toMatchObject({ kind: 'word', word: 'sit' });
    expect(session.enemies[0].words).toEqual(['amet']);
    expect(session.typed).toBe('');

    expect(type(session, 'amet').at(-1)).toMatchObject({ kind: 'kill', word: 'amet' });
    expect(session.enemies).toHaveLength(0);
    expect(session.score).toBe(7 * config.pointsPerLetter);
  });

  it('accepts only the first remaining word of an enemy', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { words: ['sit', 'amet'] }));

    expect(type(session, 'a').at(-1)?.kind).toBe('typo');
    expect(session.enemies[0].words).toEqual(['sit', 'amet']);
  });

  it('keeps a matching prefix in the typed buffer', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    type(session, 'si');

    expect(session.typed).toBe('si');
  });

  it('keeps a typo in the buffer until it is erased, then the word can be finished', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    expect(type(session, 'six').at(-1)).toEqual({ kind: 'typo' });
    expect(session.typed).toBe('six');

    expect(type(session, 't').at(-1)?.kind).toBe('typo');
    expect(session.enemies).toHaveLength(1);

    session.eraseLetter();
    session.eraseLetter();
    expect(session.typed).toBe('si');

    expect(type(session, 't').at(-1)?.kind).toBe('kill');
  });

  it('stops growing the buffer at the letter cap', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    type(session, 'x'.repeat(config.typedBox.maxLetters + 5));

    expect(session.typed).toHaveLength(config.typedBox.maxLetters);
  });

  it('kills the closest enemy when two share a word', () => {
    const session = newSession();
    session.enemies.push(enemy('amet', { id: 100, distance: 90 }));
    session.enemies.push(enemy('amet', { id: 101, distance: 40 }));

    type(session, 'amet');

    expect(session.enemies.map((e) => e.id)).toEqual([100]);
  });

  it('targets the closest enemy matching what is typed', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { id: 100, distance: 90 }));
    session.enemies.push(enemy('sed', { id: 101, distance: 40 }));
    session.enemies.push(enemy('amet', { id: 102, distance: 10 }));

    expect(session.target).toBeUndefined();

    type(session, 's');
    expect(session.target?.id).toBe(101);

    type(session, 'i');
    expect(session.target?.id).toBe(100);
  });

  it('lists every enemy whose next word starts with the buffer, whatever its distance', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { id: 100, distance: 90 }));
    session.enemies.push(enemy('sed', { id: 101, distance: 40 }));
    session.enemies.push(enemy('amet', { id: 102, distance: 10, words: ['amet', 'sit'] }));

    expect(session.matches).toEqual([]);

    type(session, 's');
    expect(session.matches.map((e) => e.id)).toEqual([101, 100]);

    type(session, 'i');
    expect(session.matches.map((e) => e.id)).toEqual([100]);

    type(session, 'x');
    expect(session.matches).toEqual([]);
  });

  it('speeds nobody up on a typo that can be erased', () => {
    const session = newSession();
    const target = enemy('sit', { speed: 10 });
    session.enemies.push(target);

    type(session, 'sx');

    expect(target.speed).toBe(10);
  });
});

describe('enemies', () => {
  it('move toward the player at their own speed', () => {
    const session = newSession();
    const runner = enemy('sit', { distance: 100, speed: 50 });
    session.enemies.push(runner);

    session.update(1000);

    expect(runner.distance).toBe(50);
  });

  it('cost a life and disappear when they reach the player', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { distance: config.player.hitRadius + 1, speed: 10 }));

    const { reached } = session.update(1000);

    expect(reached.map((e) => e.id)).toEqual([100]);
    expect(session.lives).toBe(config.player.lives - config.enemyTypes.grunt.damage);
    expect(session.enemies.map((e) => e.id)).not.toContain(100);
  });

  it('take a half-typed buffer with them when no other word matches it', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { distance: 0 }));
    type(session, 'si');

    session.update(16);

    expect(session.typed).toBe('');
  });

  it('leave a buffer with a typo alone when they were not being typed', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { id: 100 }), enemy('amet', { id: 101, distance: 0 }));
    type(session, 'sx');

    session.update(16);

    expect(session.typed).toBe('sx');
  });

  it('end the game once the last life is gone', () => {
    const session = newSession();
    for (let i = 0; i <= config.player.lives; i++) {
      session.enemies.push(enemy('sit', { id: 100 + i, distance: 0 }));
    }

    session.update(16);

    expect(session.isOver).toBe(true);
    expect(session.lives).toBe(0);
  });
});

describe('hell level', () => {
  it('spawns each enemy with one whole phrase of up to three words', () => {
    let seed = 1;
    const session = newSession(() => (seed = (seed * 16807) % 2147483647) / 2147483647, 'hell');
    const spawned = Array.from({ length: 200 }, () => session.update(5000).spawned[0]);
    const phraseLengths = spawned.map((enemy) => enemy.words[0].split(' ').length);

    expect(spawned.every((enemy) => enemy.words.length === 1)).toBe(true);
    expect(new Set(phraseLengths)).toEqual(new Set([1, 2, 3]));
  });

  it('kills only when the whole phrase is typed, spaces included', () => {
    const session = newSession();
    session.enemies.push(enemy('sit amet'));

    expect(type(session, 'sit').at(-1)?.kind).toBe('progress');
    expect(session.enemies[0].words).toEqual(['sit amet']);

    expect(type(session, ' amet').at(-1)).toMatchObject({ kind: 'kill', word: 'sit amet' });
  });

  it('ignores a space typed before any letter', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    expect(type(session, ' ').at(-1)?.kind).toBe('progress');
    expect(type(session, 'sit').at(-1)?.kind).toBe('kill');
  });

  it('clears the buffer on a typo so the phrase must be retyped from the start', () => {
    const session = newSession(() => 0, 'hell');
    session.enemies.push(enemy('sit'));

    expect(type(session, 'six').at(-1)?.kind).toBe('error');
    expect(session.typed).toBe('');

    expect(type(session, 't').at(-1)?.kind).toBe('error');
    expect(session.enemies).toHaveLength(1);

    expect(type(session, 'sit').at(-1)?.kind).toBe('kill');
  });

  it('speeds up the targeted enemy on a typo', () => {
    const session = newSession(() => 0, 'hell');
    const target = enemy('sit', { id: 100, speed: 10 });
    const bystander = enemy('amet', { id: 101, speed: 10 });
    session.enemies.push(target, bystander);

    const result = type(session, 'sx').at(-1);

    expect(result).toEqual({ kind: 'error', enemy: target });
    expect(target.speed).toBe(10 * config.enemy.typoSpeedBoost);
    expect(bystander.speed).toBe(10);
  });

  it('speeds nobody up when the first letter matches no word', () => {
    const session = newSession(() => 0, 'hell');
    const idle = enemy('sit', { speed: 10 });
    session.enemies.push(idle);

    type(session, 'x');

    expect(idle.speed).toBe(10);
  });

  it('ignores backspace', () => {
    const session = newSession(() => 0, 'hell');
    session.enemies.push(enemy('sit'));
    type(session, 'si');

    session.eraseLetter();

    expect(session.typed).toBe('si');
  });
});

describe('combo', () => {
  const perLevel = config.combo.perfectWordsPerLevel;
  const typeWord = (session: GameSession, word: string) => {
    session.enemies.push(enemy(word));
    type(session, word);
  };
  // One enemy per word: each is typed in full before the next one spawns.
  const perfectWords = (session: GameSession, count: number) => {
    for (let i = 0; i < count; i++) typeWord(session, 'sit');
  };

  it('rises one multiplier level per run of perfect words', () => {
    const session = newSession();

    perfectWords(session, perLevel - 1);
    expect(session.multiplier).toBe(1);

    perfectWords(session, 1);
    expect(session.multiplier).toBe(2);
    expect(session.streak).toBe(0);
  });

  it('stops the multiplier at the maximum level', () => {
    const session = newSession();

    perfectWords(session, perLevel * (config.combo.maxMultiplier + 2));

    expect(session.multiplier).toBe(config.combo.maxMultiplier);
  });

  it('scores a word with the multiplier in effect before it counts', () => {
    const session = newSession();
    perfectWords(session, perLevel - 1);

    const beforeLevelUp = session.score;
    typeWord(session, 'amet');
    expect(session.score - beforeLevelUp).toBe('amet'.length * config.pointsPerLetter);
    expect(session.multiplier).toBe(2);

    const beforeNext = session.score;
    typeWord(session, 'amet');
    expect(session.score - beforeNext).toBe('amet'.length * config.pointsPerLetter * 2);
  });

  it('drops one level per word for wrong letters, even when several follow', () => {
    const session = newSession();
    perfectWords(session, perLevel * 2);
    expect(session.multiplier).toBe(3);
    session.enemies.push(enemy('sit'));

    type(session, 'xy');
    expect(session.multiplier).toBe(2);

    session.eraseLetter();
    session.eraseLetter();
    expect(type(session, 'sit').at(-1)?.kind).toBe('kill');
    expect(session.multiplier).toBe(2);

    session.enemies.push(enemy('sit'));
    type(session, 'x');
    expect(session.multiplier).toBe(1);
  });

  it('does not count a word with an erased typo as perfect', () => {
    const session = newSession();
    perfectWords(session, perLevel - 1);
    session.enemies.push(enemy('sit'));

    type(session, 'x');
    session.eraseLetter();

    expect(type(session, 'sit').at(-1)?.kind).toBe('kill');
    expect(session.streak).toBe(0);
  });

  it('resets a raised multiplier straight to x1 on a hell error', () => {
    const session = newSession(() => 0, 'hell');
    perfectWords(session, perLevel);
    expect(session.multiplier).toBe(2);
    session.enemies.push(enemy('sit'));

    expect(type(session, 'x').at(-1)?.kind).toBe('error');
    expect(session.multiplier).toBe(1);
    expect(session.streak).toBe(0);
  });

  it('resets the multiplier and progress when a life is lost', () => {
    const session = newSession();
    perfectWords(session, perLevel + 1);
    expect(session.multiplier).toBe(2);
    expect(session.streak).toBe(1);
    session.enemies.push(enemy('sit', { distance: config.player.hitRadius + 1, speed: 10 }));

    session.update(1000);

    expect(session.multiplier).toBe(1);
    expect(session.streak).toBe(0);
  });

  it('counts every word of a multi-word enemy toward the streak', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { words: Array.from({ length: perLevel }, () => 'sit') }));

    for (let i = 0; i < perLevel; i++) type(session, 'sit');

    expect(session.enemies).toHaveLength(0);
    expect(session.multiplier).toBe(2);
  });
});
