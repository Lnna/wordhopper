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
import { audioSystem } from '../systems/AudioSystem';

const BW = Math.round(PLAYER_WIDTH * PLAYER_COLLISION_SHRINK);
const BH = Math.round(PLAYER_HEIGHT * PLAYER_COLLISION_SHRINK);

export class Player {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private dead = false;
  private busy = false;
  private baseScaleX = 1;
  private baseScaleY = 1;
  private dodgeDone: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.sprite = scene.add.sprite(PLAYER_X, PLAYER_Y, SPRITE_KEYS.PLAYER_RUN);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);
    this.sprite.setDepth(20);
    this.sprite.setAngle(-10);
    this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM);
    this.baseScaleX = this.sprite.scaleX;
    this.baseScaleY = this.sprite.scaleY;
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

  /** 落地尘土：4 个浅绿小点从脚下向两侧扩散淡出 */
  private spawnDust(): void {
    const g = this.scene.add.graphics().setDepth(19);
    g.fillStyle(0xd1fae5, 0.9);
    g.fillCircle(-10, 0, 3);
    g.fillCircle(-4, -2, 2.4);
    g.fillCircle(4, -2, 2.4);
    g.fillCircle(10, 0, 3);
    g.setPosition(this.sprite.x, PLAYER_Y - 2);
    this.scene.tweens.add({
      targets: g,
      scaleX: 1.9,
      scaleY: 1.5,
      y: PLAYER_Y - 12,
      alpha: 0,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  /** 恢复奔跑体态（躲避落地后原地跑、等待障碍通过） */
  private resumeRun(): void {
    if (this.dead) return;
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_RUN);
    this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM, true);
  }

  /** Inside window: dodge left/right; returns only when returnFromDodge() is called (obstacle passed) */
  clearJump(direction: -1 | 1, onDodged: () => void, onDone: () => void): void {
    if (this.dead || this.busy) return;
    this.busy = true;
    this.dodgeDone = onDone;
    this.sprite.stop();
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_JUMP);

    const targetX = PLAYER_X + direction * PLAYER_DODGE_OFFSET;
    const lean = -10 + direction * 24;

    // 1) 蓄力下蹲（挤压）
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.baseScaleX * 1.15,
      scaleY: this.baseScaleY * 0.8,
      y: PLAYER_Y + 4,
      duration: 70,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // 2) 侧向跃出：x 爆发式弹出 + 重力弧线 + 倾斜 + 拉伸
        this.scene.tweens.add({
          targets: this.sprite,
          x: targetX,
          angle: lean,
          scaleX: this.baseScaleX * 0.92,
          scaleY: this.baseScaleY * 1.1,
          duration: 200,
          ease: 'Cubic.easeOut',
        });
        this.scene.tweens.add({
          targets: this.sprite,
          y: PLAYER_Y - 46,
          duration: 130,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.scene.tweens.add({
              targets: this.sprite,
              y: PLAYER_Y,
              duration: 110,
              ease: 'Quad.easeIn',
              onComplete: () => {
                // 3) 侧移落地：尘土 + 落地音，体态回弹后原地奔跑等待障碍通过（不再定格）
                this.spawnDust();
                audioSystem.play('land');
                this.scene.tweens.add({
                  targets: this.sprite,
                  scaleX: this.baseScaleX,
                  scaleY: this.baseScaleY,
                  angle: -10,
                  duration: 130,
                  ease: 'Back.easeOut',
                });
                this.resumeRun();
                onDodged();
              },
            });
          },
        });
      },
    });
  }

  /** Called when the cleared obstacle has fully passed below the player's feet */
  returnFromDodge(): void {
    if (this.dead || !this.busy) return;
    const dirHome = (Math.sign(PLAYER_X - this.sprite.x) || 1) as -1 | 1;
    // 4) 跑回中路：保持奔跑动画，身体向回跑方向倾斜，小跨步起伏（不再滑行）
    this.scene.tweens.add({
      targets: this.sprite,
      x: PLAYER_X,
      angle: -10 + dirHome * 12,
      duration: 200,
      ease: 'Cubic.easeInOut',
    });
    this.scene.tweens.add({
      targets: this.sprite,
      y: PLAYER_Y - 16,
      duration: 100,
      ease: 'Sine.easeOut',
      yoyo: true,
    });
    // 5) 落地：尘土 + 落地音，挤压再回弹
    this.scene.time.delayedCall(210, () => {
      if (this.dead) return;
      this.spawnDust();
      audioSystem.play('land');
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: this.baseScaleX * 1.1,
        scaleY: this.baseScaleY * 0.86,
        angle: -10,
        duration: 70,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: this.sprite,
            scaleX: this.baseScaleX,
            scaleY: this.baseScaleY,
            duration: 120,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.sprite.y = PLAYER_Y;
              this.busy = false;
              this.resumeRun();
              const cb = this.dodgeDone;
              this.dodgeDone = null;
              cb?.();
            },
          });
        },
      });
    });
  }

  die(): void {
    this.dead = true;
    this.busy = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.stop();
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_DEAD);
    this.sprite.setAngle(-10);
    this.sprite.setScale(this.baseScaleX, this.baseScaleY);
    this.sprite.y = PLAYER_Y;
  }

  reset(): void {
    this.dead = false;
    this.busy = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setPosition(PLAYER_X, PLAYER_Y);
    this.sprite.setAngle(-10);
    this.sprite.setScale(this.baseScaleX, this.baseScaleY);
    this.sprite.setTexture(SPRITE_KEYS.PLAYER_RUN);
    this.sprite.play(SPRITE_KEYS.PLAYER_RUN_ANIM);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
