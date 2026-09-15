import { describe, it, expect, vi } from 'vitest';

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { devicePixelRatio: 1 },
});

vi.mock('phaser', () => ({
  default: {
    Geom: {
      Rectangle: class {
        x = 0; y = 0; width = 0; height = 0;
        constructor(x = 0, y = 0, w = 0, h = 0) { this.x = x; this.y = y; this.width = w; this.height = h; }
        setTo(x: number, y: number, w: number, h: number) { this.x = x; this.y = y; this.width = w; this.height = h; return this; }
      },
      Circle: class {},
    },
    GameObjects: {},
    Scene: class {},
  },
}));

import { Obstacle } from '../src/entities/Obstacle';
import { ObstacleType } from '../src/config/constants';

function chainable<T extends object>(extra: T): T {
  const target = extra as Record<string | symbol, unknown>;
  const proxy = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      const fn = () => proxy;
      t[k] = fn;
      return fn;
    },
  });
  return proxy as T;
}

interface MockContainer {
  x: number; y: number; scale: number; alpha: number; visible: boolean;
  list: unknown[]; destroyed: boolean;
  setPosition(x: number, y: number): MockContainer;
  setVisible(v: boolean): MockContainer;
  add(items: unknown): MockContainer;
  getData(k: string): unknown;
  [k: string]: unknown;
}

function makeContainer(x = 0, y = 0): MockContainer {
  const data = new Map<string, unknown>();
  const c: MockContainer = {
    x, y, scale: 1, alpha: 1, visible: true, list: [], destroyed: false,
    setPosition(nx: number, ny: number) { c.x = nx; c.y = ny; return c; },
    setScale(s: number) { c.scale = s; return c; },
    setAlpha(a: number) { c.alpha = a; return c; },
    setVisible(v: boolean) { c.visible = v; return c; },
    add(items: unknown) {
      const arr = Array.isArray(items) ? items : [items];
      c.list.push(...arr);
      return c;
    },
    setData(k: string, v: unknown) { data.set(k, v); return c; },
    getData(k: string) { return data.get(k); },
    destroy() { c.destroyed = true; },
  };
  return chainable(c);
}

interface MockText {
  x: number; y: number; text: string; width: number;
  setText(s: string): MockText;
  [k: string]: unknown;
}

function makeText(x = 0, y = 0, text = ''): MockText {
  const t: MockText = {
    x, y, text,
    width: text.length * 10,
    setText(s: string) { t.text = s; t.width = s.length * 10; return t; },
  };
  return chainable(t);
}

function makeScene() {
  return {
    add: {
      container: (x = 0, y = 0) => makeContainer(x, y),
      sprite: () => chainable({ setOrigin() { return this; }, setDisplaySize() { return this; } }),
      graphics: () => chainable({}),
      text: (x = 0, y = 0, text = '') => makeText(x, y, text),
    },
    tweens: { add: vi.fn(), killTweensOf: vi.fn() },
    time: { delayedCall: vi.fn() },
    events: { emit: vi.fn(), on: vi.fn() },
  } as unknown as Phaser.Scene;
}

const BOARD = ['一', '心', '一', '意', '甲', '乙', '丙', '丁'];

function makeBoardObstacle(progress = 0.5) {
  const scene = makeScene();
  const obs = new Obstacle(scene, {
    obstacleType: ObstacleType.Mushroom,
    word: '一心一意',
    meaning: '只有一个心眼儿',
    progress,
    board: [...BOARD],
  });
  return { obs, scene };
}

function bubblesOf(obs: Obstacle): MockContainer[] {
  return (obs as unknown as { bubbles: MockContainer[] }).bubbles;
}

function nextIndexOf(obs: Obstacle): number {
  return (obs as unknown as { getNextIndex(): number }).getNextIndex();
}

describe('Obstacle 8 字板', () => {
  it('渲染 8 个字块：4 个一排共 2 排', () => {
    const { obs } = makeBoardObstacle();
    const bubbles = bubblesOf(obs);
    expect(bubbles.length).toBe(8);
    // 每排 4 个：x 对称分布（间距 46）[-69, -23, 23, 69]
    for (let i = 0; i < 8; i++) {
      const j = i % 4;
      expect(bubbles[i].x).toBeCloseTo((j - 1.5) * 46, 5);
    }
    // 两排：row 容器 y 分别为 0 和 46
    const wrap = (obs as unknown as { bubbleWrap: MockContainer }).bubbleWrap;
    const rows = wrap.list as MockContainer[];
    expect(rows.length).toBe(2);
    expect(rows[0].y).toBe(0);
    expect(rows[1].y).toBe(46);
  });

  it('getCharAt 返回槽位字符', () => {
    const { obs } = makeBoardObstacle();
    for (let i = 0; i < 8; i++) {
      expect(obs.getCharAt(i)).toBe(BOARD[i]);
    }
    expect(obs.isBoard()).toBe(true);
  });

  it('高亮槽位随进度推进（下一个所需字所在槽位）', () => {
    const { obs } = makeBoardObstacle();
    expect(nextIndexOf(obs)).toBe(0); // 第一个「一」
    obs.onCorrectTap(0); // 点中槽位 0 的「一」
    expect(nextIndexOf(obs)).toBe(1); // 「心」
    obs.onCorrectTap(1);
    expect(nextIndexOf(obs)).toBe(2); // 第二个「一」
    obs.onCorrectTap(2);
    expect(nextIndexOf(obs)).toBe(3); // 「意」
  });

  it('重复字：先点后面的「一」，高亮跳过已隐藏槽位', () => {
    const { obs } = makeBoardObstacle();
    obs.onCorrectTap(2); // 点中槽位 2 的「一」（后面的那个）
    expect(nextIndexOf(obs)).toBe(1); // 「心」
    obs.onCorrectTap(1);
    // 还需要一个「一」：槽位 2 已隐藏，应高亮槽位 0
    expect(nextIndexOf(obs)).toBe(0);
  });

  it('点中后槽位气泡隐藏，左侧文字按序拼出成语', () => {
    const { obs } = makeBoardObstacle();
    const doneText = (obs as unknown as { doneText: MockText }).doneText;
    const bubbles = bubblesOf(obs);
    obs.onCorrectTap(0);
    expect(bubbles[0].visible).toBe(false);
    expect(doneText.text).toBe('一');
    obs.onCorrectTap(1);
    expect(doneText.text).toBe('一心');
    obs.onCorrectTap(2);
    obs.onCorrectTap(3);
    expect(doneText.text).toBe('一心一意');
  });

  it('单词模式不受影响：getCharAt 回退到单词字母', () => {
    const scene = makeScene();
    const obs = new Obstacle(scene, {
      obstacleType: ObstacleType.Mushroom,
      word: 'cat',
      meaning: '猫',
      progress: 0.5,
    });
    expect(obs.isBoard()).toBe(false);
    expect(obs.getCharAt(0)).toBe('c');
    expect(obs.getCharAt(2)).toBe('t');
  });
});
