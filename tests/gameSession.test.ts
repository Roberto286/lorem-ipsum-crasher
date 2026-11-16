import { describe, expect, it } from 'vitest';
import { config, type ClassKey, type LevelKey } from '../src/config';
import { difficultyAt } from '../src/utils/difficulty';
import { GameSession, type EnemyState } from '../src/utils/gameSession';
import { loremWords } from '../src/utils/words';

const halfWidth = 200;
const halfHeight = 100;
const newSession = (rng = () => 0, level: LevelKey = 'normal', heroClass: ClassKey = 'junior') =>
  new GameSession(halfWidth, halfHeight, level, heroClass, rng);
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
const graceMs = config.classes.junior.passive.graceSeconds * 1000;
/** A junior demon that reaches the hero waits out its grace first, so it lands on the second frame. */
const landAfterGrace = (session: GameSession, ms = 0) => {
  session.update(ms);
  return session.update(graceMs);
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

    landAfterGrace(session);

    expect(tank.damage).toBeGreaterThan(config.enemyTypes.grunt.damage);
    expect(session.lives).toBe(config.player.lives - tank.damage);
  });

  it('cannot push the lives below zero', () => {
    const session = newSession();
    session.lives = 1;
    session.enemies.push(enemy('sit', { type: 'tank', distance: 0 }));

    landAfterGrace(session);

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
    landAfterGrace(session);
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

    const { reached } = landAfterGrace(session, 1000);

    expect(reached.map((e) => e.id)).toEqual([100]);
    expect(session.lives).toBe(config.player.lives - config.enemyTypes.grunt.damage);
    expect(session.enemies.map((e) => e.id)).not.toContain(100);
  });

  it('let a junior demon wait out its grace at the hero without costing a life', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { distance: 0 }));

    const { reached } = session.update(16);

    expect(reached).toHaveLength(0);
    expect(session.lives).toBe(config.player.lives);
    expect(session.enemies.find((e) => e.id === 100)?.graceMs).toBe(graceMs);
  });

  it('cost a life once a junior demon has waited out its grace', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { distance: 0 }));
    session.update(16);

    const { reached } = session.update(graceMs);

    expect(reached.map((e) => e.id)).toEqual([100]);
    expect(session.lives).toBe(config.player.lives - config.enemyTypes.grunt.damage);
  });

  it('score a junior demon killed inside its grace like any other kill', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { distance: 0 }));
    session.update(16);

    expect(type(session, 'sit').at(-1)?.kind).toBe('kill');
    expect(session.score).toBeGreaterThan(0);
    expect(session.lives).toBe(config.player.lives);
  });

  it('take a half-typed buffer with them when no other word matches it', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { distance: 0 }));
    type(session, 'si');

    landAfterGrace(session);

    expect(session.typed).toBe('');
  });

  it('leave a buffer with a typo alone when they were not being typed', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { id: 100 }), enemy('amet', { id: 101, distance: 0 }));
    type(session, 'sx');

    landAfterGrace(session);

    expect(session.typed).toBe('sx');
  });

  it('end the game once the last life is gone', () => {
    const session = newSession();
    for (let i = 0; i <= config.player.lives; i++) {
      session.enemies.push(enemy('sit', { id: 100 + i, distance: 0 }));
    }

    landAfterGrace(session);

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

    expect(type(session, 'z').at(-1)?.kind).toBe('error');
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

    landAfterGrace(session, 1000);

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

describe('spells', () => {
  // Late enough in a run that the spell chance is past zero.
  const lateMs = 180_000;
  const spellChance = difficultyAt(lateMs / 1000, 'normal').spellChance;
  const freezeMs = config.spells.freeze.seconds * 1000;

  it('gives no demon a spell at the start of a run', () => {
    expect(newSession(() => 0.5).update(16).spawned[0].spell).toBeUndefined();
  });

  it('gives a regular spawn a spell only when its roll is under the chance', () => {
    // The first spawn of the update is the regular one, before any tank.
    expect(newSession(() => spellChance / 2).update(lateMs).spawned[0].spell).toBeDefined();
    expect(newSession(() => spellChance).update(lateMs).spawned[0].spell).toBeUndefined();
  });

  it('gives every tank a spell, whatever its roll', () => {
    for (let i = 0; i < 100; i++) {
      const tank = newSession(() => i / 100)
        .update(config.difficulty.tankSpawnSeconds.first * 1000)
        .spawned.find((state) => state.type === 'tank');
      expect(tank?.spell).toBeDefined();
    }
  });

  it('gives back a life on a patch, never past the full count', () => {
    const session = newSession();
    session.lives = config.player.lives - 1;

    session.cast('patch');
    expect(session.lives).toBe(config.player.lives);
    expect(session.cast('patch')).toEqual({ spell: 'patch', healed: 0 });
  });

  it('casts the spell of a carrier killed by typing', () => {
    const session = newSession();
    session.lives = config.player.lives - config.spells.patch.lives;
    session.enemies = [enemy('ab', { spell: 'patch' })];

    expect(type(session, 'ab').at(-1)).toEqual({
      kind: 'kill',
      enemy: expect.objectContaining({ id: 100 }),
      word: 'ab',
      cast: { spell: 'patch', healed: config.spells.patch.lives },
    });
  });

  it('casts nothing when a demon without a spell dies', () => {
    const session = newSession();
    session.enemies = [enemy('ab')];

    expect(type(session, 'ab').at(-1)).toEqual({
      kind: 'kill',
      enemy: expect.objectContaining({ id: 100 }),
      word: 'ab',
    });
  });

  it('refills the skill cooldown on a coffee', () => {
    const session = newSession();
    session.skillCooldownMs = 5000;

    expect(session.cast('coffee')).toEqual({ spell: 'coffee' });
    expect(session.skillCooldownMs).toBe(0);
    expect(session.skillReady).toBe(true);
  });

  it('adds ultimate charge on a coffee, never past the ultimate chargeWords', () => {
    const session = newSession();
    const { chargeWords } = config.classes.junior.ultimate!;
    session.ultimateCharge = chargeWords - 2;

    session.cast('coffee');
    expect(session.ultimateCharge).toBe(chargeWords);
    expect(session.ultimateReady).toBe(true);
  });

  it('casts the coffee of a carrier killed by typing', () => {
    const session = newSession();
    session.skillCooldownMs = 5000;
    session.enemies = [enemy('ab', { spell: 'coffee' })];

    expect(type(session, 'ab').at(-1)).toEqual({
      kind: 'kill',
      enemy: expect.objectContaining({ id: 100 }),
      word: 'ab',
      cast: { spell: 'coffee' },
    });
    expect(session.skillReady).toBe(true);
  });

  it('loses the spell of a carrier that reaches the hero', () => {
    const session = newSession();
    session.lives = config.player.lives - 1;
    session.enemies = [enemy('ab', { spell: 'patch', distance: config.player.hitRadius })];

    const { reached } = landAfterGrace(session);

    expect(reached.map((e) => e.id)).toEqual([100]);
    expect(session.lives).toBe(config.player.lives - 1 - config.enemyTypes.grunt.damage);
  });

  it('stops every demon for the length of a freeze', () => {
    const session = newSession();
    const demons = [enemy('ab', { speed: 50 }), enemy('cd', { id: 101, speed: 50 })];
    session.enemies = [...demons];

    session.cast('freeze');
    for (let i = 0; i < 10; i++) session.update(freezeMs / 10);

    expect(demons.map((demon) => demon.distance)).toEqual([100, 100]);
  });

  it('lets the demons walk again at their speed when the freeze ends', () => {
    const session = newSession();
    const demon = enemy('ab', { speed: 50 });
    session.enemies = [demon];
    const start = demon.distance;

    session.cast('freeze');
    session.update(freezeMs);
    session.update(1000);

    expect(demon.distance).toBeCloseTo(start - demon.speed);
  });

  it('counts only the time past the end of a freeze in the frame that ends it', () => {
    const session = newSession();
    const demon = enemy('ab', { speed: 50 });
    session.enemies = [demon];
    const start = demon.distance;

    session.cast('freeze');
    session.update(freezeMs + 500);

    expect(demon.distance).toBeCloseTo(start - demon.speed * 0.5);
  });

  it('holds a demon that spawns during a freeze', () => {
    const session = newSession();
    session.cast('freeze');
    const [demon] = session.update(16).spawned;
    const start = demon.distance;

    session.update(freezeMs / 2);

    expect(demon.distance).toBe(start);
  });

  it('restarts the timer on a second freeze instead of adding to it', () => {
    const session = newSession();
    const demon = enemy('ab', { speed: 50 });
    session.enemies = [demon];
    const start = demon.distance;

    session.cast('freeze');
    session.update(freezeMs / 2);
    session.cast('freeze');
    session.update(freezeMs);

    expect(demon.distance).toBe(start);
    expect(session.frozen).toBe(false);

    session.update(1000);
    expect(demon.distance).toBeCloseTo(start - demon.speed);
  });

  it('casts freeze when asked directly', () => {
    const session = newSession();

    expect(session.cast('freeze')).toEqual({ spell: 'freeze' });
    expect(session.frozen).toBe(true);
  });

  it('never gives a demon the freeze spell', () => {
    for (let i = 0; i < 100; i++) {
      const roll = (spellChance * i) / 100;
      const { spawned } = newSession(() => roll).update(lateMs);
      expect(spawned[0].spell).toBeDefined();
      expect(spawned[0].spell).not.toBe('freeze');
    }
  });

  it('drops nothing when the last word of a carrier had a wrong letter', () => {
    const session = newSession(() => 0, 'easy');
    session.lives = config.player.lives - config.spells.patch.lives;
    session.enemies = [enemy('ab', { spell: 'patch' })];

    type(session, 'x');
    session.eraseLetter();

    expect(type(session, 'ab').at(-1)).toEqual({
      kind: 'kill',
      enemy: expect.objectContaining({ id: 100 }),
      word: 'ab',
      cast: undefined,
    });
    expect(session.lives).toBe(config.player.lives - config.spells.patch.lives);
  });

  it('drops nothing on hell when the last word of a carrier had a wrong letter', () => {
    const session = newSession(() => 0, 'hell');
    session.enemies = [enemy('ab', { spell: 'patch' })];

    type(session, 'ax');

    expect(type(session, 'ab').at(-1)).toEqual({
      kind: 'kill',
      enemy: expect.objectContaining({ id: 100 }),
      word: 'ab',
      cast: undefined,
    });
  });

  it('absorbs the next hit with a firewall and keeps the combo', () => {
    const session = newSession();
    session.multiplier = 3;
    session.cast('firewall');
    session.enemies = [enemy('ab', { distance: config.player.hitRadius })];

    const result = landAfterGrace(session);

    expect(result.reached).toHaveLength(1);
    expect(result.blocked).toBe(1);
    expect(session.lives).toBe(config.player.lives);
    expect(session.multiplier).toBe(3);
    expect(session.shield).toBe(0);
  });

  it('lets the second of two demons through when the firewall holds one', () => {
    const session = newSession();
    session.cast('firewall');
    session.enemies = [
      enemy('ab', { distance: config.player.hitRadius }),
      enemy('cd', { distance: config.player.hitRadius }),
    ];

    const result = landAfterGrace(session);

    expect(result.blocked).toBe(1);
    expect(session.lives).toBe(config.player.lives - config.enemyTypes.grunt.damage);
  });

  it('absorbs a tank whole', () => {
    const session = newSession();
    session.cast('firewall');
    session.enemies = [enemy('ab', { type: 'tank', distance: config.player.hitRadius })];

    expect(landAfterGrace(session).blocked).toBe(1);
    expect(session.lives).toBe(config.player.lives);
  });

  it('does not stack a second firewall', () => {
    const session = newSession();
    session.cast('firewall');
    session.cast('firewall');

    expect(session.shield).toBe(config.spells.firewall.hits);
  });

  it('drops a firewall from a carrier killed cleanly', () => {
    const session = newSession();
    session.enemies = [enemy('ab', { spell: 'firewall' })];

    expect(type(session, 'ab').at(-1)).toEqual({
      kind: 'kill',
      enemy: expect.objectContaining({ id: 100 }),
      word: 'ab',
      cast: { spell: 'firewall' },
    });
    expect(session.shield).toBe(config.spells.firewall.hits);
  });

  it('keeps the combo through a typo forgiven by the linter', () => {
    const session = newSession();
    session.multiplier = 3;
    session.streak = 2;
    session.cast('linter');

    type(session, 'x');

    expect(session.multiplier).toBe(3);
    expect(session.streak).toBe(2);
    expect(session.forgiven).toBe(0);
  });

  it('still counts the word as perfect after a forgiven typo', () => {
    const session = newSession();
    session.enemies = [enemy('ab', { spell: 'firewall' })];
    session.cast('linter');

    type(session, 'ax');
    session.eraseLetter();

    expect(type(session, 'b').at(-1)).toEqual({
      kind: 'kill',
      enemy: expect.objectContaining({ id: 100 }),
      word: 'ab',
      cast: { spell: 'firewall' },
    });
    expect(session.shield).toBe(config.spells.firewall.hits);
  });

  it('forgives only one typo', () => {
    const session = newSession();
    session.multiplier = 3;
    session.cast('linter');

    type(session, 'x');
    expect(session.multiplier).toBe(3);

    type(session, 'y');
    expect(session.multiplier).toBe(2);
  });

  it('still clears the buffer on hell after a forgiven typo', () => {
    const session = newSession(() => 0, 'hell');
    const target = enemy('sit', { id: 100, speed: 10 });
    session.enemies.push(target);
    session.cast('linter');

    expect(type(session, 'sx').at(-1)).toEqual({ kind: 'error', enemy: target });
    expect(session.typed).toBe('');
    expect(target.speed).toBe(10 * config.enemy.typoSpeedBoost);
  });

  it('doubles a word score while the cache lasts', () => {
    const session = newSession();
    session.enemies = [enemy('ab')];
    session.cast('cache');

    type(session, 'ab');

    expect(session.score).toBe(2 * config.pointsPerLetter * config.spells.cache.scoreScale);
  });

  it('lapses after its seconds', () => {
    const session = newSession();
    session.cast('cache');

    session.update(config.spells.cache.seconds * 1000 - 1);
    expect(session.cached).toBe(true);

    session.update(1);
    expect(session.cached).toBe(false);
  });

  it('restarts the timer instead of stacking', () => {
    const session = newSession();
    session.cast('cache');
    session.update(4000);
    session.cast('cache');

    session.update(config.spells.cache.seconds * 1000);
    expect(session.cached).toBe(false);
  });

  it('scales points without touching the combo', () => {
    const session = newSession();
    session.multiplier = 3;
    session.enemies = [enemy('ab')];
    session.cast('cache');

    type(session, 'ab');

    expect(session.multiplier).toBe(3);
    expect(session.score).toBe(2 * config.pointsPerLetter * 3 * config.spells.cache.scoreScale);
  });
});

describe('abilities', () => {
  const { ultimate } = config.classes.devops;
  const devops = () => newSession(() => 0, 'normal', 'devops');
  // One enemy per word: each is typed in full before the next one spawns.
  const perfectWord = (session: GameSession, word = 'sit') => {
    session.enemies.push(enemy(word));
    type(session, word);
  };

  it('charges the ultimate one step per perfect word, up to its cap', () => {
    const session = devops();

    for (let i = 0; i < ultimate.chargeWords - 1; i++) perfectWord(session);
    expect(session.ultimateCharge).toBe(ultimate.chargeWords - 1);
    expect(session.ultimateReady).toBe(false);

    perfectWord(session);
    perfectWord(session);
    expect(session.ultimateCharge).toBe(ultimate.chargeWords);
    expect(session.ultimateReady).toBe(true);
  });

  it('charges the ultimate over time too, up to its cap', () => {
    const session = devops();

    session.update(ultimate.chargeSeconds * 1000);
    expect(session.ultimateCharge).toBeCloseTo(1);

    session.update(ultimate.chargeSeconds * ultimate.chargeWords * 1000);
    expect(session.ultimateCharge).toBe(ultimate.chargeWords);
    expect(session.ultimateReady).toBe(true);
  });

  it('perfect words still charge faster than waiting', () => {
    const session = devops();

    perfectWord(session);
    session.update(1000);
    expect(session.ultimateCharge).toBeLessThan(2);
    expect(session.ultimateCharge).toBeCloseTo(1 + 1 / ultimate.chargeSeconds);
  });

  it('does not charge the ultimate on a flawed word', () => {
    const session = devops();
    session.enemies = [enemy('sit')];

    type(session, 'z');
    session.eraseLetter();
    type(session, 'sit');

    expect(session.ultimateCharge).toBe(0);
  });

  it('ignores the freeze command until the ultimate is charged', () => {
    const session = devops();

    const results = type(session, ultimate.command);

    expect(results.every((result) => result.kind === 'typo')).toBe(true);
    expect(session.frozen).toBe(false);
  });

  it('casts freeze when the charged devops types its command', () => {
    const session = devops();
    session.ultimateCharge = ultimate.chargeWords;

    const results = type(session, ultimate.command);
    const last = results[results.length - 1];

    expect(results.slice(0, -1).every((result) => result.kind === 'progress')).toBe(true);
    expect(last).toEqual({ kind: 'ability', ability: 'ultimate', cast: { spell: 'freeze' } });
    expect(session.frozen).toBe(true);
    expect(session.ultimateCharge).toBe(0);
    expect(session.typed).toBe('');
  });

  it('keeps typing a command as progress even when no demon matches it', () => {
    const session = devops();
    session.ultimateCharge = ultimate.chargeWords;
    session.enemies = [enemy('sit')];
    const partial = ultimate.command.slice(0, 3);

    const results = type(session, partial);

    expect(results.every((result) => result.kind === 'progress')).toBe(true);
    expect(session.typed).toBe(partial);
  });

  it('leaves the score, the combo and the streak alone when a command is typed', () => {
    const session = devops();
    session.ultimateCharge = ultimate.chargeWords;
    session.score = 50;
    session.multiplier = 3;
    session.streak = 2;

    type(session, ultimate.command);

    expect(session.score).toBe(50);
    expect(session.multiplier).toBe(3);
    expect(session.streak).toBe(2);
  });

  it('gives junior the snippet ultimate, so the devops freeze command is a typo', () => {
    const session = newSession(() => 0, 'normal', 'junior');
    session.ultimateCharge = config.classes.junior.ultimate.chargeWords;

    const results = type(session, ultimate.command);

    expect(session.readyAbilities.map((ability) => ability.command)).toEqual(['tab', 'snippet']);
    expect(results.every((result) => result.kind === 'typo')).toBe(true);
    expect(session.frozen).toBe(false);
  });

  it('never lets a command share a prefix with a lorem word', () => {
    const roles: { tint: number; skill?: { command: string }; ultimate?: { command: string } }[] =
      Object.values(config.classes);
    const commands = roles
      .flatMap((role) => [role.skill?.command, role.ultimate?.command])
      .filter((command) => command !== undefined);

    expect(commands).toContain(ultimate.command);
    for (const command of commands) {
      for (const word of loremWords) expect(sharesPrefix(command, word)).toBe(false);
    }
  });

  it('throttles every demon to its slow speed for the configured time', () => {
    const session = devops();
    const demon = enemy('ab', { speed: 50, distance: 1000 });
    session.enemies = [demon];
    const { speedScale, seconds } = config.spells.throttle;

    type(session, config.classes.devops.skill.command);
    const start = demon.distance;
    session.update(1000);
    expect(demon.distance).toBeCloseTo(start - 50 * speedScale);

    session.update(seconds * 1000 - 1000);
    expect(demon.distance).toBeCloseTo(start - 50 * speedScale * seconds);

    session.update(1000);
    expect(demon.distance).toBeCloseTo(start - 50 * speedScale * seconds - 50);
  });

  it('puts the skill on cooldown after use and makes it typable again when it ends', () => {
    const { skill } = config.classes.devops;
    const session = devops();
    type(session, skill.command);
    expect(session.skillReady).toBe(false);
    // Typed during the cooldown it is a typo, not a cast.
    expect(type(session, skill.command)[0].kind).toBe('typo');

    const later = devops();
    type(later, skill.command);
    later.update(skill.cooldownSeconds * 1000);
    expect(later.skillReady).toBe(true);
    expect(type(later, skill.command).at(-1)?.kind).toBe('ability');
  });

  it('tab completes the closest demon next word and keeps that demon alive while words remain', () => {
    const { skill } = config.classes.junior;
    const session = newSession(() => 0, 'normal', 'junior');
    const near = enemy('sit', { words: ['sit', 'dolor'], distance: 10 });
    const far = enemy('cat', { id: 101, distance: 200 });
    session.enemies = [far, near];
    const multiplier = session.multiplier;

    expect(type(session, skill.command).at(-1)).toMatchObject({
      kind: 'ability',
      ability: 'skill',
      cast: { spell: 'tab', killed: false },
    });
    expect(near.words).toEqual(['dolor']);
    expect(far.words).toEqual(['cat']);
    expect(session.enemies).toHaveLength(2);
    expect(session.score).toBe(3 * config.pointsPerLetter * multiplier);
    expect(session.skillReady).toBe(false);
  });

  it('tab kills a demon on its last word and casts its carried spell', () => {
    const { skill } = config.classes.junior;
    const session = newSession(() => 0, 'normal', 'junior');
    session.enemies = [enemy('sit', { spell: 'cache' })];

    expect(type(session, skill.command).at(-1)).toMatchObject({
      kind: 'ability',
      cast: { spell: 'tab', killed: true, carried: { spell: 'cache' } },
    });
    expect(session.enemies).toEqual([]);
    expect(session.cached).toBe(true);
  });

  it('tab with no demon on screen casts nothing but still starts its cooldown', () => {
    const { skill } = config.classes.junior;
    const session = newSession(() => 0, 'normal', 'junior');

    expect(type(session, skill.command).at(-1)).toEqual({
      kind: 'ability',
      ability: 'skill',
      cast: { spell: 'tab' },
    });
    expect(session.score).toBe(0);
    expect(session.skillReady).toBe(false);
  });

  it('snippet kills the closest demon after its first letters, scoring only the letters left', () => {
    const session = newSession(() => 0, 'normal', 'junior');
    const near = enemy('lorem', { words: ['lorem', 'dolor'], distance: 10 });
    const far = enemy('cat', { id: 101, distance: 200 });
    session.enemies = [far, near];
    const multiplier = session.multiplier;
    session.cast('snippet');

    expect(type(session, 'lo').at(-1)).toMatchObject({ kind: 'kill', enemy: near });
    expect(session.enemies).toEqual([far]);
    expect(session.score).toBe(3 * config.pointsPerLetter * multiplier);
  });

  it('snippet leaves one and two letter words to be typed in full', () => {
    const session = newSession(() => 0, 'normal', 'junior');
    const demon = enemy('ab');
    session.enemies = [demon];
    const multiplier = session.multiplier;
    session.cast('snippet');

    expect(type(session, 'ab').at(-1)).toMatchObject({ kind: 'kill', enemy: demon });
    expect(session.score).toBe(2 * config.pointsPerLetter * multiplier);
  });

  it('after the snippet window two letters only progress', () => {
    const session = newSession(() => 0, 'normal', 'junior');
    session.cast('snippet');
    session.update(config.spells.snippet.seconds * 1000);
    const demon = enemy('lorem');
    session.enemies = [demon];

    expect(type(session, 'lo').at(-1)).toEqual({ kind: 'progress' });
    expect(session.enemies).toEqual([demon]);
    expect(demon.words).toEqual(['lorem']);
  });

  it('a ready command wins over the snippet when the buffer is its prefix', () => {
    const session = newSession(() => 0, 'normal', 'junior');
    const demon = enemy('tango');
    session.enemies = [demon];
    session.cast('snippet');

    expect(type(session, 'ta').at(-1)).toEqual({ kind: 'progress' });
    expect(session.enemies).toEqual([demon]);
  });

  it('lets freeze stop demons even while throttled', () => {
    const session = devops();
    const demon = enemy('ab', { speed: 50 });
    session.enemies = [demon];
    const start = demon.distance;

    session.cast('throttle');
    session.cast('freeze');
    session.update(1000);
    expect(demon.distance).toBe(start);
  });

  const dba = () => newSession(() => 0, 'normal', 'dba');

  it("cuts the configured letters from the end of every demon's next word", () => {
    const session = dba();
    const { letters } = config.spells.truncate;
    session.enemies = [enemy('dolore'), enemy('sit', { id: 101, distance: 200 })];

    session.cast('truncate');

    expect(session.enemies[0].words).toEqual(['dolore'.slice(0, -letters)]);
    expect(session.enemies[1].words).toEqual(['sit'.slice(0, -letters)]);
  });

  it('never cuts a word below one letter', () => {
    const session = dba();
    session.enemies = [enemy('ut')];

    session.cast('truncate');
    session.cast('truncate');

    expect(session.enemies[0].words).toEqual(['u']);
  });

  it('keeps the word being typed longer than the buffer', () => {
    const session = dba();
    session.enemies = [enemy('dolore')];
    type(session, 'dolo');

    session.cast('truncate');

    expect(session.enemies[0].words[0]).toBe('dolor');
    expect(session.enemies[0].words[0].startsWith(session.typed)).toBe(true);
  });

  it('never leaves two demons whose words share a prefix', () => {
    const session = dba();
    session.enemies = [enemy('labore'), enemy('laboris', { id: 101, distance: 200 })];

    session.cast('truncate');

    const [near, far] = session.enemies.map((demon) => demon.words[0]);
    expect(sharesPrefix(near, far)).toBe(false);
  });

  it('trims a dangling space on hell phrases', () => {
    const session = newSession(() => 0, 'hell', 'dba');
    session.enemies = [enemy('sit ut')];

    session.cast('truncate');

    expect(session.enemies[0].words[0]).toBe('sit');
  });

  it('leaves later words alone', () => {
    const session = dba();
    session.enemies = [enemy('dolore', { words: ['dolore', 'sit'] })];

    session.cast('truncate');

    expect(session.enemies[0].words).toEqual(['dolo', 'sit']);
  });

  it('puts truncate on cooldown', () => {
    const session = dba();
    const { skill } = config.classes.dba;

    type(session, skill.command);

    expect(session.skillReady).toBe(false);
    expect(type(session, skill.command)[0].kind).toBe('typo');
  });

  it('drops every demon and scores their letters without the multiplier', () => {
    const session = dba();
    session.enemies = [enemy('sit'), enemy('amet', { id: 101, words: ['amet', 'id'] })];
    session.multiplier = 3;
    session.cast('cache');

    session.cast('drop');

    expect(session.enemies).toEqual([]);
    expect(session.score).toBe(9 * config.pointsPerLetter);
  });

  it('leaves the combo alone when dropping', () => {
    const session = dba();
    session.enemies = [enemy('sit')];
    session.multiplier = 3;
    session.streak = 2;

    session.cast('drop');

    expect(session.multiplier).toBe(3);
    expect(session.streak).toBe(2);
  });

  it('casts none of the dropped demons spells', () => {
    const session = dba();
    session.enemies = [enemy('sit', { spell: 'patch' })];
    session.lives = 1;

    session.cast('drop');

    expect(session.lives).toBe(1);
  });

  it('empties the typed buffer', () => {
    const session = dba();
    session.enemies = [enemy('sit')];
    type(session, 'si');

    session.cast('drop');

    expect(session.typed).toBe('');
  });

  const cto = () => newSession(() => 0, 'normal', 'cto');

  it('pushes every demon back by the configured distance', () => {
    const session = cto();
    session.enemies = [
      enemy('sit', { distance: 50 }),
      enemy('amet', { id: 101, words: ['amet'], distance: 60 }),
    ];

    session.cast('pushback');

    const { pixels } = config.spells.pushback;
    expect(session.enemies.map((state) => state.distance)).toEqual([50 + pixels, 60 + pixels]);
  });

  it('never pushes a demon past the edge it came from', () => {
    const session = cto();
    session.enemies = [
      enemy('sit', { distance: halfWidth }),
      enemy('amet', { id: 101, words: ['amet'], distance: halfWidth - 10 }),
    ];

    session.cast('pushback');

    expect(session.enemies.map((state) => state.distance)).toEqual([halfWidth, halfWidth]);
  });

  it('puts pushback on cooldown', () => {
    const session = cto();
    const { skill } = config.classes.cto;

    type(session, skill.command);

    expect(session.skillReady).toBe(false);
    expect(type(session, skill.command)[0].kind).toBe('typo');
  });

  it('shortens every demon on screen to a short word for the window', () => {
    const session = cto();
    session.enemies = [enemy('consectetur'), enemy('adipiscing', { id: 101 })];

    session.cast('descope');

    expect(session.enemies.map((state) => state.descoped)).toEqual(['con', 'adi']);
  });

  it('kills a demon whose short word is typed, whatever words it had left', () => {
    const session = cto();
    session.enemies = [enemy('consectetur', { words: ['consectetur', 'amet'] })];
    session.cast('descope');

    const results = type(session, 'con');

    expect(results[2].kind).toBe('kill');
    expect(session.enemies).toEqual([]);
  });

  it('keeps short words free of shared prefixes', () => {
    const session = cto();
    session.enemies = [enemy('dolor'), enemy('dolce', { id: 101 })];

    session.cast('descope');

    const [first, second] = session.enemies.map((state) => state.descoped ?? '');
    expect(sharesPrefix(first, second)).toBe(false);
    expect(sharesPrefix(first, 'dolce')).toBe(false);
    expect(sharesPrefix(second, 'dolor')).toBe(false);
  });

  it('keeps the word being typed longer than the buffer', () => {
    const session = cto();
    session.enemies = [enemy('consectetur')];
    session.typed = 'cons';

    session.cast('descope');

    const short = session.enemies[0].descoped ?? '';
    expect(short.length).toBeGreaterThanOrEqual(5);
    expect(short.startsWith('cons')).toBe(true);
  });

  it('brings the full words back when the window ends', () => {
    const session = cto();
    session.enemies = [enemy('consectetur')];
    session.cast('descope');

    const { undescoped } = session.update(config.spells.descope.seconds * 1000);

    expect(undescoped.map((state) => state.id)).toEqual([100]);
    expect(session.enemies[0].descoped).toBeUndefined();
  });

  it('leaves demons spawned during the window alone', () => {
    const session = cto();
    session.enemies = [];
    session.cast('descope');

    const { spawned } = session.update(1);

    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((state) => state.descoped === undefined)).toBe(true);
  });

  it('uses the first word of a hell phrase', () => {
    const session = cto();
    session.enemies = [enemy('dolor sit amet')];

    session.cast('descope');

    expect(session.enemies[0].descoped).toBe('dol');
  });
});
