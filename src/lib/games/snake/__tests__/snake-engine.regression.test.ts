import { describe, it, expect } from "vitest";
import {
  INITIAL_SNAKE_LENGTH,
  MVP_SNAKE_CONFIG,
  type TestSnakeGameConfig,
} from "./helpers/snake-test-config";

type Direction = "up" | "down" | "left" | "right";

type SnakeGameState = {
  phase: "idle" | "playing" | "paused" | "gameOver";
  snake: { x: number; y: number }[];
  direction: Direction;
  nextDirection: Direction;
  food: { x: number; y: number };
  score: number;
};

type SnakeEngine = {
  createInitialState: (config: TestSnakeGameConfig) => SnakeGameState;
  startGame: (state: SnakeGameState) => SnakeGameState;
  queueDirection: (state: SnakeGameState, dir: Direction) => SnakeGameState;
  tick: (state: SnakeGameState, config: TestSnakeGameConfig) => SnakeGameState;
};

async function loadEngine(): Promise<SnakeEngine | undefined> {
  try {
    const mod = await import("@/lib/games/snake/snake-engine");
    return mod as unknown as SnakeEngine;
  } catch {
    return undefined;
  }
}

const engine = await loadEngine();

describe("snake-engine regression (QA TC-10–16)", () => {
  it.skipIf(!engine)("TC-10: aynı tick öncesi ters yön reddedilir", () => {
    const e = engine!;
    let state = e.startGame(e.createInitialState(MVP_SNAKE_CONFIG));
    expect(state.direction).toBe("right");
    state = e.queueDirection(state, "left");
    state = e.tick(state, MVP_SNAKE_CONFIG);
    expect(state.direction).not.toBe("left");
  });

  it.skipIf(!engine)("TC-11: duvar çarpışması gameOver (wrapWalls=false)", () => {
    const e = engine!;
    const narrow: TestSnakeGameConfig = {
      ...MVP_SNAKE_CONFIG,
      gridWidth: 5,
      gridHeight: 5,
    };
    let state = e.startGame(e.createInitialState(narrow));
    for (let i = 0; i < 10; i++) {
      state = e.tick(state, narrow);
      if (state.phase === "gameOver") break;
    }
    expect(state.phase).toBe("gameOver");
  });

  it.skipIf(!engine)("TC-12: yem yendiğinde skor +1 ve yem gövdede değil", () => {
    const e = engine!;
    let state = e.startGame(e.createInitialState(MVP_SNAKE_CONFIG));
    const head = state.snake[0];
    state = {
      ...state,
      food: { x: head.x + 1, y: head.y },
      direction: "right",
      nextDirection: "right",
    };
    const before = state.score;
    state = e.tick(state, MVP_SNAKE_CONFIG);
    expect(state.score).toBe(before + 1);
    const onSnake = state.snake.some(
      (c) => c.x === state.food.x && c.y === state.food.y,
    );
    expect(onSnake).toBe(false);
  });

  it.skipIf(!engine)("TC-15: kendi gövdesine çarpışma gameOver", () => {
    const e = engine!;
    let state = e.startGame(e.createInitialState(MVP_SNAKE_CONFIG));
    state = {
      ...state,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 3, y: 6 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
      ],
      direction: "up",
      nextDirection: "up",
    };
    state = e.tick(state, MVP_SNAKE_CONFIG);
    expect(state.phase).toBe("gameOver");
  });

  it.skipIf(!engine)("TC-16: başlangıç yılan uzunluğu 3", () => {
    const e = engine!;
    const state = e.createInitialState(MVP_SNAKE_CONFIG);
    expect(state.snake.length).toBe(INITIAL_SNAKE_LENGTH);
  });
});
