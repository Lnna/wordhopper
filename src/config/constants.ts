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

/** progress/sec at 1.0×（中等难度基准，约 9.4s 从出现到撞上） */
export const INITIAL_APPROACH_RATE = 0.085;
export const MAX_SPEED_MULTIPLIER = 2.5;
export const SPEED_INCREMENT = 0.01;

/** Hidden jump window on approach progress — Q-001 interim from prototype */
export const WIN_LO = 0.82;
export const WIN_HI = 0.96;
export const HIT_PROGRESS = 1;
export const CLEAR_EXIT_PROGRESS = 1.6;
export const CLEAR_SPEED_BOOST = 5;
export const PERFECT_WINDOW_RATIO = 0.3;
/** 窗口外点击仓鼠催促：当前障碍逼近速度倍率（已拼完=省时奖励，未拼完=增压惩罚） */
export const RUSH_BOOST = 3;

export const BUBBLE_PER_ROW = 5;
export const APPROACH_TOP_FAR = 0.15;
export const APPROACH_TOP_NEAR = 0.85;
export const APPROACH_SCALE_FAR = 0.35;
export const APPROACH_SCALE_NEAR = 1.3;

/** 新障碍从远处生成的进度（一屏一障：当前障碍开始清除时才生成下一个） */
export const SPAWN_PROGRESS = 0.02;

export const GRAVITY = 1200;

export const BASE_SCORE_PER_TICK = 1;
export const WORD_SCORE_PER_CHAR = 5;
export const COMBO_BONUS = 3;
export const PERFECT_MULTIPLIER = 1.2;

export type Difficulty = 'easy' | 'medium' | 'hard';

/** 游戏模式：单词（点字母）/ 成语（8 字板接龙） */
export type GameMode = 'word' | 'idiom';

/** 难度中文标签（菜单/结算页/分享卡片共用） */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '容易',
  medium: '中等',
  hard: '困难',
};

export const DIFFICULTY_CONFIG: Record<Difficulty, { minLen: number; maxLen: number; wordFile: string; speedMultiplier: number }> = {
  easy: { minLen: 3, maxLen: 5, wordFile: 'words-easy.json', speedMultiplier: 0.8 },
  medium: { minLen: 6, maxLen: 8, wordFile: 'words-medium.json', speedMultiplier: 1.0 },
  hard: { minLen: 8, maxLen: Infinity, wordFile: 'words-hard.json', speedMultiplier: 1.2 },
};

/** 成语模式难度词频带（THUOCL 词频，互斥）：容易最常见，困难较生僻 */
export const IDIOM_FREQ_TIERS: Record<Difficulty, { minFreq: number; maxFreq: number }> = {
  easy: { minFreq: 2000, maxFreq: Infinity },
  medium: { minFreq: 1000, maxFreq: 2000 },
  hard: { minFreq: 0, maxFreq: 1000 },
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
