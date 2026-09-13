import { describe, it, expect } from 'vitest';
import { PLAYER_X, PLAYER_DODGE_OFFSET } from '../src/config/constants';

describe('dodge direction', () => {
  it('alternates left and right', () => {
    const dir = (n: number) => (n % 2 === 0 ? -1 : 1);
    expect(PLAYER_X + dir(0) * PLAYER_DODGE_OFFSET).toBeLessThan(PLAYER_X);
    expect(PLAYER_X + dir(1) * PLAYER_DODGE_OFFSET).toBeGreaterThan(PLAYER_X);
  });
});
