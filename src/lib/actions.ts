import type { AgentActionPayload } from "./types";

const BLOCK_RE = /```baskanos\s*([\s\S]*?)```/i;

export function splitAgentActions(raw: string): { text: string; actions: AgentActionPayload | null } {
  const match = raw.match(BLOCK_RE);
  if (!match) return { text: raw.trim(), actions: null };
  const text = raw.replace(BLOCK_RE, "").trim();
  try {
    const actions = JSON.parse(match[1].trim()) as AgentActionPayload;
    return { text, actions };
  } catch {
    return { text: raw.trim(), actions: null };
  }
}

export const ACTION_FOOTER_INSTRUCTION = `
Yanıtının sonunda (görünür metinden sonra) varsa şu JSON bloğunu ekle; yoksa ekleme:
\`\`\`baskanos
{"board":[{"op":"upsert","title":"...","status":"backlog","note":"...","pipelineStage":"plan"}],"handoff":{"agentId":"architect","brief":"..."},"needsApproval":{"reason":"...","action":"..."}}
\`\`\`
Kurallar:
- Board kartı üretmek istiyorsan board dizisini doldur.
- Başka role devretmen gerekiyorsa handoff yaz (agentId mevcut rol id'lerinden biri olmalı).
- Production, silme, müşteri iletişimi veya geri dönüşü zor işlemlerde needsApproval ekle.
- JSON dışında baskanos bloğu kullanma.
`.trim();
