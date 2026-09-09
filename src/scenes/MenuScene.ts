import Phaser from 'phaser';
import { applyRenderZoom } from '../config/display';
import { CANVAS_WIDTH, CANVAS_HEIGHT, Difficulty, SPRITE_KEYS } from '../config/constants';
import { COLORS, FONT_DISPLAY, FONT_BODY } from '../config/colors';
import { addCrispText } from '../config/text';
import { hex, darker } from '../config/utils';
import { audioSystem } from '../systems/AudioSystem';

export class MenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'easy';
  private difficultyBtns: Record<Difficulty, Phaser.GameObjects.Container> = {} as Record<Difficulty, Phaser.GameObjects.Container>;
  private sfxBtn!: Phaser.GameObjects.Text;

  private static readonly DIFFICULTIES: Difficulty[] = ['chill', 'easy', 'medium', 'hard'];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    applyRenderZoom(this);
    this.selectedDifficulty = 'easy';
    this.difficultyBtns = {} as Record<Difficulty, Phaser.GameObjects.Container>;
    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;

    const bgGfx = this.add.graphics().setDepth(0);
    const stops = [
      { t: 0.0, c: 0x86efac },
      { t: 0.4, c: 0xbbf7d0 },
      { t: 0.7, c: 0xecfdf5 },
      { t: 1.0, c: 0xd1fae5 },
    ];
    for (let y = 0; y < height; y++) {
      const t = y / height;
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].t && t <= stops[i + 1].t) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const k = (t - a.t) / Math.max(0.0001, b.t - a.t);
      const ar = (a.c >> 16) & 255, ag = (a.c >> 8) & 255, ab = a.c & 255;
      const br = (b.c >> 16) & 255, bg = (b.c >> 8) & 255, bb = b.c & 255;
      const r = Math.round(ar + (br - ar) * k);
      const gv = Math.round(ag + (bg - ag) * k);
      const bl = Math.round(ab + (bb - ab) * k);
      bgGfx.fillStyle((r << 16) | (gv << 8) | bl);
      bgGfx.fillRect(0, y, width, 1);
    }

    const titleBg = this.add.graphics().setDepth(4);
    titleBg.fillStyle(COLORS.PRIMARY, 1);
    titleBg.fillRoundedRect(width / 2 - 140, 48, 280, 56, 16);

    addCrispText(this, width / 2, 76, 'Word Hopper', {
      fontSize: '36px',
      fontFamily: FONT_DISPLAY,
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    addCrispText(this, width / 2, 128, '点字母泡 · 时机起跳', {
      fontSize: '16px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_ON_LIGHT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    const liuY = 200;
    const liu = this.add.sprite(width / 2, liuY, SPRITE_KEYS.PLAYER_RUN);
    liu.setOrigin(0.5, 0.5);
    liu.setDisplaySize(96, 96);
    liu.setDepth(10);
    liu.play(SPRITE_KEYS.PLAYER_RUN_ANIM);

    const liuBg = this.add.graphics().setDepth(9);
    liuBg.fillStyle(0xecfdf5, 0.7);
    liuBg.fillEllipse(width / 2, liuY + 8, 130, 100);
    this.tweens.add({
      targets: liu,
      y: liuY - 8,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const difficulties: { key: Difficulty; label: string; desc: string }[] = [
      { key: 'chill', label: 'CHILL', desc: '3–5 字母 · 慢' },
      { key: 'easy', label: 'EASY', desc: '3–5 字母' },
      { key: 'medium', label: 'MEDIUM', desc: '6–8 字母' },
      { key: 'hard', label: 'HARD', desc: '8+ 字母' },
    ];

    const btnStartY = 300;
    const btnStepY = 52;

    difficulties.forEach(({ key, label, desc }, i) => {
      const yPos = btnStartY + i * btnStepY;
      const container = this.add.container(width / 2, yPos).setDepth(5);
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.MUTED_DARK, 0.75);
      bg.fillRoundedRect(-130, -20, 260, 40, 14);
      container.add(bg);

      const labelText = addCrispText(this, -110, 0, label, {
        fontSize: '16px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_ON_LIGHT),
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      container.add(labelText);

      const descText = addCrispText(this, 110, 0, desc, {
        fontSize: '13px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_MUTED),
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);
      container.add(descText);

      container.setSize(260, 40);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => {
        if (this.selectedDifficulty === key) {
          this.startGame();
        } else {
          this.selectedDifficulty = key;
          this.updateHighlight();
        }
      });
      this.difficultyBtns[key] = container;
    });

    const startY = btnStartY + difficulties.length * btnStepY + 20;
    const startGfx = this.add.graphics().setDepth(6);
    startGfx.fillStyle(0xD97706, 1);
    startGfx.fillRoundedRect(width / 2 - 100, startY, 200, 44, 16);
    startGfx.setInteractive(
      new Phaser.Geom.Rectangle(width / 2 - 100, startY, 200, 44),
      Phaser.Geom.Rectangle.Contains
    );
    startGfx.on('pointerdown', () => this.startGame());

    addCrispText(this, width / 2, startY + 22, '开始游戏', {
      fontSize: '18px',
      fontFamily: FONT_BODY,
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7);

    this.sfxBtn = addCrispText(this, width / 2, startY + 70, this.sfxLabel(), {
      fontSize: '14px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY_DARK),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7).setInteractive({ useHandCursor: true });    this.sfxBtn.on('pointerdown', () => {
      audioSystem.toggle();
      this.sfxBtn.setText(this.sfxLabel());
    });

    const best = this.readBest(this.selectedDifficulty);
    addCrispText(this, width / 2, height - 30, best > 0 ? `BEST ${best.toLocaleString()}` : '竖屏 · 单手指尖', {
      fontSize: '13px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY_DARK),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7);

    this.updateHighlight();
  }

  private sfxLabel(): string {
    return audioSystem.isEnabled() ? '音效：开' : '音效：关';
  }

  private readBest(difficulty: Difficulty): number {
    try {
      return parseInt(localStorage.getItem(`word-hopper-best-${difficulty}`) || '0', 10);
    } catch {
      return 0;
    }
  }

  private updateHighlight(): void {
    (Object.keys(this.difficultyBtns) as Difficulty[]).forEach((key) => {
      const container = this.difficultyBtns[key];
      const bg = container.getAt(0) as Phaser.GameObjects.Graphics;
      const labelText = container.getAt(1) as Phaser.GameObjects.Text;
      bg.clear();
      if (key === this.selectedDifficulty) {
        bg.fillStyle(COLORS.PRIMARY, 0.18);
        bg.fillRoundedRect(-130, -20, 260, 40, 14);
        bg.lineStyle(2.5, COLORS.PRIMARY, 0.85);
        bg.strokeRoundedRect(-130, -20, 260, 40, 14);
        labelText.setText('> ' + key.toUpperCase());
        labelText.setColor(hex(COLORS.PRIMARY));
      } else {
        bg.fillStyle(COLORS.MUTED_DARK, 0.75);
        bg.fillRoundedRect(-130, -20, 260, 40, 14);
        labelText.setText('  ' + key.toUpperCase());
        labelText.setColor(hex(COLORS.TEXT_ON_LIGHT));
      }
    });
  }

  private startGame(): void {
    this.scene.start('GameScene', { difficulty: this.selectedDifficulty });
  }
}
