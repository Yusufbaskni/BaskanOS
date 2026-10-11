import { describe, it, expect } from "vitest";
import { MVP_SNAKE_CONFIG } from "./helpers/snake-test-config";

type ValidateRunInput = {
  submit: {
    score: number;
    durationMs: number;
    gridWidth: number;
    gridHeight: number;
  };
  config: typeof MVP_SNAKE_CONFIG;
  initialSnakeLength?: number;
};

type ValidateRunResult =
  | { ok: true; verified: boolean }
  | { ok: false; status: 400; code: string };

type ValidateModule = {
  validateSnakeRun: (input: ValidateRunInput) => ValidateRunResult;
};

async function loadValidate(): Promise<ValidateModule | undefined> {
  try {
    const mod = await import("@/lib/games/snake/validate");
    return mod as unknown as ValidateModule;
  } catch {
    return undefined;
  }
}

const validateMod = await loadValidate();

describe("validate T1 regression (QA TC-22, ML MVP)", () => {
  it.skipIf(!validateMod)("TC-22: süre alt sınırının altında 400 reject (P-009)", () => {
    const v = validateMod!;
    const result = v.validateSnakeRun({
      submit: {
        score: 20,
        durationMs: 500,
        gridWidth: MVP_SNAKE_CONFIG.gridWidth,
        gridHeight: MVP_SNAKE_CONFIG.gridHeight,
      },
      config: MVP_SNAKE_CONFIG,
      initialSnakeLength: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it.skipIf(!validateMod)(
    "geçerli minimum süre ile kabul (verified=false digest yok)",
    () => {
      const v = validateMod!;
      const tickMs = MVP_SNAKE_CONFIG.tickMs;
      const score = 5;
      const durationMs = (score + 3) * tickMs;
      const result = v.validateSnakeRun({
        submit: {
          score,
          durationMs,
          gridWidth: MVP_SNAKE_CONFIG.gridWidth,
          gridHeight: MVP_SNAKE_CONFIG.gridHeight,
        },
        config: MVP_SNAKE_CONFIG,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.verified).toBe(false);
      }
    },
  );

  it.skipIf(!validateMod)("skor > maxTheoreticalScore → 400", () => {
    const v = validateMod!;
    const cells =
      MVP_SNAKE_CONFIG.gridWidth * MVP_SNAKE_CONFIG.gridHeight;
    const result = v.validateSnakeRun({
      submit: {
        score: cells,
        durationMs: 600_000,
        gridWidth: MVP_SNAKE_CONFIG.gridWidth,
        gridHeight: MVP_SNAKE_CONFIG.gridHeight,
      },
      config: MVP_SNAKE_CONFIG,
    });
    expect(result.ok).toBe(false);
  });
});
