import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';

const MAX_RENDER_RESOLUTION = 2;
const MAX_RENDER_SCALE = 2;

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

export function isIOS(): boolean {
  if (typeof URLSearchParams !== 'undefined' && new URLSearchParams(location.search).has('ios')) return true;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getRenderResolution(devicePixelRatio = window.devicePixelRatio || 1): number {
  return Math.min(Math.max(devicePixelRatio, 1), MAX_RENDER_RESOLUTION);
}

/**
 * 视口内最大化 9:16 画面（全屏 contain）：先撑宽，超高则反向撑高。
 * 比例差导致的留白由 body 天空渐变背景融合。
 */
export function getDisplaySize(
  viewportWidth = window.innerWidth,
  viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 900
): { width: number; height: number } {
  const aspect = CANVAS_HEIGHT / CANVAS_WIDTH;
  let width = viewportWidth;
  let height = Math.round(width * aspect);
  if (height > viewportHeight) {
    height = viewportHeight;
    width = Math.round(height / aspect);
  }
  return { width, height };
}

export function getRenderSize(
  displayWidth = getDisplaySize().width,
  displayHeight = getDisplaySize().height,
  devicePixelRatio = window.devicePixelRatio || 1
): { width: number; height: number } {
  const resolution = getRenderResolution(devicePixelRatio);
  const renderScale = Math.min(
    (displayWidth / CANVAS_WIDTH) * resolution,
    (displayHeight / CANVAS_HEIGHT) * resolution,
    MAX_RENDER_SCALE
  );
  return {
    width: Math.round(CANVAS_WIDTH * renderScale),
    height: Math.round(CANVAS_HEIGHT * renderScale),
  };
}

export function applyRenderZoom(scene: Phaser.Scene): number {
  const renderWidth = scene.scale.width;
  const renderHeight = scene.scale.height;
  const zoom = Math.min(renderWidth / CANVAS_WIDTH, renderHeight / CANVAS_HEIGHT);
  const camera = scene.cameras.main;

  camera.setViewport(0, 0, renderWidth, renderHeight);
  camera.setZoom(zoom);
  camera.centerOn(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  return zoom;
}
