import {
  DIFFICULTY_CONFIG,
  Difficulty,
  ObstacleType,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  SPAWN_PROGRESS,
} from '../config/constants';
import { ObstacleConfig } from '../entities/Obstacle';
import { WordSpawner } from './WordSpawner';
import { getTranslation } from '../data/translations';

const OBSTACLE_TYPES = Object.values(ObstacleType);

export class ObstacleSpawner {
  private wordSpawner: WordSpawner;
  private difficulty: Difficulty = 'easy';

  constructor(wordSpawner: WordSpawner) {
    this.wordSpawner = wordSpawner;
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
  }

  /** Spawn when furthest (most recent) obstacle has advanced enough */
  canSpawn(obstacles: { getProgress: () => number; isActive: () => boolean }[]): boolean {
    const alive = obstacles.filter((o) => o.isActive());
    if (alive.length === 0) return true;
    const newest = Math.min(...alive.map((o) => o.getProgress()));
    const gap = this.randomRange(SPAWN_GAP_MIN, SPAWN_GAP_MAX);
    return newest >= gap;
  }

  generate(tutorial = false): ObstacleConfig {
    const word = this.wordSpawner.generateSingle();
    const obstacleType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    return {
      obstacleType,
      word,
      meaning: getTranslation(word) || word,
      progress: tutorial ? 0.35 : SPAWN_PROGRESS,
    };
  }

  getDifficultyConfig() {
    return DIFFICULTY_CONFIG[this.difficulty];
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
