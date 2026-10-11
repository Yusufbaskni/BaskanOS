import { agentById } from "./agents";
import type { AgentId, PipelineStage } from "./types";

export const PIPELINE: { stage: PipelineStage; label: string; defaultOwner: AgentId }[] = [
  { stage: "brief", label: "Brief", defaultOwner: "product" },
  { stage: "plan", label: "Plan", defaultOwner: "ba" },
  { stage: "code", label: "Kod", defaultOwner: "architect" },
  { stage: "test", label: "Test", defaultOwner: "qa" },
  { stage: "report", label: "Rapor", defaultOwner: "scrum" },
];

export function nextPipelineStage(stage?: PipelineStage) {
  if (!stage) return PIPELINE[0];
  const idx = PIPELINE.findIndex((p) => p.stage === stage);
  if (idx < 0 || idx >= PIPELINE.length - 1) return null;
  return PIPELINE[idx + 1];
}

export function pipelineLabel(stage?: PipelineStage) {
  return PIPELINE.find((p) => p.stage === stage)?.label ?? "—";
}

export function suggestHandoff(fromAgentId: AgentId): AgentId | null {
  const agent = agentById(fromAgentId);
  return agent?.talksTo[0] ?? null;
}

/** Kritik işlerde onay iste. */
export function looksCritical(text: string) {
  return /production|prod\b|sil(me|mek)|drop\s+table|müşteri|deploy|force.?push|rm\s+-rf/i.test(
    text,
  );
}
