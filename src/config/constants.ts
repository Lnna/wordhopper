export const CANVAS_WIDTH = 450;
export const CANVAS_HEIGHT = 800;
export const PLAYER_X = CANVAS_WIDTH / 2;
export const PLAYER_Y = CANVAS_HEIGHT - 66;
export const PLAYER_DODGE_OFFSET = 78;
export const PLAYER_HEIGHT = 80;
export const PLAYER_WIDTH = 80;
export const PLAYER_COLLISION_SHRINK = 0.55;
export const OBSTACLE_BODY_WIDTH = 48;
export const OBSTACLE_VISUAL_BASE = 56;
export const GROUND_HEIGHT = 48;
export const GROUND_Y = CANVAS_HEIGHT - GROUND_HEIGHT;

/** Prototype `.road` / `.road-border`: 120% box, clip-path percents of that box */
export const ROAD_BOX_WIDTH_RATIO = 1.2;
export const ROAD_HEIGHT_RATIO = 0.82;
export const ROAD_STRIPE_PERIOD = 40;
export const ROAD_STRIPE_HEIGHT = 8;
export const ROAD_SCROLL_DURATION = 0.85;

export interface TrapezoidPoint { x: number; y: number }

export function getRoadBox(): { boxW: number; boxH: number; boxLeft: number; boxTop: number } {
  const boxW = CANVAS_WIDTH * ROAD_BOX_WIDTH_RATIO;
  const boxH = Math.round(CANVAS_HEIGHT * ROAD_HEIGHT_RATIO);
  return {
    boxW,
    boxH,
    boxLeft: (CANVAS_WIDTH - boxW) / 2,
    boxTop: CANVAS_HEIGHT - boxH,
  };
}

/** clip-path polygon(bl 100%, br 100%, tr 0%, tl 0%) on the 120% road box */
export function roadTrapezoid(
  bottomLeft: number,
  bottomRight: number,
  topRight: number,
  topLeft: number,
): TrapezoidPoint[] {
  const { boxW, boxLeft, boxTop } = getRoadBox();
  return [
    { x: boxLeft + bottomLeft * boxW, y: CANVAS_HEIGHT },
    { x: boxLeft + bottomRight * boxW, y: CANVAS_HEIGHT },
    { x: boxLeft + topRight * boxW, y: boxTop },
    { x: boxLeft + topLeft * boxW, y: boxTop },
  ];
}

/** progress/sec at 1.0× (≈11.8s to hit at chill base) — Q-002 interim */
export const INITIAL_APPROACH_RATE = 0.085;
export const MAX_SPEED_MULTIPLIER = 2.5;
export const SPEED_INCREMENT = 0.01;

/** Hidden jump window on approach progress — Q-001 interim from prototype */
export const WIN_LO = 0.82;
export const WIN_HI = 0.96;
export const HIT_PROGRESS = 1;
export const CLEAR_EXIT_PROGRESS = 1.25;
export const CLEAR_SPEED_BOOST = 4;
export const PERFECT_WINDOW_RATIO = 0.3;

export const BUBBLE_PER_ROW = 5;
export const APPROACH_TOP_FAR = 0.15;
export const APPROACH_TOP_NEAR = 0.85;
export const APPROACH_SCALE_FAR = 0.35;
export const APPROACH_SCALE_NEAR = 1.3;

/** Sparse spawn gap in progress units (开局偏疏) */
export const SPAWN_GAP_MIN = 0.32;
export const SPAWN_GAP_MAX = 0.42;
export const SPAWN_PROGRESS = 0.02;

export const GRAVITY = 1200;

export const BASE_SCORE_PER_TICK = 1;
export const WORD_SCORE_PER_CHAR = 5;
export const COMBO_BONUS = 3;
export const PERFECT_MULTIPLIER = 1.2;

export type Difficulty = 'chill' | 'easy' | 'medium' | 'hard';

export const DIFFICULTY_CONFIG: Record<Difficulty, { minLen: number; maxLen: number; wordFile: string; speedMultiplier: number }> = {
  chill: { minLen: 3, maxLen: 5, wordFile: 'words-easy.json', speedMultiplier: 0.5 },
  easy: { minLen: 3, maxLen: 5, wordFile: 'words-easy.json', speedMultiplier: 1.0 },
  medium: { minLen: 6, maxLen: 8, wordFile: 'words-medium.json', speedMultiplier: 1.0 },
  hard: { minLen: 8, maxLen: Infinity, wordFile: 'words-hard.json', speedMultiplier: 1.0 },
};

export enum ObstacleType {
  Mushroom = 'mushroom',
  Stump = 'stump',
  Bush = 'bush',
  Flowers = 'flowers',
  Rock = 'rock',
  Cactus = 'cactus',
  Crate = 'crate',
  Barrel = 'barrel',
  Pine = 'pine',
  Berry = 'berry',
}

export const SPRITE_KEYS = {
  PLAYER_RUN: 'hamster-run',
  PLAYER_JUMP: 'hamster-jump',
  PLAYER_DEAD: 'hamster-dead',
  PLAYER_RUN_ANIM: 'hamster-run',
  OBSTACLE_MUSHROOM: 'obstacle-mushroom',
  OBSTACLE_STUMP: 'obstacle-stump',
  OBSTACLE_BUSH: 'obstacle-bush',
  OBSTACLE_FLOWERS: 'obstacle-flowers',
  OBSTACLE_ROCK: 'obstacle-rock',
  OBSTACLE_CACTUS: 'obstacle-cactus',
  OBSTACLE_CRATE: 'obstacle-crate',
  OBSTACLE_BARREL: 'obstacle-barrel',
  OBSTACLE_PINE: 'obstacle-pine',
  OBSTACLE_BERRY: 'obstacle-berry',
  BG_SKY: 'background-sky',
  BG_ROAD: 'background-road',
  BG_ROAD_STRIPES: 'background-road-stripes',
} as const;

export const OBSTACLE_SPRITES: Record<ObstacleType, string> = {
  [ObstacleType.Mushroom]: SPRITE_KEYS.OBSTACLE_MUSHROOM,
  [ObstacleType.Stump]: SPRITE_KEYS.OBSTACLE_STUMP,
  [ObstacleType.Bush]: SPRITE_KEYS.OBSTACLE_BUSH,
  [ObstacleType.Flowers]: SPRITE_KEYS.OBSTACLE_FLOWERS,
  [ObstacleType.Rock]: SPRITE_KEYS.OBSTACLE_ROCK,
  [ObstacleType.Cactus]: SPRITE_KEYS.OBSTACLE_CACTUS,
  [ObstacleType.Crate]: SPRITE_KEYS.OBSTACLE_CRATE,
  [ObstacleType.Barrel]: SPRITE_KEYS.OBSTACLE_BARREL,
  [ObstacleType.Pine]: SPRITE_KEYS.OBSTACLE_PINE,
  [ObstacleType.Berry]: SPRITE_KEYS.OBSTACLE_BERRY,
};

export const SFX_ENABLED_KEY = 'word-hopper-sfx';
export const TUTORIAL_KEY = 'word-hopper-tutorial-done';
