import * as Phaser from 'phaser';

export class Player extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
  }

  hurt(): void {
    this.scene.tweens.add({ targets: this, alpha: 0.2, duration: 80, yoyo: true, repeat: 2 });
  }
}
