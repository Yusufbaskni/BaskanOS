import type { Agent, AgentGroupId } from "./types";
import { agentById } from "./agents";

/** Alan bazlı model profilleri — .env ile değiştirilebilir. */
export const GROUP_MODEL_ENV: Record<AgentGroupId, string> = {
  engineering: "BASKANOS_MODEL_ENGINEERING",
  data: "BASKANOS_MODEL_DATA",
  product: "BASKANOS_MODEL_PRODUCT",
  design: "BASKANOS_MODEL_DESIGN",
  ops: "BASKANOS_MODEL_OPS",
  qa: "BASKANOS_MODEL_QA",
  leadership: "BASKANOS_MODEL_LEADERSHIP",
};

export const GROUP_MODEL_DEFAULTS: Record<AgentGroupId, string> = {
  engineering: "gpt-4o",
  data: "gpt-4o",
  product: "gpt-4o-mini",
  design: "gpt-4o",
  ops: "gpt-4o",
  qa: "gpt-4o-mini",
  leadership: "gpt-4o-mini",
};

/** Cursor SDK model id’leri (alan bazlı env ile override). */
export const GROUP_CURSOR_MODEL_ENV: Record<AgentGroupId, string> = {
  engineering: "BASKANOS_CURSOR_MODEL_ENGINEERING",
  data: "BASKANOS_CURSOR_MODEL_DATA",
  product: "BASKANOS_CURSOR_MODEL_PRODUCT",
  design: "BASKANOS_CURSOR_MODEL_DESIGN",
  ops: "BASKANOS_CURSOR_MODEL_OPS",
  qa: "BASKANOS_CURSOR_MODEL_QA",
  leadership: "BASKANOS_CURSOR_MODEL_LEADERSHIP",
};

export const GROUP_CURSOR_MODELS: Record<AgentGroupId, string> = {
  engineering: "composer-2.5",
  data: "composer-2.5",
  product: "composer-2.5",
  design: "composer-2.5",
  ops: "composer-2.5",
  qa: "composer-2.5",
  leadership: "composer-2.5",
};

/** product/qa/leadership → fast; engineering/ops/data/design → deep */
const FAST_GROUPS = new Set<AgentGroupId>(["product", "qa", "leadership"]);

export function resolveModelForGroup(group: AgentGroupId): string {
  const envKey = GROUP_MODEL_ENV[group];
  const fromGroup = process.env[envKey]?.trim();
  if (fromGroup) return fromGroup;
  const fallback = process.env.BASKANOS_MODEL?.trim();
  if (fallback) return fallback;
  return GROUP_MODEL_DEFAULTS[group];
}

export function resolveCursorModel(group: AgentGroupId): string {
  const groupEnv = process.env[GROUP_CURSOR_MODEL_ENV[group]]?.trim();
  if (groupEnv) return groupEnv;
  const fromEnv = process.env.BASKANOS_CURSOR_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return GROUP_CURSOR_MODELS[group];
}

export function resolveCursorModelSelection(group: AgentGroupId) {
  const id = resolveCursorModel(group);
  if (FAST_GROUPS.has(group)) {
    return { id, params: [{ id: "fast" as const, value: "true" }] };
  }
  return { id };
}

export function buildSystemPrompt(agent: Agent, projectName?: string, cwd?: string): string {
  const peers = agent.talksTo
    .map((id) => {
      const peer = agentById(id);
      return peer ? `${peer.name} (${peer.title})` : id;
    })
    .join(", ");

  return [
    `Sen BaskanOS içindeki uzman ajansın.`,
    `Rolün: ${agent.title} (${agent.name}).`,
    `Özet: ${agent.summary}`,
    `Odak alanların: ${agent.focus.join(", ")}.`,
    `Ürettiğin çıktılar genelde: ${agent.outputs.join("; ")}.`,
    peers ? `Sık çalıştığın roller: ${peers}.` : "",
    projectName ? `Aktif proje: ${projectName}.` : "",
    cwd ? `Çalışma dizini (repo): ${cwd}. Gerektiğinde bu repoya bak.` : "",
    "",
    "Kurallar:",
    "- Yalnızca kendi rolünün uzmanlığıyla cevap ver. Başka rolün işini gaspetme; gerekirse o role handoff öner.",
    "- Türkçe, net ve kurumsal yaz.",
    "- Somut çıktı ver: madde, checklist, kod iskeleti, kabul kriteri veya karar kaydı.",
    "- Bilmediğin şeyi uydurma; varsayımını açıkça belirt.",
    "- Kullanıcı onayını gerektiren kritik işlerde (production, silme, müşteri iletişimi) needsApproval kullan.",
    "- Yanıtın sonunda kısa bir 'Sonraki adım' bölümü ekle (hangi ajana / hangi iş).",
  ]
    .filter(Boolean)
    .join("\n");
}
