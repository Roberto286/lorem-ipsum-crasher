import * as Phaser from 'phaser';
import { config, type ClassKey } from '../config';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { hurlWord } from '../entities/wordProjectile';
import { GameSession, type Cast } from '../utils/gameSession';
import { t } from '../utils/i18n';
import { listenForKeys } from '../utils/keyboard';
import { layoutLabels } from '../utils/labelLayout';
import { saveScore } from '../utils/scoreStorage';
import { addButton, addText } from '../utils/ui';

/** Draws a GameSession and feeds it input; the rules live in the session. */
export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private readonly enemies = new Map<number, Enemy>();
  private player!: Player;
  private hud!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Text;
  private pausedText!: Phaser.GameObjects.Text;
  private typedBox!: Phaser.GameObjects.Rectangle;
  private typedText!: Phaser.GameObjects.Text;
  private drops!: Phaser.GameObjects.Text;
  private abilities!: Phaser.GameObjects.Text;
  // The play area is the band between the HUD strip and the bottom panel.
  private playTop = 0;
  private playHeight = 0;
  private paused = false;
  // Set while the resume countdown runs; the game stays paused until it ends.
  private resumeTimer?: Phaser.Time.TimerEvent;
  // Scene clock time each spawn sound last played; see config.enemy.spawnSoundGapMs.
  private readonly lastSpawnSoundAt = new Map<string, number>();

  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.playTop = config.hud.height;
    this.playHeight = height - config.typedBox.height - this.playTop;
    // Phaser reuses the scene instance on restart: reset what the previous run left behind.
    this.enemies.clear();
    this.paused = false;
    this.resumeTimer = undefined;
    this.lastSpawnSoundAt.clear();
    const heroClass: ClassKey = this.registry.get('heroClass');
    this.session = new GameSession(
      width / 2,
      this.playHeight / 2 + config.enemy.spawnBehindPanels,
      this.registry.get('level'),
      heroClass,
    );
    this.add.image(0, 0, 'backdrop').setOrigin(0).setDepth(config.depths.backdrop);
    this.player = new Player(
      this,
      width / 2,
      this.playTop + this.playHeight / 2,
      config.classes[heroClass].tint,
    );
    this.createHud();
    this.createBottomPanel();

    listenForKeys(this, (key) => {
      if (key === 'Escape') this.togglePause();
      else if (key === 'Backspace') this.handleBackspace();
      else if (/^[a-z ]$/i.test(key)) this.handleLetter(key.toLowerCase());
    });
    this.pauseOnFocusLoss();
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;

    const { spawned, reached, blocked } = this.session.update(delta);
    for (const state of spawned) {
      this.enemies.set(state.id, new Enemy(this, state));
      const enemyType = config.enemyTypes[state.type];
      if ('spawnSound' in enemyType) {
        const key = enemyType.spawnSound;
        const last = this.lastSpawnSoundAt.get(key);
        if (this.time.now - (last ?? -Infinity) >= config.enemy.spawnSoundGapMs) {
          this.sound.play(key);
          this.lastSpawnSoundAt.set(key, this.time.now);
        }
      }
    }
    for (const state of reached) this.removeEnemy(state.id)?.destroy();
    if (reached.length > blocked) this.showPlayerHit();
    else if (blocked > 0) {
      // The firewall took the demons: a flash, no hit.
      const color = Phaser.Display.Color.IntegerToRGB(config.spells.firewall.color);
      this.cameras.main.flash(config.spells.firewall.flashMs, color.r, color.g, color.b);
    }

    this.drawEnemies();
    this.drawHud();
    if (this.session.isOver) this.endRun();
  }

  private createHud(): void {
    const { width } = this.scale;
    const { height, padding } = config.hud;
    const centerY = height / 2;
    // Mute state lives in the registry: sound.mute reads the audio graph, which lags the setter
    // and never updates while the browser keeps the audio context locked.
    const soundLabel = () => t(this.registry.get('muted') ? 'soundOff' : 'soundOn');

    // Opaque backdrop: enemies coming from above stay hidden until they enter the play area.
    this.add.rectangle(width / 2, centerY, width, height, config.colors.panel);
    this.hud = addText(this, padding, centerY, '', { align: 'left' }).setOrigin(0, 0.5);
    const soundButton = addButton(this, width - padding, centerY, soundLabel(), () => {
      this.registry.toggle('muted');
      this.sound.mute = this.registry.get('muted');
      soundButton.setText(soundLabel());
      this.pauseButton.setX(soundButton.x - soundButton.width);
    });
    soundButton.setOrigin(1, 0.5);
    this.pauseButton = addButton(this, soundButton.x - soundButton.width, centerY, t('pause'), () =>
      this.togglePause(),
    ).setOrigin(1, 0.5);
    this.pausedText = addText(this, width / 2, this.playTop + this.playHeight / 4, t('paused'), {
      color: config.colors.accent,
      fontSize: `${config.font.titleSize}px`,
    }).setVisible(false);
  }

  private createBottomPanel(): void {
    const { width, height } = this.scale;
    const playBottom = this.playTop + this.playHeight;
    const panelHeight = height - playBottom;
    const boxCenterY = playBottom + config.typedBox.height / 2;

    // Opaque backdrop: enemies coming from below stay hidden until they enter the play area.
    this.add.rectangle(
      width / 2,
      playBottom + panelHeight / 2,
      width,
      panelHeight,
      config.colors.panel,
    );
    this.typedBox = this.add
      .rectangle(width / 2, boxCenterY, width - 8, config.typedBox.height - 6, config.colors.panel)
      .setStrokeStyle(1, config.colors.typedBoxBorder);
    this.typedText = addText(this, width / 2, boxCenterY, '', { color: config.colors.accent });
    // Right-aligned inside the box, 12 px in from its edge; the typed buffer stays centred.
    this.drops = addText(this, width - 12, boxCenterY, '', {
      color: config.colors.accent,
    }).setOrigin(1, 0.5);
    // The free left part of the box: ready commands, or the ultimate's charge while it builds.
    this.abilities = addText(this, 12, boxCenterY, '', { color: config.colors.dim }).setOrigin(
      0,
      0.5,
    );
  }

  private handleLetter(letter: string): void {
    if (this.paused) return;

    const result = this.session.typeLetter(letter);
    if (result.kind === 'kill' || result.kind === 'word') {
      const { kind, enemy: state, word } = result;
      if (result.kind === 'kill' && result.cast) this.showCast(result.cast);
      // A killed enemy has already left the session: its sprite waits for the word to land.
      const enemy = kind === 'kill' ? this.removeEnemy(state.id) : this.enemies.get(state.id);
      if (!enemy) return;
      enemy.highlight(0);
      hurlWord(this, word, this.player, enemy.sprite, () => {
        // Gone already if it reached the player while the word was flying.
        if (!enemy.sprite.active) return;
        this.sound.play(kind === 'kill' ? config.enemyTypes[state.type].deathSound : 'kill');
        if (kind === 'kill') enemy.vanish();
        else enemy.setWords(state.words);
      });
    } else if (result.kind === 'typo') {
      this.sound.play('error');
    } else if (result.kind === 'error') {
      this.sound.play('error');
      if (result.enemy) this.enemies.get(result.enemy.id)?.enrage();
      this.typedBox.setFillStyle(config.colors.panelError);
      this.time.delayedCall(config.typedBox.errorFlashMs, () =>
        this.typedBox.setFillStyle(config.colors.panel),
      );
    } else if (result.kind === 'ability') {
      this.showCast(result.cast);
      this.sound.play('kill');
    }
  }

  /** Shows a spell that the session has already applied. */
  private showCast(cast: Cast): void {
    if (cast.spell === 'patch' && cast.healed > 0) this.pulseHud();
  }

  private pulseHud(): void {
    const { pulseMs, pulseScale } = config.spells.patch;
    // A second patch during the pulse starts it over instead of piling the scales up.
    this.tweens.killTweensOf(this.hud);
    this.hud.setScale(1).setColor(config.colors.accent);
    this.tweens.add({
      targets: this.hud,
      scale: pulseScale,
      duration: pulseMs,
      yoyo: true,
      onComplete: () => this.hud.setColor(config.colors.text),
    });
  }

  private handleBackspace(): void {
    if (!this.paused) this.session.eraseLetter();
  }

  private removeEnemy(id: number): Enemy | undefined {
    const enemy = this.enemies.get(id);
    this.enemies.delete(id);
    return enemy;
  }

  private showPlayerHit(): void {
    this.player.hurt();
    this.cameras.main.shake(150, 0.01);
    this.sound.play('hurt');
  }

  private drawEnemies(): void {
    const { x: heroX, y: heroY } = this.player;
    const { target, matches, typed } = this.session;
    if (target) this.player.face(target.angle);
    // Closest first: the most urgent label keeps its natural spot, the others move around it.
    const demons = this.session.enemies
      .flatMap((state) => {
        const enemy = this.enemies.get(state.id);
        return enemy ? [{ state, enemy }] : [];
      })
      .sort((a, b) => a.state.distance - b.state.distance)
      .map(({ state, enemy }) => ({
        state,
        enemy,
        x: heroX + Math.cos(state.angle) * state.distance,
        y: heroY + Math.sin(state.angle) * state.distance,
      }));
    const hero = this.player.getBounds();
    const boxes = layoutLabels(
      demons.map(({ enemy, x, y }) => enemy.labelBox(x, y)),
      [{ left: hero.left, right: hero.right, top: hero.top, bottom: hero.bottom }],
      {
        left: 0,
        right: this.scale.width,
        top: this.playTop,
        bottom: this.playTop + this.playHeight,
      },
      config.enemy.labelSpacing,
    );
    demons.forEach(({ state, enemy, x, y }, i) => {
      enemy.moveTo(x, y, boxes[i]);
      enemy.highlight(matches.includes(state) ? typed.length : 0);
      enemy.setFrozen(this.session.frozen);
      enemy.setThrottled(this.session.throttled);
    });
  }

  private drawHud(): void {
    const {
      score,
      multiplier,
      lives,
      shield,
      forgiven,
      cached,
      elapsedMs,
      typed,
      target,
      typingCommand,
      readyAbilities,
      skillCommand,
      skillReady,
      skillCooldownSeconds,
      ultimateCommand,
      ultimateReady,
      ultimatePercent,
    } = this.session;
    // Red while the buffer holds a typo: nothing can be killed until it is erased.
    const typedColor =
      typed === '' || target || typingCommand ? config.colors.accent : config.colors.enraged;
    const status = [
      t('score', { value: score }),
      t('lives', { value: lives }),
      t('combo', { value: multiplier }),
      t('time', { value: Math.floor(elapsedMs / 1000) }),
    ];
    this.hud.setText(status.join('  '));
    const drops = [
      ...(shield > 0 ? [t('shield')] : []),
      ...(forgiven > 0 ? [t('linter')] : []),
      ...(cached ? [t('cache')] : []),
    ];
    this.drops.setText(drops.join(' '));
    // Two lines: the skill, then the ultimate. Each shows its command when ready, else its wait.
    const lines: string[] = [];
    if (skillCommand !== undefined) {
      lines.push(skillReady ? skillCommand : t('skillCooldown', { seconds: skillCooldownSeconds }));
    }
    if (ultimateCommand !== undefined && ultimatePercent !== undefined) {
      lines.push(
        ultimateReady ? ultimateCommand : t('ultimateCharge', { percent: ultimatePercent }),
      );
    }
    this.abilities.setText(lines.join('\n'));
    const abilitiesColor = readyAbilities.length > 0 ? config.colors.accent : config.colors.dim;
    if (this.abilities.style.color !== abilitiesColor) this.abilities.setColor(abilitiesColor);
    this.typedText.setText(typed);
    if (this.typedText.style.color !== typedColor) this.typedText.setColor(typedColor);
  }

  private togglePause(): void {
    if (this.paused && !this.resumeTimer) this.startResumeCountdown();
    else this.pause();
  }

  /** Also cancels a running resume countdown. */
  private pause(): void {
    this.resumeTimer?.remove();
    this.resumeTimer = undefined;
    this.paused = true;
    this.pausedText.setText(t('paused')).setVisible(true);
    this.pauseButton.setText(t('resume'));
    this.tweens.pauseAll();
  }

  // Scene clock, not a tween: tweens stay paused until the countdown ends.
  private startResumeCountdown(): void {
    let secondsLeft: number = config.pause.resumeCountdownSeconds;
    this.pausedText.setText(String(secondsLeft));
    // The button cancels the countdown, which pauses again.
    this.pauseButton.setText(t('pause'));
    this.resumeTimer = this.time.addEvent({
      delay: 1000,
      repeat: secondsLeft - 1,
      callback: () => {
        secondsLeft -= 1;
        if (secondsLeft > 0) this.pausedText.setText(String(secondsLeft));
        else this.resume();
      },
    });
  }

  private resume(): void {
    this.resumeTimer = undefined;
    this.paused = false;
    this.pausedText.setVisible(false);
    this.tweens.resumeAll();
  }

  private pauseOnFocusLoss(): void {
    const pause = () => this.pause();
    const { BLUR, HIDDEN } = Phaser.Core.Events;
    this.game.events.on(BLUR, pause).on(HIDDEN, pause);
    // game.events outlives the scene, and the scene instance is reused across runs.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(BLUR, pause).off(HIDDEN, pause),
    );
  }

  private endRun(): void {
    const run = { score: this.session.score, seconds: Math.floor(this.session.elapsedMs / 1000) };
    saveScore(this.registry.get('level'), this.registry.get('heroClass'), run);
    this.sound.play('gameOver');
    this.scene.start('MenuScene', run);
  }
}
