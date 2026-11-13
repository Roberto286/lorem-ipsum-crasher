import * as Phaser from 'phaser';

export class Player extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    // Origin on the body, not the frame: the laptop sticks out in front of it.
    this.setOrigin(0.4, 0.5).play('player');
  }

  /** Turns toward an enemy at this angle. Left or right only: the art is a side view. */
  face(angle: number): void {
    this.setFlipX(Math.cos(angle) < 0);
  }

  hurt(): void {
    this.scene.tweens.add({ targets: this, alpha: 0.2, duration: 80, yoyo: true, repeat: 2 });
  }
}
