import * as Phaser from 'phaser';

/**
 * Calls onKey with KeyboardEvent.key for every key press while the scene runs.
 *
 * Native listener: Phaser's keyboard plugin re-dispatches earlier keys when several key events
 * land in one frame, which types phantom letters on slow frames.
 */
export function listenForKeys(scene: Phaser.Scene, onKey: (key: string) => void): void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.repeat) onKey(event.key);
  };
  window.addEventListener('keydown', onKeyDown);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    window.removeEventListener('keydown', onKeyDown),
  );
}
