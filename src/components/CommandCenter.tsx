"use client";

import { useState } from "react";
import { MODE_LABELS, type OrchestrateMode } from "@/lib/orchestrate";

type AgentProgress = {
  id: string;
  name: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  text?: string;
  error?: string;
};

type Props = {
  configured: boolean | null;
  projectId: string;
  onFinished: () => void;
  onOpenAgent: (id: string) => void;
};

export function CommandCenter({ configured, projectId, onFinished, onOpenAgent }: Props) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<OrchestrateMode>("all");
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<AgentProgress[]>([]);
  const [live, setLive] = useState("");
  const [liveAgent, setLiveAgent] = useState<string | null>(null);
  const [synth, setSynth] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setFinalText("");
    setSynth("");
    setLive("");
    setLiveAgent(null);
    setAgents([]);

    try {
      const res = await fetch("/api/agents/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, projectId, mode }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            type: string;
            agents?: { id: string; name: string; title: string }[];
            agentId?: string;
            name?: string;
            title?: string;
            text?: string;
            error?: string;
            finalText?: string;
          };

          if (payload.type === "start" && payload.agents) {
            setAgents(
              payload.agents.map((a) => ({
                id: a.id,
                name: a.name,
                title: a.title,
                status: "pending",
              })),
            );
          } else if (payload.type === "agent_start" && payload.agentId) {
            setLive("");
            setLiveAgent(payload.agentId);
            setAgents((prev) =>
              prev.map((a) =>
                a.id === payload.agentId ? { ...a, status: "running" } : a,
              ),
            );
          } else if (payload.type === "agent_delta" && payload.text) {
            setLive((t) => t + payload.text);
          } else if (payload.type === "agent_done" && payload.agentId) {
            setAgents((prev) =>
              prev.map((a) =>
                a.id === payload.agentId
                  ? { ...a, status: "done", text: payload.text }
                  : a,
              ),
            );
            setLive("");
            setLiveAgent(null);
          } else if (payload.type === "agent_error" && payload.agentId) {
            setAgents((prev) =>
              prev.map((a) =>
                a.id === payload.agentId
                  ? { ...a, status: "error", error: payload.error }
                  : a,
              ),
            );
            setLive("");
            setLiveAgent(null);
          } else if (payload.type === "synth_start") {
            setSynth("");
            setLiveAgent("synth");
          } else if (payload.type === "synth_delta" && payload.text) {
            setSynth((t) => t + payload.text);
          } else if (payload.type === "synth_done" && payload.text) {
            setSynth(payload.text);
            setLiveAgent(null);
          } else if (payload.type === "synth_error") {
            setSynth(payload.text || "");
            setLiveAgent(null);
          } else if (payload.type === "done") {
            setFinalText(payload.finalText || payload.text || "");
            onFinished();
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Orkestrasyon hatası");
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setBusy(false);
      setLiveAgent(null);
    }
  };

  const doneCount = agents.filter((a) => a.status === "done").length;

  return (
    <section className="flex h-full flex-col">
      <header className="border-b border-[var(--line)] px-6 py-5">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
          Tek prompt · tüm sekmeler
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Komut Merkezi
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Bir brief yaz; sistem ajan sekmelerini sırayla çalıştırır, sonra tek birleşik çıktı verir.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {configured === false ? (
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm">
            Cursor API anahtarı gerekli.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODE_LABELS) as OrchestrateMode[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => setMode(m)}
              className={`rounded-full border px-3 py-1 text-xs ${
                mode === m
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "border-[var(--line)] text-[var(--muted)]"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={busy}
          placeholder="Örn: Müşteri portalına fatura ödeme ekranı ekle — gereksinim, mimari, UI, güvenlik ve test planı çıkar."
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
        />

        <button
          type="button"
          disabled={busy || !prompt.trim() || configured === false}
          onClick={() => void run()}
          className="rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[#1a1405] hover:brightness-110 disabled:opacity-50"
        >
          {busy
            ? `Çalışıyor… ${doneCount}/${agents.length || "—"}`
            : "Tüm sekmelerden topla"}
        </button>

        {error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : null}

        {agents.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenAgent(a.id)}
                className={`rounded-xl border p-3 text-left text-sm ${
                  a.status === "running"
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10"
                    : a.status === "done"
                      ? "border-[var(--line)] bg-[var(--bg-panel)]"
                      : a.status === "error"
                        ? "border-[var(--danger)]/40 bg-[var(--danger)]/10"
                        : "border-[var(--line)] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {a.status === "pending"
                      ? "bekliyor"
                      : a.status === "running"
                        ? "yazıyor"
                        : a.status === "done"
                          ? "tamam"
                          : "hata"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{a.title}</p>
                {a.error ? (
                  <p className="mt-2 text-xs text-[var(--danger)]">{a.error}</p>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {busy && liveAgent && liveAgent !== "synth" && live ? (
          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--bg-panel)] p-4 text-sm whitespace-pre-wrap">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--accent)]">
              Canlı · {agents.find((a) => a.id === liveAgent)?.name}
            </p>
            {live}
          </div>
        ) : null}

        {(synth || (busy && liveAgent === "synth")) && (
          <div className="rounded-xl border border-[var(--brand)]/40 bg-[var(--brand-soft)] p-4 text-sm whitespace-pre-wrap">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand)]">
              Birleşik çıktı {busy && liveAgent === "synth" ? "(yazılıyor…)" : ""}
            </p>
            {synth || "…"}
          </div>
        )}

        {finalText && !busy ? (
          <div className="rounded-xl border border-[var(--brand)]/40 bg-[var(--bg-panel)] p-5 text-sm whitespace-pre-wrap">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand)]">
              Kullanıcıya çıktı
            </p>
            {finalText}
          </div>
        ) : null}
      </div>
    </section>
  );
}
