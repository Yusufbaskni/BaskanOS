import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AGENTS } from "./agents";
import type { AppState, BoardItem, ChatMessage, Project } from "./types";

const STATE_FILE = "state.json";

function defaultDataDir() {
  const fromEnv = process.env.BASKANOS_DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library/Application Support/BaskanOS");
  }
  return path.join(os.homedir(), ".baskanos");
}

export function dataDir() {
  const dir = defaultDataDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function statePath() {
  return path.join(dataDir(), STATE_FILE);
}

function defaultProject(): Project {
  const cwd =
    process.env.BASKANOS_DEFAULT_CWD?.trim() ||
    process.env.PWD?.trim() ||
    process.cwd();
  return {
    id: "proj-default",
    name: "BaskanOS",
    company: "Baskani Yazılım",
    cwd,
  };
}

function seedBoard(projectId: string): BoardItem[] {
  void projectId;
  // İlk açılış: boş board — kullanıcı sıfırdan başlar
  return [];
}

export function defaultState(): AppState {
  const project = defaultProject();
  return {
    version: 1,
    activeProjectId: project.id,
    projects: [project],
    board: seedBoard(project.id),
    threads: {},
    pins: AGENTS.filter((a) => a.core).map((a) => a.id),
    approvals: [],
  };
}

let cache: AppState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function readState(): AppState {
  if (cache) return structuredClone(cache);
  const file = statePath();
  if (!fs.existsSync(file)) {
    cache = defaultState();
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), "utf8");
    return structuredClone(cache);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as AppState;
    if (!parsed?.version || !Array.isArray(parsed.projects)) {
      cache = defaultState();
    } else {
      cache = {
        ...defaultState(),
        ...parsed,
        version: 1,
        threads: parsed.threads ?? {},
        approvals: parsed.approvals ?? [],
        pins: parsed.pins?.length ? parsed.pins : defaultState().pins,
      };
    }
  } catch {
    cache = defaultState();
  }
  return structuredClone(cache!);
}

export function writeState(next: AppState) {
  cache = structuredClone(next);
  const snapshot = structuredClone(next);
  writeQueue = writeQueue.then(() => {
    const file = statePath();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
    fs.renameSync(tmp, file);
  });
  return writeQueue;
}

export function updateState(mutator: (state: AppState) => void): AppState {
  const state = readState();
  mutator(state);
  void writeState(state);
  return structuredClone(state);
}

export function threadKey(projectId: string, agentId: string) {
  return `${projectId}:${agentId}`;
}

export function getThread(projectId: string, agentId: string): ChatMessage[] {
  const state = readState();
  return state.threads[threadKey(projectId, agentId)] ?? [];
}

export function setThread(projectId: string, agentId: string, messages: ChatMessage[]) {
  return updateState((state) => {
    state.threads[threadKey(projectId, agentId)] = messages.slice(-80);
  });
}

export function activeProject(state = readState()): Project {
  return state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];
}
