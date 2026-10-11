#!/usr/bin/env node
/**
 * DevOps CI smoke (Kapı B): çalışan Next sunucusuna karşı yılan API sözleşmesi.
 * Kullanım: BASE_URL=http://127.0.0.1:3000 node scripts/snake-api-smoke.mjs
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const PLAYER = process.env.SNAKE_SMOKE_PLAYER_ID ?? "guest-smoke-ci";

const gridWidth = Number(process.env.SNAKE_GRID_WIDTH ?? 20);
const gridHeight = Number(process.env.SNAKE_GRID_HEIGHT ?? 20);
const tickMs = Number(process.env.SNAKE_TICK_MS ?? 150);

function fail(msg) {
  console.error(`[snake-api-smoke] FAIL: ${msg}`);
  process.exit(1);
}

async function req(method, path, { body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-snake-player-id": PLAYER,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  const config = await req("GET", "/api/games/snake/config");
  if (config.status !== 200) fail(`GET config → ${config.status}`);
  if (!config.json?.gridWidth) fail("GET config gövdesi eksik");

  const validDuration = (5 + 3) * tickMs;
  const okPost = await req("POST", "/api/games/snake/scores", {
    body: {
      score: 5,
      durationMs: validDuration,
      gridWidth,
      gridHeight,
    },
  });
  if (okPost.status !== 201) fail(`POST geçerli skor → ${okPost.status}`);

  const badPost = await req("POST", "/api/games/snake/scores", {
    body: {
      score: 50,
      durationMs: 100,
      gridWidth,
      gridHeight,
    },
  });
  if (badPost.status !== 400) fail(`POST T1 reject → ${badPost.status} (beklenen 400)`);
  const errBody = JSON.stringify(badPost.json ?? "");
  if (/minDuration|cheat|hile|digest/i.test(errBody)) {
    fail("400 yanıtında T1 detay sızıntısı (P-013)");
  }

  let saw429 = false;
  for (let i = 0; i < 12; i++) {
    const r = await req("POST", "/api/games/snake/scores", {
      body: {
        score: 1,
        durationMs: validDuration,
        gridWidth,
        gridHeight,
      },
    });
    if (r.status === 429) {
      saw429 = true;
      break;
    }
  }
  if (!saw429) fail("12 POST sonrası 429 görülmedi (rate limit)");

  const board = await req("GET", "/api/games/snake/scores?limit=50");
  if (board.status !== 200) fail(`GET scores → ${board.status}`);
  if (!Array.isArray(board.json?.items)) fail("GET scores items dizisi yok");

  console.log("[snake-api-smoke] OK");
}

main().catch((e) => fail(e.message));
