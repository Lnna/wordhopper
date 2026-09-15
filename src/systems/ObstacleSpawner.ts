import {
  DIFFICULTY_CONFIG,
  Difficulty,
  GameMode,
  ObstacleType,
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
      this.idiomSpawner.setDifficulty(this.difficulty);
    }
  }

  /** 一屏一障：当前障碍开始清除（被跳过）后才生成下一个，保证每个障碍都有完整点字时间 */
  canSpawn(obstacles: { isActive: () => boolean; isClearing: () => boolean }[]): boolean {
    return !obstacles.some((o) => o.isActive() && !o.isClearing());
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
}
