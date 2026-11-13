import * as Phaser from 'phaser';
import { config } from '../config';
import type { EnemyState } from '../utils/gameSession';
import { addText } from '../utils/ui';

/** Animation per number of words left: a demon shrinks as its words are shot off. */
const demonKeys = ['imp', 'chort', 'bigDemon'];

export class Enemy {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    state: EnemyState,
  ) {
    this.sprite = scene.add.sprite(0, 0, demonKeys[0]).setDepth(config.depths.enemy);
    // The art faces right: flip the demons that walk in from the right.
    this.sprite.setFlipX(Math.cos(state.angle) > 0);
    this.label = addText(scene, 0, 0, '', {
      backgroundColor: config.colors.labelBackground,
      padding: { x: 2, y: 2 },
    })
      .setOrigin(0.5, 1)
      .setDepth(config.depths.enemyLabel);
    this.setWords(state.words);
  }

  /** Remaining texts, one per line: the top one is typed next. */
  setWords(words: string[]): void {
    // Counted across phrases too, so a three-word phrase is still a big demon.
    const wordCount = words.join(' ').split(' ').length;
    this.sprite.play(demonKeys[Math.min(wordCount, demonKeys.length) - 1]);
    this.label.setText(words.join('\n'));
  }

  /** The label is clamped inside the play area so the words are readable from the spawn edge. */
  moveTo(x: number, y: number, playWidth: number, playHeight: number): void {
    const halfWidth = this.label.width / 2;
    const labelBottom = y - this.sprite.height / 2 - config.enemy.labelGap;
    this.sprite.setPosition(x, y);
    this.label.setPosition(
      Phaser.Math.Clamp(x, halfWidth, playWidth - halfWidth),
      Phaser.Math.Clamp(labelBottom, this.label.height, playHeight),
    );
  }

  /** Marks an enemy that got faster after a typo on its word. */
  enrage(): void {
    this.label.setColor(config.colors.enraged);
  }

  vanish(): void {
    this.scene.tweens.add({
      targets: [this.sprite, this.label],
      alpha: 0,
      scale: 2,
      duration: config.enemy.vanishMs,
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    this.sprite.destroy();
    this.label.destroy();
  }
}
