import { NextResponse } from "next/server";
import { agentById } from "@/lib/agents";
import { splitAgentActions } from "@/lib/actions";
import { applyAgentActions, appendMessages } from "@/lib/apply-actions";
import { isAuthenticated } from "@/lib/auth";
import { chatCompletion, llmConfigured, llmProvider } from "@/lib/llm";
import { buildSystemPrompt, resolveCursorModel, resolveModelForGroup } from "@/lib/prompts";
import { activeProject, getThread, readState } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  agentId?: string;
  message?: string;
  projectId?: string;
  stream?: boolean;
  history?: { role: "user" | "agent" | "system"; text: string }[];
};

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz", authRequired: true }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const agentId = String(body.agentId ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!agentId || !message) {
    return NextResponse.json({ error: "agentId ve message gerekli." }, { status: 400 });
  }

  const agent = agentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Ajan bulunamadı." }, { status: 404 });
  }

  const provider = llmProvider();
  if (provider === "none") {
    return NextResponse.json(
      {
        error:
          "Yapay zekâ bağlı değil. Cursor Dashboard → API Keys’ten anahtar alıp .env içine CURSOR_API_KEY=... yaz.",
        configured: false,
        provider: "none",
      },
      { status: 503 },
    );
  }

  const state = readState();
  const project = body.projectId
    ? state.projects.find((p) => p.id === body.projectId) ?? activeProject(state)
    : activeProject(state);

  const prior = getThread(project.id, agentId);
  const now = new Date().toISOString();
  const userMsg: ChatMessage = {
    id: `${agentId}-u-${Date.now()}`,
    role: "user",
    text: message,
    at: now,
  };

  const historySource =
    Array.isArray(body.history) && body.history.length
      ? body.history.slice(-12)
      : [...prior, userMsg].map((m) => ({ role: m.role, text: m.text }));

  const messages = [
    {
      role: "system" as const,
      content: buildSystemPrompt(agent, project.name, project.cwd),
    },
    ...historySource
      .filter((item) => item.role !== "system")
      .map((item) => ({
        role: (item.role === "agent" ? "assistant" : "user") as "assistant" | "user",
        content: item.text,
      })),
  ];

  // Ensure last user message is present
  if (!messages.some((m) => m.role === "user" && m.content === message)) {
    messages.push({ role: "user", content: message });
  }

  const wantStream = body.stream !== false;

  if (!wantStream) {
    try {
      const result = await chatCompletion(agent.group, messages, { cwd: project.cwd });
      const { text, actions } = splitAgentActions(result.text);
      const applied = applyAgentActions({
        projectId: project.id,
        agentId,
        actions,
        userText: message,
        replyText: text,
      });
      const agentMsg: ChatMessage = {
        id: `${agentId}-a-${Date.now()}`,
        role: "agent",
        text,
        at: new Date().toISOString(),
        meta: {
          handoffTo: applied.handoff?.agentId,
          boardItemIds: applied.boardItemIds,
          approvalId: applied.approval?.id,
        },
      };
      appendMessages(project.id, agentId, [...prior, userMsg, agentMsg]);
      return NextResponse.json({
        text,
        model: result.model,
        provider: result.provider,
        agentId: agent.id,
        group: agent.group,
        configured: true,
        handoff: applied.handoff,
        boardItemIds: applied.boardItemIds,
        approval: applied.approval,
        state: readState(),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Bilinmeyen hata.";
      return NextResponse.json(
        {
          error: detail,
          model: provider === "cursor" ? resolveCursorModel(agent.group) : resolveModelForGroup(agent.group),
          provider,
          configured: true,
        },
        { status: 502 },
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(sse(payload)));
      try {
        send({ type: "start", model: resolveCursorModel(agent.group), provider });
        const result = await chatCompletion(agent.group, messages, {
          cwd: project.cwd,
          onDelta: (delta) => send({ type: "delta", text: delta }),
        });
        const { text, actions } = splitAgentActions(result.text);
        const applied = applyAgentActions({
          projectId: project.id,
          agentId,
          actions,
          userText: message,
          replyText: text,
        });
        const agentMsg: ChatMessage = {
          id: `${agentId}-a-${Date.now()}`,
          role: "agent",
          text,
          at: new Date().toISOString(),
          meta: {
            handoffTo: applied.handoff?.agentId,
            boardItemIds: applied.boardItemIds,
            approvalId: applied.approval?.id,
          },
        };
        appendMessages(project.id, agentId, [...prior, userMsg, agentMsg]);
        send({
          type: "done",
          text,
          model: result.model,
          provider: result.provider,
          handoff: applied.handoff,
          boardItemIds: applied.boardItemIds,
          approval: applied.approval,
          state: readState(),
        });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Bilinmeyen hata.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  const provider = llmProvider();
  return NextResponse.json({
    configured: llmConfigured(),
    provider,
    authenticated: await isAuthenticated(),
    pinRequired: (await import("@/lib/auth")).pinConfigured(),
  });
}
