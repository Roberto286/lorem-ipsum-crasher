import * as Phaser from 'phaser';
import { config } from '../config';
import { addText } from './ui';

export type LetterHandler = (letter: string) => void;

const keyRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export const virtualKeyboardHeight = keyRows.length * config.virtualKeyHeight;

export function listenForKeys(
  scene: Phaser.Scene,
  onLetter: LetterHandler,
  onPause: () => void,
): void {
  // Native listener: Phaser's keyboard plugin re-dispatches earlier keys when several key events
  // land in one frame, which types phantom letters on slow frames.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.key === 'Escape') onPause();
    else if (/^[a-z]$/i.test(event.key)) onLetter(event.key.toLowerCase());
  };
  window.addEventListener('keydown', onKeyDown);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    window.removeEventListener('keydown', onKeyDown),
  );
}

/** On-screen keys for touch devices: the OS keyboard would cover half of the game. */
export function addVirtualKeyboard(
  scene: Phaser.Scene,
  top: number,
  onLetter: LetterHandler,
): void {
  const keyWidth = scene.scale.width / keyRows[0].length;
  keyRows.forEach((row, rowIndex) => {
    const left = (scene.scale.width - row.length * keyWidth) / 2;
    [...row].forEach((letter, index) => {
      const x = left + (index + 0.5) * keyWidth;
      const y = top + (rowIndex + 0.5) * config.virtualKeyHeight;
      scene.add
        .rectangle(x, y, keyWidth - 2, config.virtualKeyHeight - 2, config.colors.key)
        .setInteractive()
        .on('pointerdown', () => onLetter(letter));
      addText(scene, x, y, letter.toUpperCase());
    });
  });
}
