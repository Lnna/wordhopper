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
import { ObstacleType, CLEAR_EXIT_PROGRESS, CLEAR_SPEED_BOOST, HIT_PROGRESS, PLAYER_Y } from '../src/config/constants';

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
  setScale(s: number): MockContainer;
  setAlpha(a: number): MockContainer;
  [k: string]: unknown;
}

function makeContainer(x = 0, y = 0): MockContainer {
  const c: MockContainer = {
    x, y, scale: 1, alpha: 1, visible: true, list: [], destroyed: false,
    setPosition(nx: number, ny: number) { c.x = nx; c.y = ny; return c; },
    setScale(s: number) { c.scale = s; return c; },
    setAlpha(a: number) { c.alpha = a; return c; },
    destroy() { c.destroyed = true; },
  };
  return chainable(c);
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

function makeObstacle(progress: number) {
  const scene = makeScene();
  const obs = new Obstacle(scene, {
    obstacleType: ObstacleType.Mushroom,
    word: 'cat',
    meaning: '猫',
    progress,
  });
  return { obs, scene };
}

describe('Obstacle clearing sweep', () => {
  it('keeps advancing past the player while clearing instead of freezing', () => {
    const { obs } = makeObstacle(0.9);
    obs.beginClear(() => {}, () => {});
    const before = obs.getProgress();
    obs.advance(0.1, 0.14);
    expect(obs.getProgress()).toBeGreaterThan(before);
    expect(obs.getProgress()).toBeCloseTo(0.9 + 0.14 * CLEAR_SPEED_BOOST * 0.1, 5);
  });

  it('fades out proportionally to downward travel', () => {
    const { obs } = makeObstacle(0.9);
    obs.beginClear(() => {}, () => {});
    obs.advance(0.1, 0.14);
    const root = (obs as unknown as { root: { alpha: number; y: number } }).root;
    const travelled = obs.getProgress() - 0.9;
    const expectedAlpha = 1 - travelled / (CLEAR_EXIT_PROGRESS - 0.9);
    expect(root.alpha).toBeCloseTo(expectedAlpha, 5);
    expect(root.alpha).toBeLessThan(1);
  });

  it('moves downward (y increases) while clearing', () => {
    const { obs } = makeObstacle(0.9);
    const root = (obs as unknown as { root: { y: number } }).root;
    const yBefore = root.y;
    obs.beginClear(() => {}, () => {});
    obs.advance(0.2, 0.14);
    expect(root.y).toBeGreaterThan(yBefore);
  });

  it('deactivates and calls back when reaching exit progress', () => {
    const { obs } = makeObstacle(0.9);
    const onDone = vi.fn();
    obs.beginClear(() => {}, onDone);
    // advance in small steps until exit
    for (let i = 0; i < 200 && obs.isActive(); i++) {
      obs.advance(0.05, 0.14);
    }
    expect(obs.isActive()).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(obs.getProgress()).toBeGreaterThanOrEqual(CLEAR_EXIT_PROGRESS);
  });

  it('still clamps normal approach at HIT_PROGRESS when not clearing', () => {
    const { obs } = makeObstacle(0.99);
    obs.advance(1, 0.5);
    expect(obs.getProgress()).toBe(HIT_PROGRESS);
  });

  it('setBoost multiplies approach speed (催促加速) and is idempotent', () => {
    const { obs } = makeObstacle(0.3);
    obs.advance(0.5, 0.2); // +0.1
    expect(obs.getProgress()).toBeCloseTo(0.4, 5);
    obs.setBoost(3);
    obs.setBoost(3); // 幂等
    obs.advance(0.5, 0.2); // +0.3
    expect(obs.getProgress()).toBeCloseTo(0.7, 5);
    expect(obs.getBoost()).toBe(3);
  });

  it('setBoost does not affect clearing speed', () => {
    const { obs } = makeObstacle(0.9);
    obs.setBoost(3);
    obs.beginClear(() => { /* noop */ }, () => { /* noop */ });
    obs.advance(0.1, 0.2); // clearing: rate * CLEAR_SPEED_BOOST, boost 不参与
    expect(obs.getProgress()).toBeCloseTo(0.9 + 0.1 * 0.2 * 5, 5);
  });

  it('claimRushReward grants only once per obstacle (防连点刷分)', () => {
    const { obs } = makeObstacle(0.3);
    expect(obs.claimRushReward()).toBe(true);
    expect(obs.claimRushReward()).toBe(false);
    expect(obs.claimRushReward()).toBe(false);
  });

  it('fires onPassed only when the pack top edge crosses the player foot line', () => {
    const { obs } = makeObstacle(1.3);
    const onPassed = vi.fn();
    const onDone = vi.fn();
    obs.beginClear(onPassed, onDone);
    // top edge at p=1.3 is ~677, still above PLAYER_Y=734
    expect(onPassed).not.toHaveBeenCalled();
    obs.advance(0.1, 0.5); // +0.25 -> 1.55, top edge ~792 > 734
    expect(onPassed).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled(); // 1.55 < CLEAR_EXIT_PROGRESS
  });

  it('guarantees onPassed before destruction even at low start progress', () => {
    const { obs } = makeObstacle(0.9);
    const calls: string[] = [];
    obs.beginClear(
      () => calls.push('passed'),
      () => calls.push('done')
    );
    for (let i = 0; i < 400 && obs.isActive(); i++) {
      obs.advance(0.05, 0.14);
    }
    expect(calls).toEqual(['passed', 'done']);
    // passed must happen at or before the player foot line crossing
    const root = (obs as unknown as { root: { y: number } }).root;
    expect(root.y).toBeGreaterThan(PLAYER_Y);
  });
});

describe('Obstacle done text', () => {
  it('spells the word as normal lowercase text as letters are tapped', () => {
    const { obs } = makeObstacle(0.5);
    const doneText = (obs as unknown as { doneText: { text: string } }).doneText;
    expect(doneText.text).toBe('');
    obs.onCorrectTap(0);
    expect(doneText.text).toBe('c');
    obs.onCorrectTap(1);
    expect(doneText.text).toBe('ca');
    obs.onCorrectTap(2);
    expect(doneText.text).toBe('cat');
  });

  it('advances the next-letter index as letters complete', () => {
    const { obs } = makeObstacle(0.5);
    const getNext = () => (obs as unknown as { getNextIndex(): number }).getNextIndex();
    expect(getNext()).toBe(0);
    obs.onCorrectTap(0);
    expect(getNext()).toBe(1);
    obs.onCorrectTap(1);
    expect(getNext()).toBe(2);
  });

  it('keeps remaining bubbles stationary as the done text grows', () => {
    const { obs } = makeObstacle(0.5);
    const wrap = (obs as unknown as { bubbleWrap: { x: number } }).bubbleWrap;
    const xBefore = wrap.x;
    obs.onCorrectTap(0);
    obs.onCorrectTap(1);
    expect(wrap.x).toBe(xBefore);
  });
});
