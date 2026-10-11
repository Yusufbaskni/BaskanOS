import { NextResponse } from "next/server";
import { agentById } from "@/lib/agents";
import { splitAgentActions } from "@/lib/actions";
import { applyAgentActions, appendMessages } from "@/lib/apply-actions";
import { isAuthenticated } from "@/lib/auth";
import { chatCompletion, llmConfigured, llmProvider } from "@/lib/llm";
import {
  buildOrchestrationUserPrompt,
  buildSynthesisPrompt,
  resolveLineup,
  type OrchestrateMode,
} from "@/lib/orchestrate";
import { buildSystemPrompt } from "@/lib/prompts";
import { activeProject, getThread, readState, updateState } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 800;

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz", authRequired: true }, { status: 401 });
  }

  let body: { prompt?: string; projectId?: string; mode?: OrchestrateMode };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt gerekli." }, { status: 400 });
  }

  const provider = llmProvider();
  if (provider === "none" || !llmConfigured()) {
    return NextResponse.json(
      { error: "Cursor API anahtarı yok.", configured: false },
      { status: 503 },
    );
  }

  const mode: OrchestrateMode =
    body.mode === "pipeline" || body.mode === "core" || body.mode === "all"
      ? body.mode
      : "all";

  const state = readState();
  const project = body.projectId
    ? state.projects.find((p) => p.id === body.projectId) ?? activeProject(state)
    : activeProject(state);

  const lineup = resolveLineup(mode);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(sse(payload)));

      const parts: {
        agentId: string;
        name: string;
        title: string;
        text: string;
        error?: string;
      }[] = [];

      try {
        send({
          type: "start",
          mode,
          projectId: project.id,
          agents: lineup.map((id) => {
            const a = agentById(id);
            return { id, name: a?.name ?? id, title: a?.title ?? id };
          }),
        });

        for (const agentId of lineup) {
          const agent = agentById(agentId);
          if (!agent) continue;

          send({ type: "agent_start", agentId, name: agent.name, title: agent.title });

          const userContent = buildOrchestrationUserPrompt({
            brief: prompt,
            agentId,
            prior: parts
              .filter((p) => !p.error)
              .map((p) => ({ agentId: p.agentId, name: p.name, text: p.text })),
          });

          try {
            let live = "";
            const result = await chatCompletion(
              agent.group,
              [
                {
                  role: "system",
                  content: buildSystemPrompt(agent, project.name, project.cwd),
                },
                { role: "user", content: userContent },
              ],
              {
                cwd: project.cwd,
                onDelta: (delta) => {
                  live += delta;
                  send({ type: "agent_delta", agentId, text: delta });
                },
              },
            );

            const { text, actions } = splitAgentActions(result.text || live);
            const applied = applyAgentActions({
              projectId: project.id,
              agentId,
              actions,
              userText: prompt,
              replyText: text,
            });

            const prior = getThread(project.id, agentId);
            const now = new Date().toISOString();
            const userMsg: ChatMessage = {
              id: `${agentId}-orch-u-${Date.now()}`,
              role: "user",
              text: `[Orkestrasyon]\n${prompt}`,
              at: now,
            };
            const agentMsg: ChatMessage = {
              id: `${agentId}-orch-a-${Date.now()}`,
              role: "agent",
              text,
              at: new Date().toISOString(),
              meta: {
                boardItemIds: applied.boardItemIds,
                approvalId: applied.approval?.id,
              },
            };
            appendMessages(project.id, agentId, [...prior, userMsg, agentMsg]);

            parts.push({
              agentId,
              name: agent.name,
              title: agent.title,
              text,
            });

            send({
              type: "agent_done",
              agentId,
              name: agent.name,
              text,
              model: result.model,
              boardItemIds: applied.boardItemIds,
            });
          } catch (error) {
            const detail = error instanceof Error ? error.message : "Ajan hatası";
            parts.push({
              agentId,
              name: agent.name,
              title: agent.title,
              text: "",
              error: detail,
            });
            send({ type: "agent_error", agentId, name: agent.name, error: detail });
          }
        }

        // Birleşik çıktı — Scrum Master sentezi
        const synthAgent = agentById("scrum") ?? agentById("cto") ?? agentById("product");
        let finalText = "";

        const okParts = parts.filter((p) => p.text && !p.error);
        if (synthAgent && okParts.length > 0) {
          send({
            type: "synth_start",
            agentId: synthAgent.id,
            name: synthAgent.name,
          });
          try {
            let live = "";
            const result = await chatCompletion(
              synthAgent.group,
              [
                {
                  role: "system",
                  content: [
                    buildSystemPrompt(synthAgent, project.name, project.cwd),
                    "",
                    "Şu an orkestratör sintesistisin. Tüm ajan çıktılarını tek kullanıcı raporuna birleştir.",
                  ].join("\n"),
                },
                {
                  role: "user",
                  content: buildSynthesisPrompt({ brief: prompt, parts: okParts }),
                },
              ],
              {
                cwd: project.cwd,
                onDelta: (delta) => {
                  live += delta;
                  send({ type: "synth_delta", text: delta });
                },
              },
            );
            finalText = splitAgentActions(result.text || live).text;
            send({ type: "synth_done", text: finalText, model: result.model });
          } catch (error) {
            finalText = okParts
              .map((p) => `## ${p.name}\n${p.text}`)
              .join("\n\n");
            send({
              type: "synth_error",
              error: error instanceof Error ? error.message : "Sentez hatası",
              text: finalText,
            });
          }
        } else {
          finalText =
            okParts.map((p) => `## ${p.name}\n${p.text}`).join("\n\n") ||
            "Hiçbir ajan yanıt üretemedi.";
        }

        // Board’a birleşik kart
        updateState((s) => {
          s.board.unshift({
            id: nid("orch"),
            title: `Orkestrasyon: ${prompt.slice(0, 72)}${prompt.length > 72 ? "…" : ""}`,
            note: finalText.slice(0, 500),
            status: "review",
            ownerId: "scrum",
            projectId: project.id,
            pipelineStage: "report",
            updatedAt: new Date().toISOString(),
          });
        });

        send({
          type: "done",
          finalText,
          parts,
          state: readState(),
        });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Orkestrasyon başarısız",
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
