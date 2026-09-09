import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    AUTO: 'AUTO',
    Scale: {
      FIT: 'FIT',
      CENTER_BOTH: 'CENTER_BOTH',
    },
    Game: class {},
    Scene: class {},
  },
}));

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalNavigator = globalThis.navigator;

function mockBrowserEnvironment(devicePixelRatio: number): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerWidth: 1440,
      innerHeight: 900,
      devicePixelRatio,
      addEventListener: vi.fn(),
    },
  });

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'Desktop Browser',
    },
  });

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: {},
      fonts: {
        ready: Promise.resolve(),
      },
      getElementById: vi.fn((id: string) => {
        if (id === 'game-shell') return { id, style: {} };
        if (id === 'mobile-tip') return { style: { display: 'none' } };
        return null;
      }),
    },
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: originalNavigator,
  });
  vi.resetModules();
});

describe('main game config', () => {
  it('caps render resolution at 2x for high DPI displays', async () => {
    mockBrowserEnvironment(3);

    const mainModule = await import('../src/main') as Record<string, unknown>;
    const getDisplaySize = mainModule.getDisplaySize as ((viewportWidth?: number, viewportHeight?: number) => { width: number; height: number }) | undefined;
    const getRenderResolution = mainModule.getRenderResolution as ((dpr?: number) => number) | undefined;
    const getRenderSize = mainModule.getRenderSize as ((displayWidth?: number, displayHeight?: number, dpr?: number) => { width: number; height: number }) | undefined;

    expect(typeof getDisplaySize).toBe('function');
    expect(typeof getRenderResolution).toBe('function');
    expect(typeof getRenderSize).toBe('function');

    const display = getDisplaySize?.(1440, 900);
    expect(display?.width).toBeGreaterThan(300);
    expect(display?.height).toBeGreaterThan(display!.width);
    expect(getRenderResolution?.(3)).toBe(2);
    expect(getRenderResolution?.(1.5)).toBe(1.5);

    const render = getRenderSize?.(display!.width, display!.height, 3);
    expect(render!.width).toBeLessThanOrEqual(900);
    expect(render!.height).toBeLessThanOrEqual(1600);
    expect(render!.height / render!.width).toBeCloseTo(800 / 450, 2);
  });

  it('builds a fixed-size game config mounted into the game shell', async () => {
    mockBrowserEnvironment(2);

    const mainModule = await import('../src/main') as Record<string, unknown>;
    const createGameConfig = mainModule.createGameConfig as ((parent: HTMLElement, viewportWidth?: number, devicePixelRatio?: number) => Record<string, unknown>) | undefined;
    const gameShell = document.getElementById('game-shell') as HTMLElement;

    expect(typeof createGameConfig).toBe('function');

    const config = createGameConfig?.(gameShell, 1440, 2);

    expect(config).toMatchObject({
      parent: gameShell,
      autoRound: false,
      scale: {
        mode: 'FIT',
        autoCenter: 'CENTER_BOTH',
      },
    });
    expect(typeof config?.width).toBe('number');
    expect(typeof config?.height).toBe('number');
    expect((config!.height as number) > (config!.width as number)).toBe(true);
  });
});
