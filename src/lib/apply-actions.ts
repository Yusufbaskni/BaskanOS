import { agentById } from "./agents";
import { looksCritical } from "./pipeline";
import { updateState } from "./store";
import type { AgentActionPayload, AgentId, Approval, BoardItem, ChatMessage } from "./types";

function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function applyAgentActions(opts: {
  projectId: string;
  agentId: AgentId;
  actions: AgentActionPayload | null;
  userText: string;
  replyText: string;
}): {
  boardItemIds: string[];
  approval: Approval | null;
  handoff: { agentId: AgentId; brief: string } | null;
} {
  const boardItemIds: string[] = [];
  let approval: Approval | null = null;
  const handoff = opts.actions?.handoff?.agentId
    ? {
        agentId: opts.actions.handoff.agentId,
        brief: opts.actions.handoff.brief || opts.replyText.slice(0, 500),
      }
    : null;

  updateState((state) => {
    const now = new Date().toISOString();
    for (const op of opts.actions?.board ?? []) {
      if (op.op === "move" && op.id && op.status) {
        const item = state.board.find((b) => b.id === op.id && b.projectId === opts.projectId);
        if (item) {
          item.status = op.status;
          item.updatedAt = now;
          boardItemIds.push(item.id);
        }
        continue;
      }
      if (op.op === "upsert") {
        if (op.id) {
          const item = state.board.find((b) => b.id === op.id && b.projectId === opts.projectId);
          if (item) {
            if (op.title) item.title = op.title;
            if (op.status) item.status = op.status;
            if (op.note) item.note = op.note;
            if (op.ownerId) item.ownerId = op.ownerId;
            if (op.pipelineStage) item.pipelineStage = op.pipelineStage;
            item.updatedAt = now;
            boardItemIds.push(item.id);
            continue;
          }
        }
        const item: BoardItem = {
          id: nid("card"),
          title: op.title || `${agentById(opts.agentId)?.name ?? opts.agentId} çıktısı`,
          status: op.status ?? "backlog",
          ownerId: op.ownerId || opts.agentId,
          note: op.note || opts.replyText.slice(0, 280),
          projectId: opts.projectId,
          pipelineStage: op.pipelineStage,
          fromAgentId: opts.agentId,
          updatedAt: now,
        };
        state.board.unshift(item);
        boardItemIds.push(item.id);
      }
    }

    const needs =
      opts.actions?.needsApproval ||
      (looksCritical(opts.userText) || looksCritical(opts.replyText)
        ? {
            reason: "Kritik işlem tespit edildi",
            action: opts.userText.slice(0, 200),
          }
        : null);

    if (needs) {
      approval = {
        id: nid("apr"),
        status: "pending",
        reason: needs.reason,
        action: needs.action,
        agentId: opts.agentId,
        projectId: opts.projectId,
        createdAt: now,
      };
      state.approvals.unshift(approval);
    }
  });

  return { boardItemIds, approval, handoff };
}

export function appendMessages(
  projectId: string,
  agentId: AgentId,
  messages: ChatMessage[],
) {
  updateState((state) => {
    const key = `${projectId}:${agentId}`;
    state.threads[key] = messages.slice(-80);
  });
}
