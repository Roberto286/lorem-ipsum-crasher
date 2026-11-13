import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { difficultyAt } from '../src/utils/difficulty';
import { GameSession, type EnemyState } from '../src/utils/gameSession';

const halfWidth = 200;
const halfHeight = 100;
const newSession = (rng = () => 0) => new GameSession(halfWidth, halfHeight, rng);
// Ids start high so they never collide with enemies the session spawns itself.
const enemy = (word: string, overrides: Partial<EnemyState> = {}): EnemyState => ({
  id: 100,
  word,
  angle: 0,
  distance: 100,
  speed: 0,
  ...overrides,
});
const type = (session: GameSession, text: string) =>
  [...text].map((letter) => session.typeLetter(letter));

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
    const interval = difficultyAt(0).spawnIntervalMs;

    session.update(16);
    session.update(interval / 2);
    expect(session.enemies).toHaveLength(1);

    session.update(interval);
    expect(session.enemies).toHaveLength(2);
  });
});

describe('typing', () => {
  it('kills the enemy whose word is typed and scores its letters', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    const results = type(session, 'sit');

    expect(results.at(-1)).toEqual({ kind: 'kill', enemy: enemy('sit') });
    expect(session.enemies).toHaveLength(0);
    expect(session.score).toBe(3 * config.pointsPerLetter);
    expect(session.typed).toBe('');
  });

  it('keeps a matching prefix in the typed buffer', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    type(session, 'si');

    expect(session.typed).toBe('si');
  });

  it('clears the buffer on a typo so the word must be retyped from the start', () => {
    const session = newSession();
    session.enemies.push(enemy('sit'));

    expect(type(session, 'six').at(-1)?.kind).toBe('error');
    expect(session.typed).toBe('');

    expect(type(session, 't').at(-1)?.kind).toBe('error');
    expect(session.enemies).toHaveLength(1);

    expect(type(session, 'sit').at(-1)?.kind).toBe('kill');
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

  it('speeds up the targeted enemy on a typo', () => {
    const session = newSession();
    const target = enemy('sit', { id: 100, speed: 10 });
    const bystander = enemy('amet', { id: 101, speed: 10 });
    session.enemies.push(target, bystander);

    const result = type(session, 'sx').at(-1);

    expect(result).toEqual({ kind: 'error', enemy: target });
    expect(target.speed).toBe(10 * config.enemy.typoSpeedBoost);
    expect(bystander.speed).toBe(10);
  });

  it('speeds nobody up when the first letter matches no word', () => {
    const session = newSession();
    const idle = enemy('sit', { speed: 10 });
    session.enemies.push(idle);

    type(session, 'x');

    expect(idle.speed).toBe(10);
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
    expect(session.lives).toBe(config.player.lives - 1);
    expect(session.enemies.map((e) => e.id)).not.toContain(100);
  });

  it('take a half-typed buffer with them when no other word matches it', () => {
    const session = newSession();
    session.enemies.push(enemy('sit', { distance: 0 }));
    type(session, 'si');

    session.update(16);

    expect(session.typed).toBe('');
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
