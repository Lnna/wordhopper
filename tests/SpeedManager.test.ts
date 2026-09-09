import { describe, it, expect } from 'vitest';
import { SpeedManager } from '../src/systems/SpeedManager';
import { INITIAL_APPROACH_RATE } from '../src/config/constants';

describe('SpeedManager', () => {
  it('should return initial approach rate at start', () => {
    const mgr = new SpeedManager();
    expect(mgr.getSpeed()).toBe(INITIAL_APPROACH_RATE);
    expect(mgr.getSpeedMultiplier()).toBe(1.0);
  });

  it('should increase speed every obstacle', () => {
    const mgr = new SpeedManager();
    mgr.onObstacleCleared();
    expect(mgr.getSpeedMultiplier()).toBeCloseTo(1.01, 4);
    mgr.onObstacleCleared();
    expect(mgr.getSpeedMultiplier()).toBeCloseTo(1.02, 4);
  });

  it('should cap speed at 2.5x', () => {
    const mgr = new SpeedManager();
    for (let i = 0; i < 500; i++) {
      mgr.onObstacleCleared();
    }
    expect(mgr.getSpeedMultiplier()).toBeLessThanOrEqual(2.5);
  });

  it('should reset', () => {
    const mgr = new SpeedManager();
    mgr.onObstacleCleared();
    mgr.reset();
    expect(mgr.getSpeed()).toBe(INITIAL_APPROACH_RATE);
    expect(mgr.getSpeedMultiplier()).toBe(1.0);
  });
});
