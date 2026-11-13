import * as Phaser from 'phaser';
import { config } from '../config';
import { addText } from '../utils/ui';

export class Enemy {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    word: string,
  ) {
    this.sprite = scene.add.image(0, 0, 'demon').setDepth(config.depths.enemy);
    this.label = addText(scene, 0, 0, word, {
      backgroundColor: config.colors.labelBackground,
      padding: { x: 2, y: 2 },
    }).setDepth(config.depths.enemy);
  }

  /** The label is clamped inside the play area so the word is readable from the spawn edge. */
  moveTo(x: number, y: number, playWidth: number, playHeight: number): void {
    const halfWidth = this.label.width / 2;
    const halfHeight = this.label.height / 2;
    this.sprite.setPosition(x, y);
    this.label.setPosition(
      Phaser.Math.Clamp(x, halfWidth, playWidth - halfWidth),
      Phaser.Math.Clamp(y - config.enemy.labelOffset, halfHeight, playHeight - halfHeight),
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
