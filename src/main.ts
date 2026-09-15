import Phaser from 'phaser';
import { FONT_BODY, FONT_DISPLAY, FONT_WORD } from './config/colors';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { DeathScene } from './scenes/DeathScene';
import { ShareCardScene } from './scenes/ShareCardScene';
import { applyRenderZoom, getDisplaySize, getRenderSize, isMobile } from './config/display';

export { getDisplaySize, getRenderResolution, getRenderSize, isMobile, isIOS } from './config/display';

export function createGameConfig(
  parent: HTMLElement,
  viewportWidth = window.innerWidth,
  devicePixelRatio = window.devicePixelRatio || 1
): Phaser.Types.Core.GameConfig {
  const displaySize = getDisplaySize(viewportWidth, window.innerHeight);
  const renderSize = getRenderSize(displaySize.width, displaySize.height, devicePixelRatio);

  return {
    type: Phaser.AUTO,
    width: renderSize.width,
    height: renderSize.height,
    parent,
    backgroundColor: '#ECFDF5',
    roundPixels: true,
    autoRound: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: renderSize.width,
      height: renderSize.height,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
      },
    },
    render: {
      antialias: true,
      antialiasGL: true,
    },
    scene: [BootScene, MenuScene, GameScene, DeathScene, ShareCardScene],
  };
}

const mobile = isMobile();
const gameShell = document.getElementById('game-shell');

async function waitForGameFonts(): Promise<void> {
  if (!('fonts' in document) || typeof document.fonts.load !== 'function') {
    return;
  }

  await document.fonts.ready;

  await Promise.allSettled([
    document.fonts.load(`700 40px ${FONT_DISPLAY}`),
    document.fonts.load(`700 18px ${FONT_BODY}`),
    document.fonts.load(`400 18px ${FONT_BODY}`),
    document.fonts.load(`700 20px ${FONT_WORD}`),
  ]);
}

function resizeGame(game: Phaser.Game): void {
  const displaySize = getDisplaySize();
  const renderSize = getRenderSize(displaySize.width, displaySize.height);

  game.scale.resize(renderSize.width, renderSize.height);

  for (const scene of game.scene.getScenes(true)) {
    applyRenderZoom(scene);
  }
}

if (gameShell) {
  if (mobile) {
    const tip = document.getElementById('mobile-tip');
    if (tip) tip.style.display = 'none';
  }

  // 全屏：shell 填满视口（9:16 contain，留白由 body 天空渐变融合）
  const applyShellSize = () => {
    const display = getDisplaySize(window.innerWidth, window.innerHeight);
    gameShell.style.width = display.width + 'px';
    gameShell.style.height = display.height + 'px';
  };
  applyShellSize();

  waitForGameFonts().then(() => {
    const game = new Phaser.Game(createGameConfig(gameShell));

    if (import.meta.env.DEV) {
      // dev 调试句柄：浏览器自动化验证用（生产构建会被 tree-shake 掉）
      (window as unknown as { __game: Phaser.Game }).__game = game;
    }

    window.addEventListener('resize', () => {
      applyShellSize();
      resizeGame(game);
    });
  });
} else {
  throw new Error('Missing #game-shell container for Phaser game');
}
