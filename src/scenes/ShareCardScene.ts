import Phaser from 'phaser';
import { applyRenderZoom, isMobile } from '../config/display';
import { COLORS, FONT_DISPLAY, FONT_BODY } from '../config/colors';
import { Difficulty, CANVAS_WIDTH, CANVAS_HEIGHT, SPRITE_KEYS, DIFFICULTY_LABELS } from '../config/constants';
import { addCrispText } from '../config/text';
import { hex, darker } from '../config/utils';

export interface ShareCardData {
  score: number;
  wpm: number;
  bestWord: string;
  difficulty: Difficulty;
}

export function buildShareURL(data: ShareCardData): string {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    s: data.score.toString(),
    w: data.wpm.toString(),
    bw: data.bestWord,
    d: data.difficulty,
  });
  return `${base}?${params.toString()}`;
}

export function parseShareParams(): ShareCardData | null {
  const params = new URLSearchParams(window.location.search);
  const rawScore = params.get('s');
  const score = rawScore === null ? NaN : parseInt(rawScore, 10);
  const wpm = parseInt(params.get('w') || '', 10);
  const bestWord = params.get('bw') || '';
  const difficulty = (params.get('d') || '') as Difficulty;
  if (Number.isNaN(score) || !['easy', 'medium', 'hard'].includes(difficulty)) return null;
  return { score, wpm: wpm || 0, bestWord, difficulty };
}

export function clearShareParams(): void {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}

export class ShareCardScene extends Phaser.Scene {
  private gameInputHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super({ key: 'ShareCardScene' });
  }

  create(data: ShareCardData): void {
    applyRenderZoom(this);
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;

    this.add.image(w / 2, h / 2, SPRITE_KEYS.BG_SKY)
      .setDisplaySize(w, h).setDepth(0);

    const panelGfx = this.add.graphics();
    panelGfx.fillStyle(COLORS.SURFACE, 0.95);
    panelGfx.fillRoundedRect(w / 2 - 190, 40, 380, Math.min(h - 80, 720), 24);
    panelGfx.setDepth(6);

    const liu = this.add.sprite(w / 2, 100, SPRITE_KEYS.PLAYER_RUN);
    liu.setDisplaySize(72, 72);
    liu.setDepth(10);
    liu.play(SPRITE_KEYS.PLAYER_RUN_ANIM);

    this.tweens.add({
      targets: liu,
      y: liu.y - 4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    addCrispText(this, w / 2, 88, '好友成绩', {
      fontSize: '24px',
      fontFamily: FONT_DISPLAY,
      color: hex(COLORS.PRIMARY),
      fontStyle: 'bold',
      padding: { right: 8, left: 2, top: 2, bottom: 2 },
    }).setOrigin(0.5).setDepth(10);

    const scoreY = 128;
    addCrispText(this, w / 2, scoreY, data.score.toLocaleString(), {
      fontSize: '40px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.PRIMARY),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    addCrispText(this, w / 2, scoreY + 28, '> 分数 <', {
      fontSize: '10px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_MUTED),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    const cardW = 90;
    const cardH = 40;
    const cardGap = 10;
    const totalW = cardW * 3 + cardGap * 2;
    const startX = (w - totalW) / 2;
    const cardsY = scoreY + 52;

    const cards = [
      { value: data.wpm.toString(), label: '均速' },
      { value: data.bestWord || '—', label: '最佳' },
      { value: DIFFICULTY_LABELS[data.difficulty], label: '难度' },
    ];

    cards.forEach((card, i) => {
      const cx = startX + i * (cardW + cardGap);
      const cg = this.add.graphics();
      cg.fillStyle(COLORS.PRIMARY, 0.08);
      cg.fillRoundedRect(cx, cardsY, cardW, cardH, 10);
      cg.setDepth(7);

      addCrispText(this, cx + cardW / 2, cardsY + 13, card.value, {
        fontSize: '13px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_ON_LIGHT),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);

      addCrispText(this, cx + cardW / 2, cardsY + 29, card.label, {
        fontSize: '9px',
        fontFamily: FONT_BODY,
        color: hex(COLORS.TEXT_MUTED),
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
    });

    const promptY = cardsY + cardH + 20;
    const promptBg = this.add.graphics();
    promptBg.fillStyle(COLORS.ACCENT, 0.12);
    promptBg.fillRoundedRect(w / 2 - 110, promptY, 220, 24, 12);
    promptBg.setDepth(7);

    const playPrompt = addCrispText(this, w / 2, promptY + 12, '> 你能超过我吗？ <', {
      fontSize: '13px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.ACCENT),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: playPrompt,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    const btnY = promptY + 36;

    const playGfx = this.add.graphics();
    playGfx.fillStyle(COLORS.PRIMARY, 1);
    playGfx.fillRoundedRect(w / 2 - 70, btnY, 140, 36, 14);
    playGfx.fillStyle(darker(COLORS.PRIMARY, 0.15), 1);
    playGfx.fillRoundedRect(w / 2 - 68, btnY + 18, 136, 16, 8);
    playGfx.setDepth(7);
    playGfx.setInteractive(new Phaser.Geom.Rectangle(w / 2 - 70, btnY, 140, 36), Phaser.Geom.Rectangle.Contains);
    playGfx.on('pointerover', () => { this.input.setDefaultCursor('pointer'); });
    playGfx.on('pointerout', () => { this.input.setDefaultCursor('default'); });
    playGfx.on('pointerdown', () => this.play());

    addCrispText(this, w / 2, btnY + 18, '开始挑战', {
      fontSize: '16px',
      fontFamily: FONT_BODY,
      color: '#FFFFFF',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    addCrispText(this, w / 2, btnY + 48, '或按空格键', {
      fontSize: '11px',
      fontFamily: FONT_BODY,
      color: hex(COLORS.TEXT_MUTED),
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.keyboardHandler = (event: KeyboardEvent) => {
      if (event.key === ' ') this.play();
    };
    this.input.keyboard!.on('keydown', this.keyboardHandler);

    const gameInput = document.getElementById('game-input') as HTMLInputElement;
    if (gameInput) {
      gameInput.value = '';
      gameInput.focus();
      this.gameInputHandler = (e: KeyboardEvent) => {
        if (e.key === ' ') { e.preventDefault(); this.play(); }
      };
      gameInput.addEventListener('keydown', this.gameInputHandler);
    }

    if (isMobile()) {
      window.__wordhopper_jump = () => this.play();
    }
  }

  private play(): void {
    this.cleanup();
    clearShareParams();
    this.scene.start('MenuScene');
  }

  shutdown(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.keyboardHandler) {
      this.input.keyboard?.off('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
    if (this.gameInputHandler) {
      const gameInput = document.getElementById('game-input') as HTMLInputElement;
      if (gameInput) gameInput.removeEventListener('keydown', this.gameInputHandler);
      this.gameInputHandler = null;
    }
    delete window.__wordhopper_jump;
  }
}
