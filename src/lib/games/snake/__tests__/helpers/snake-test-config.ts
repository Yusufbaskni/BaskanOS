/** S-01 `contracts.ts` gelene kadar testlerde kullanılan config şekli. */
export type TestSnakeGameConfig = {
  gridWidth: number;
  gridHeight: number;
  tickMs: number;
  wrapWalls: boolean;
};

/** QA / Product MVP sabitleri (S-03 doğrulama referansı). */
export const MVP_SNAKE_CONFIG: TestSnakeGameConfig = {
  gridWidth: 20,
  gridHeight: 20,
  tickMs: 150,
  wrapWalls: false,
};

export const INITIAL_SNAKE_LENGTH = 3;
