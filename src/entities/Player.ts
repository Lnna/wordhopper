import Phaser from 'phaser';
import {
  PLAYER_X,
  PLAYER_Y,
  PLAYER_DODGE_OFFSET,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_COLLISION_SHRINK,
  SPRITE_KEYS,
} from '../config/constants';

const BW = Math.round(PLAYER_WIDTH * PLAYER_COLLISION_SHRINK);
const BH = Math.round(PLAYER_HEIGHT * PLAYER_COLLISION_SHRINK);

export class Player {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private dead = false;
  private busy = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.sprite = scene.add.sprite(PLAYER_X, PLAYER_Y, SPRITE_KEYS.PLAYER_RUN);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);
    this.sprite.setDepth(20);
    this.sprite.setAngle(-10);
    this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM);
  }

  update(): void {
    if (this.dead || this.busy) return;
    if (!this.sprite.anims.isPlaying || this.sprite.texture.key !== SPRITE_KEYS.PLAYER_RUN) {
      this.sprite.setTexture(SPRITE_KEYS.PLAYER_RUN);
      this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM, true);
    }
  }

  getHitbox(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.sprite.x - BW / 2,
      this.sprite.y - BH,
      BW,
      BH
    );
  }

  isBusy(): boolean {
    return this.busy;
  }

  /** Outside timing window: small in-place hop */
  emptyHop(): void {
    if (this.dead || this.busy) return;
    this.busy = true;
    this.sprite.stop();
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_JUMP);
    this.scene.tweens.add({
      targets: this.sprite,
      y: PLAYER_Y - 28,
      duration: 140,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.sprite.y = PLAYER_Y;
        this.busy = false;
        if (!this.dead) {
          this.sprite.setTexture(SPRITE_KEYS.PLAYER_RUN);
          this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM, true);
        }
      },
    });
  }

  /** Inside window: dodge left/right past the obstacle */
  clearJump(direction: -1 | 1, onDodged: () => void, onDone: () => void): void {
    if (this.dead || this.busy) return;
    this.busy = true;
    this.sprite.stop();
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_JUMP);
    const targetX = PLAYER_X + direction * PLAYER_DODGE_OFFSET;
    this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        onDodged();
        this.scene.tweens.add({
          targets: this.sprite,
          x: PLAYER_X,
          duration: 260,
          ease: 'Cubic.easeInOut',
          onComplete: () => {
            this.busy = false;
            if (!this.dead) {
              this.sprite.setTexture(SPRITE_KEYS.PLAYER_RUN);
              this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM, true);
            }
            onDone();
          },
        });
      },
    });
  }

  die(): void {
    this.dead = true;
    this.busy = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.stop();
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_DEAD);
    this.sprite.y = PLAYER_Y;
  }

  reset(): void {
    this.dead = false;
    this.busy = false;
    this.sprite.setPosition(PLAYER_X, PLAYER_Y);
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_RUN);
    this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
