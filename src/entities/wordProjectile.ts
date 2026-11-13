import * as Phaser from 'phaser';
import { config } from '../config';
import { addText } from '../utils/ui';

interface Point {
  x: number;
  y: number;
}

/** Hurls a typed word, spinning, from one point at a target, then calls onHit. */
export function hurlWord(
  scene: Phaser.Scene,
  word: string,
  from: Point,
  target: Point,
  onHit: () => void,
): void {
  const text = addText(scene, from.x, from.y, word, { color: config.colors.accent });
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: config.projectile.flightMs,
    ease: 'Quad.easeIn',
    onUpdate: (tween) => {
      const progress = tween.getValue() ?? 0;
      // The target is read every frame: the demon keeps walking while the word flies.
      text.setPosition(
        Phaser.Math.Linear(from.x, target.x, progress),
        Phaser.Math.Linear(from.y, target.y, progress),
      );
      text.setRotation(progress * config.projectile.spins * Math.PI * 2);
    },
    onComplete: () => {
      text.destroy();
      onHit();
    },
  });
}
