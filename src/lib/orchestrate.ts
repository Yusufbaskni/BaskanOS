import { AGENTS, agentById } from "./agents";
import { PIPELINE } from "./pipeline";
import type { AgentId } from "./types";

export type OrchestrateMode = "pipeline" | "core" | "all";

export function resolveLineup(mode: OrchestrateMode): AgentId[] {
  if (mode === "pipeline") {
    return PIPELINE.map((p) => p.defaultOwner);
  }
  if (mode === "core") {
    return AGENTS.filter((a) => a.core).map((a) => a.id);
  }
  return AGENTS.map((a) => a.id);
}

export function buildOrchestrationUserPrompt(opts: {
  brief: string;
  agentId: AgentId;
  prior: { agentId: AgentId; name: string; text: string }[];
}) {
  const agent = agentById(opts.agentId);
  const priorBlock =
    opts.prior.length === 0
      ? "(Henüz önceki ajan çıktısı yok — sen ilk adımısın.)"
      : opts.prior
          .map(
            (p, i) =>
              `### ${i + 1}. ${p.name} (${p.agentId})\n${p.text.slice(0, 3500)}`,
          )
          .join("\n\n");

  return [
    `Kullanıcının tek brief’i:`,
    opts.brief,
    ``,
    `Sen bu brief için yalnızca kendi rolünle (${agent?.title ?? opts.agentId}) katkı sağla.`,
    `Önceki ajanların çıktıları (bağlam; tekrar etme, üzerine ekle / düzelt / uzmanlaş):`,
    priorBlock,
    ``,
    `Çıktın somut olsun. Gereksiz giriş cümlesi yazma.`,
  ].join("\n");
}

export function buildSynthesisPrompt(opts: {
  brief: string;
  parts: { agentId: AgentId; name: string; title: string; text: string }[];
}) {
  const body = opts.parts
    .map(
      (p, i) =>
        `## ${i + 1}. ${p.name} — ${p.title}\n${p.text.slice(0, 4000)}`,
    )
    .join("\n\n");

  return [
    `Kullanıcı tek bir brief verdi. Aşağıda yazılım şirketi ajanlarının katkıları var.`,
    `Görevin: kullanıcıya tek, net, uygulanabilir birleşik çıktı üret.`,
    ``,
    `Brief:`,
    opts.brief,
    ``,
    `Ajan katkıları:`,
    body,
    ``,
    `Çıktı formatı (Türkçe):`,
    `1) Özet (5 satır)`,
    `2) Kararlar / varsayımlar`,
    `3) Uygulama planı (adımlar, sahipler)`,
    `4) Teknik notlar (mimari / API / UI)`,
    `5) Riskler ve test`,
    `6) Sonraki aksiyonlar (checklist)`,
    `Tekrarları birleştir, çelişkileri açıkça işaretle.`,
  ].join("\n");
}

export const MODE_LABELS: Record<OrchestrateMode, string> = {
  pipeline: "Pipeline (5 ajan)",
  core: "Çekirdek ajanlar",
  all: "Tüm sekmeler",
};
