import { Agent, CursorAgentError } from "@cursor/sdk";
import { ACTION_FOOTER_INSTRUCTION } from "./actions";
import type { AgentGroupId } from "./types";
import { resolveCursorModel, resolveCursorModelSelection, resolveModelForGroup } from "./prompts";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmResult = {
  text: string;
  model: string;
  provider: "cursor" | "openai";
};

function cursorKey() {
  return process.env.CURSOR_API_KEY?.trim() || process.env.BASKANOS_CURSOR_API_KEY?.trim() || "";
}

function openaiKey() {
  return process.env.BASKANOS_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
}

function openaiBase() {
  return (
    process.env.BASKANOS_API_BASE?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
}

export function llmConfigured() {
  return Boolean(cursorKey() || openaiKey());
}

export function llmProvider(): "cursor" | "openai" | "none" {
  if (cursorKey()) return "cursor";
  if (openaiKey()) return "openai";
  return "none";
}

function flattenMessages(messages: LlmMessage[]) {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const rest = messages.filter((m) => m.role !== "system");
  const transcript = rest
    .map((m) => `${m.role === "assistant" ? "Ajan" : "Kullanıcı"}: ${m.content}`)
    .join("\n\n");
  return [
    system,
    "",
    ACTION_FOOTER_INSTRUCTION,
    "",
    "Aşağıdaki konuşmaya kendi rolünle devam et. Sadece ajan yanıtını yaz; rol etiketi koyma.",
    "",
    transcript || "Kullanıcı: (boş)",
  ].join("\n");
}

export type StreamHandlers = {
  onDelta?: (text: string) => void;
};

async function chatViaCursor(
  group: AgentGroupId,
  messages: LlmMessage[],
  cwd: string,
  handlers?: StreamHandlers,
): Promise<LlmResult> {
  const apiKey = cursorKey();
  if (!apiKey) throw new Error("CURSOR_API_KEY yok.");

  const model = resolveCursorModelSelection(group);
  const prompt = flattenMessages(messages);
  let assembled = "";

  try {
    await using agent = await Agent.create({
      apiKey,
      model,
      local: { cwd },
    });

    const run = await agent.send(prompt, {
      onDelta: ({ update }) => {
        if (update.type === "text-delta" && typeof update.text === "string") {
          assembled += update.text;
          handlers?.onDelta?.(update.text);
        }
      },
    });

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        const message = event.message as { content?: { type: string; text?: string }[] };
        for (const block of message.content ?? []) {
          if (block.type === "text" && block.text && !assembled) {
            assembled = block.text;
            handlers?.onDelta?.(block.text);
          }
        }
      }
    }

    const waited = await run.wait();
    const resultText =
      (typeof waited?.result === "string" && waited.result) || assembled || "";

    const text = resultText.trim();
    if (!text) throw new Error("Cursor boş yanıt döndü.");
    return { text, model: model.id, provider: "cursor" };
  } catch (error) {
    if (error instanceof CursorAgentError) {
      throw new Error(`Cursor başlatılamadı: ${error.message}`);
    }
    throw error;
  }
}

async function chatViaOpenAI(
  group: AgentGroupId,
  messages: LlmMessage[],
  handlers?: StreamHandlers,
): Promise<LlmResult> {
  const apiKey = openaiKey();
  if (!apiKey) throw new Error("OpenAI uyumlu API anahtarı yok.");

  const model = resolveModelForGroup(group);
  const withFooter = messages.map((m, i) =>
    i === 0 && m.role === "system"
      ? { ...m, content: `${m.content}\n\n${ACTION_FOOTER_INSTRUCTION}` }
      : m,
  );

  const res = await fetch(`${openaiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      stream: Boolean(handlers?.onDelta),
      messages: withFooter,
    }),
  });

  if (handlers?.onDelta && res.ok && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            full += delta;
            handlers.onDelta(delta);
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (!full.trim()) throw new Error("Model boş yanıt döndü.");
    return { text: full.trim(), model, provider: "openai" };
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof body?.error?.message === "string"
        ? body.error.message
        : `Model isteği başarısız (${res.status}).`;
    throw new Error(detail);
  }

  const text = body?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("Model boş yanıt döndü.");
  }

  return { text: text.trim(), model, provider: "openai" };
}

export async function chatCompletion(
  group: AgentGroupId,
  messages: LlmMessage[],
  options?: { cwd?: string; onDelta?: (text: string) => void },
): Promise<LlmResult> {
  const cwd = options?.cwd?.trim() || process.cwd();
  const handlers = options?.onDelta ? { onDelta: options.onDelta } : undefined;
  if (cursorKey()) return chatViaCursor(group, messages, cwd, handlers);
  if (openaiKey()) return chatViaOpenAI(group, messages, handlers);
  throw new Error(
    "API anahtarı yok. .env içine CURSOR_API_KEY yaz (Cursor Dashboard → API Keys).",
  );
}

export { resolveCursorModel };
