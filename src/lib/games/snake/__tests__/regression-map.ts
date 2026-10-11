/**
 * Manuel TC (QA S-10) → otomasyon eşlemesi.
 * CI raporlarında traceability için test adları bu ID’leri taşır.
 */
export const REGRESSION_MAP = {
  unit: {
    "TC-10": "snake-engine.regression › ters yön aynı tick reddi",
    "TC-11": "snake-engine.regression › duvar çarpışması gameOver",
    "TC-12": "snake-engine.regression › yem yeme skor +1 ve yem taşınır",
    "TC-13": "snake-engine.regression › pause tick ilerlemez (hook entegrasyonu FE)",
    "TC-15": "snake-engine.regression › kendi gövdesine çarpışma gameOver",
    "TC-16": "snake-engine.regression › wrapWalls false kenar ölüm",
  },
  api: {
    "TC-02": "snake-api-smoke › GET config 200",
    "TC-20": "snake-api-smoke › POST geçerli skor 201",
    "TC-22": "snake-api-smoke › T1 süre alt sınır 400",
    "TC-23": "snake-api-smoke › rate limit 429",
    "TC-30": "snake-api-smoke › liderlik projectId filtresi (fixture)",
  },
} as const;
