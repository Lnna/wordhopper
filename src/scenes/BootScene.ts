import Phaser from 'phaser';
import { applyRenderZoom } from '../config/display';
import { COLORS, FONT_DISPLAY, FONT_BODY } from '../config/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SPRITE_KEYS } from '../config/constants';
import { addCrispText } from '../config/text';
import { hex, darker, lighter } from '../config/utils';
import { parseShareParams } from './ShareCardScene';

function clayRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, color: number): void {
  g.fillStyle(darker(color, 0.4), 0.12);
  g.fillRoundedRect(x + 3, y + 3, w, h, r);
  g.fillStyle(darker(color, 0.2), 0.08);
  g.fillRoundedRect(x + 1.5, y + 1.5, w, h, r);
  g.fillStyle(color, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(lighter(color, 0.25), 0.3);
  g.fillRoundedRect(x + 3, y + 3, w - 6, h * 0.4, r / 2);
}

function clayCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number): void {
  g.fillStyle(darker(color, 0.4), 0.12);
  g.fillCircle(x + 3, y + 3, radius);
  g.fillStyle(darker(color, 0.2), 0.08);
  g.fillCircle(x + 1.5, y + 1.5, radius);
  g.fillStyle(color, 1);
  g.fillCircle(x, y, radius);
  g.fillStyle(lighter(color, 0.3), 0.25);
  g.fillCircle(x - radius * 0.25, y - radius * 0.3, radius * 0.5);
}

function clayEllipse(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(darker(color, 0.4), 0.12);
  g.fillEllipse(x + 3, y + 3, w, h);
  g.fillStyle(darker(color, 0.2), 0.08);
  g.fillEllipse(x + 1.5, y + 1.5, w, h);
  g.fillStyle(color, 1);
  g.fillEllipse(x, y, w, h);
  g.fillStyle(lighter(color, 0.3), 0.25);
  g.fillEllipse(x - w * 0.15, y - h * 0.2, w * 0.5, h * 0.45);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    applyRenderZoom(this);

    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;

    const bg = this.add.graphics();
    for (let y = 0; y < height; y++) {
      const t = y / height;
      const r = Math.round(0xEC * (1 - t) + 0xD1 * t);
      const g = Math.round(0xFD * (1 - t) + 0xFA * t);
      const b = Math.round(0xF5 * (1 - t) + 0xE5 * t);
      bg.fillStyle((r << 16) | (g << 8) | b);
      bg.fillRect(0, y, width, 1);
    }

    addCrispText(this, width / 2, height * 0.36, 'Word Hopper', {
      fontSize: '42px',
      fontFamily: FONT_DISPLAY,
      color: hex(COLORS.PRIMARY),
      fontStyle: 'bold',
      padding: { right: 8, left: 2, top: 2, bottom: 2 },
    }).setOrigin(0.5);

    const barWidth = width * 0.55;
    const barHeight = 14;
    const barX = (width - barWidth) / 2;
    const barY = height * 0.5;

    addCrispText(this, width / 2, barY - 22, '加载中...', {
      fontSize: '16px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_MUTED),
    }).setOrigin(0.5);

    const barTrack = this.add.graphics();
    barTrack.fillStyle(COLORS.MUTED_DARK, 0.5);
    barTrack.fillRoundedRect(barX, barY, barWidth, barHeight, 7);

    const bar = this.add.graphics();

    this.load.spritesheet(SPRITE_KEYS.PLAYER_RUN, 'assets/sprites/hamster-run.png', {
      frameWidth: 160,
      frameHeight: 160,
    });
    this.load.image(SPRITE_KEYS.PLAYER_JUMP, 'assets/sprites/hamster-jump.png');
    this.load.image(SPRITE_KEYS.PLAYER_DEAD, 'assets/sprites/hamster-dead.png');

    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(COLORS.PRIMARY, 1);
      if (value > 0) {
        bar.fillRoundedRect(barX, barY, barWidth * value, barHeight, 7);
      }
    });

    this.load.on('complete', () => {
      bar.destroy();
      barTrack.destroy();
      bg.destroy();
    });
  }

  create(): void {
    this.generateTextures();
    const shareData = parseShareParams();
    if (shareData) {
      this.scene.start('ShareCardScene', shareData);
    } else {
      this.scene.start('MenuScene');
    }
  }

  private generateTextures(): void {
    const g = this.add.graphics();
    this.generateSky(g);
    this.generateRoad(g);
    this.generateObstacles(g);
    g.destroy();

    if (!this.anims.exists(SPRITE_KEYS.PLAYER_RUN_ANIM)) {
      this.anims.create({
        key: SPRITE_KEYS.PLAYER_RUN_ANIM,
        frames: this.anims.generateFrameNumbers(SPRITE_KEYS.PLAYER_RUN, { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  private generateSky(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    const stops = [
      { t: 0.0, c: 0x86efac },
      { t: 0.35, c: 0xbbf7d0 },
      { t: 0.55, c: 0xecfdf5 },
      { t: 0.7, c: 0x15803d },
      { t: 1.0, c: 0x116530 },
    ];
    for (let y = 0; y < CANVAS_HEIGHT; y++) {
      const t = y / CANVAS_HEIGHT;
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].t && t <= stops[i + 1].t) {
          a = stops[i];
          b = stops[i + 1];
          break;
        }
      }
      const k = (t - a.t) / Math.max(0.0001, b.t - a.t);
      const ar = (a.c >> 16) & 255, ag = (a.c >> 8) & 255, ab = a.c & 255;
      const br = (b.c >> 16) & 255, bg = (b.c >> 8) & 255, bb = b.c & 255;
      const r = Math.round(ar + (br - ar) * k);
      const gv = Math.round(ag + (bg - ag) * k);
      const bl = Math.round(ab + (bb - ab) * k);
      g.fillStyle((r << 16) | (gv << 8) | bl);
      g.fillRect(0, y, CANVAS_WIDTH, 1);
    }
    g.generateTexture(SPRITE_KEYS.BG_SKY, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  private generateRoad(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    const w = 8;
    const period = 40;
    g.fillStyle(0x4ade80, 1);
    g.fillRect(0, 0, w, period);
    const limeR = 0x4a, limeG = 0xde, limeB = 0x80;
    const stripeR = Math.round(255 * 0.45 + limeR * 0.55);
    const stripeG = Math.round(255 * 0.45 + limeG * 0.55);
    const stripeB = Math.round(255 * 0.45 + limeB * 0.55);
    g.fillStyle((stripeR << 16) | (stripeG << 8) | stripeB, 1);
    g.fillRect(0, 0, w, 8);
    g.generateTexture(SPRITE_KEYS.BG_ROAD_STRIPES, w, period);
  }

  private generateObstacles(g: Phaser.GameObjects.Graphics): void {
    const TW = 56;
    const TH = 80;

    g.clear();
    clayEllipse(g, TW / 2, 16, 52, 30, COLORS.OBS_MUSHROOM_CAP);
    g.fillStyle(COLORS.OBS_MUSHROOM_SPOT, 1);
    g.fillEllipse(TW / 2 - 16, 10, 12, 8);
    g.fillEllipse(TW / 2 + 12, 20, 10, 7);
    g.fillEllipse(TW / 2 - 2, 26, 8, 6);
    g.fillStyle(COLORS.OBS_MUSHROOM_STEM, 1);
    g.fillRoundedRect(TW / 2 - 10, 30, 20, TH - 38, 7);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_MUSHROOM, TW, TH);

    g.clear();
    clayEllipse(g, TW / 2, 12, 46, 16, COLORS.OBS_STUMP);
    clayRect(g, TW / 2 - 18, 12, 36, TH - 22, 8, COLORS.OBS_STUMP);
    g.fillStyle(darker(COLORS.OBS_STUMP, 0.35), 0.6);
    g.fillEllipse(TW / 2, 12, 30, 8);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_STUMP, TW, TH);

    g.clear();
    clayCircle(g, TW / 2, 20, 18, COLORS.OBS_BUSH);
    clayCircle(g, TW / 2 - 18, 30, 20, COLORS.OBS_BUSH);
    clayCircle(g, TW / 2 + 16, 28, 18, COLORS.OBS_BUSH);
    g.fillStyle(COLORS.OBS_BUSH, 1);
    g.fillRoundedRect(TW / 2 - 22, 32, 44, TH - 40, 10);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_BUSH, TW, TH);

    g.clear();
    g.fillStyle(COLORS.GROUND_LIGHT, 0.5);
    g.fillRoundedRect(TW / 2 - 8, 20, 16, TH - 28, 6);
    drawFlower(g, TW / 2, 12, 10, COLORS.OBS_FLOWERS_CENTER);
    drawFlower(g, TW / 2 - 16, 24, 8, COLORS.OBS_FLOWERS_CENTER);
    drawFlower(g, TW / 2 + 14, 22, 8, COLORS.OBS_FLOWERS_CENTER);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_FLOWERS, TW, TH);

    g.clear();
    clayEllipse(g, TW / 2, TH / 2, 46, 34, COLORS.OBS_ROCK);
    clayEllipse(g, TW / 2 - 8, TH / 2 + 8, 28, 20, darker(COLORS.OBS_ROCK, 0.15));
    g.generateTexture(SPRITE_KEYS.OBSTACLE_ROCK, TW, TH);

    g.clear();
    clayRect(g, TW / 2 - 10, 18, 20, TH - 26, 8, COLORS.OBS_CACTUS);
    clayRect(g, TW / 2 - 22, 34, 14, 10, 5, COLORS.OBS_CACTUS);
    clayRect(g, TW / 2 + 8, 28, 14, 10, 5, COLORS.OBS_CACTUS);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_CACTUS, TW, TH);

    g.clear();
    clayRect(g, TW / 2 - 20, 20, 40, TH - 28, 6, COLORS.OBS_CRATE);
    g.lineStyle(2, darker(COLORS.OBS_CRATE, 0.3), 0.8);
    g.strokeRect(TW / 2 - 16, 26, 32, TH - 40);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_CRATE, TW, TH);

    g.clear();
    clayEllipse(g, TW / 2, 18, 36, 16, COLORS.OBS_BARREL);
    clayRect(g, TW / 2 - 16, 18, 32, TH - 28, 10, COLORS.OBS_BARREL);
    g.fillStyle(lighter(COLORS.OBS_BARREL, 0.2), 0.5);
    g.fillRect(TW / 2 - 14, 34, 28, 4);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_BARREL, TW, TH);

    g.clear();
    g.fillStyle(COLORS.OBS_STUMP, 1);
    g.fillRect(TW / 2 - 4, TH - 22, 8, 16);
    clayCircle(g, TW / 2, 28, 22, COLORS.OBS_PINE);
    clayCircle(g, TW / 2, 18, 16, COLORS.OBS_PINE);
    clayCircle(g, TW / 2, 10, 11, COLORS.OBS_PINE);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_PINE, TW, TH);

    g.clear();
    clayCircle(g, TW / 2, 28, 20, COLORS.OBS_BUSH);
    clayCircle(g, TW / 2 - 12, 22, 8, COLORS.OBS_BERRY);
    clayCircle(g, TW / 2 + 10, 18, 7, COLORS.OBS_BERRY);
    clayCircle(g, TW / 2 + 2, 30, 6, COLORS.OBS_BERRY);
    g.generateTexture(SPRITE_KEYS.OBSTACLE_BERRY, TW, TH);
  }
}

function drawFlower(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, centerColor: number): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    g.fillStyle(COLORS.OBS_FLOWERS, 1);
    g.fillCircle(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.4);
  }
  g.fillStyle(centerColor, 1);
  g.fillCircle(x, y, r * 0.32);
}
