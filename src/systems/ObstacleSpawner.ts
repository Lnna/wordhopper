import {
  DIFFICULTY_CONFIG,
  Difficulty,
  GameMode,
  ObstacleType,
  SPAWN_GAP_MAX,
  SPAWN_GAP_MIN,
  SPAWN_PROGRESS,
} from '../config/constants';
import { ObstacleConfig } from '../entities/Obstacle';
import { WordSpawner } from './WordSpawner';
import { IdiomSpawner } from './IdiomSpawner';
import { getTranslation } from '../data/translations';

const OBSTACLE_TYPES = Object.values(ObstacleType);

export class ObstacleSpawner {
  private wordSpawner: WordSpawner;
  private idiomSpawner: IdiomSpawner | null = null;
  private difficulty: Difficulty = 'easy';
  private mode: GameMode = 'word';

  constructor(wordSpawner: WordSpawner) {
    this.wordSpawner = wordSpawner;
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    if (mode === 'idiom' && !this.idiomSpawner) {
      this.idiomSpawner = new IdiomSpawner();
    }
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
    const obstacleType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const progress = tutorial ? 0.35 : SPAWN_PROGRESS;

    if (this.mode === 'idiom') {
      const round = this.idiomSpawner!.generateNext();
      return {
        obstacleType,
        word: round.idiom,
        meaning: round.meaning,
        board: round.board,
        progress,
      };
    }

    const word = this.wordSpawner.generateSingle();
    return {
      obstacleType,
      word,
      meaning: getTranslation(word) || word,
      progress,
    };
  }

  getDifficultyConfig() {
    return DIFFICULTY_CONFIG[this.difficulty];
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
