import * as Phaser from 'phaser';
import { config } from '../config';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** Centered text in the game font; long lines wrap inside the screen. */
export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      // Quoted: an unquoted family name with a word starting with a digit is invalid CSS.
      fontFamily: `"${config.font.family}"`,
      fontSize: `${config.font.size}px`,
      color: config.colors.text,
      align: 'center',
      lineSpacing: 4,
      wordWrap: { width: scene.scale.width - 16 },
      ...style,
    })
    .setOrigin(0.5);
}

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Text {
  // Padding widens the tap target beyond the 8px glyphs.
  return addText(scene, x, y, label, { padding: { x: 4, y: 6 } })
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', onClick);
}
