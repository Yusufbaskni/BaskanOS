"use client";

import { useMemo, useState } from "react";
import { agentById } from "@/lib/agents";
import { GROUP_MODEL_LABELS } from "@/lib/model-labels";
import type { Agent, AgentId, ChatMessage } from "@/lib/types";

type Props = {
  agent: Agent;
  messages: ChatMessage[];
  busy: boolean;
  streamingText?: string;
  configured: boolean | null;
  lastModel?: string;
  projectCwd?: string;
  pendingHandoff?: { agentId: AgentId; brief: string } | null;
  onSend: (text: string) => void;
  onHandoff: (agentId: AgentId, brief: string) => void;
  onPinToBoard: () => void;
};

export function AgentRoom({
  agent,
  messages,
  busy,
  streamingText,
  configured,
  lastModel,
  projectCwd,
  pendingHandoff,
  onSend,
  onHandoff,
  onPinToBoard,
}: Props) {
  const [draft, setDraft] = useState("");
  const peerNames = useMemo(
    () =>
      agent.talksTo
        .map((id) => agentById(id)?.name)
        .filter(Boolean)
        .join(" · "),
    [agent],
  );
  const modelLabel = GROUP_MODEL_LABELS[agent.group] ?? "Uzman AI";
  const handoffAgent = pendingHandoff ? agentById(pendingHandoff.agentId) : null;

  return (
    <section className="flex h-full flex-col">
      <header className="border-b border-[var(--line)] px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
              Ajan odası · {modelLabel}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              {agent.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{agent.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {configured === false ? (
              <span className="rounded-full border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-1 text-xs text-[var(--danger)]">
                Cursor API anahtarı yok
              </span>
            ) : configured ? (
              <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs text-[var(--accent)]">
                Cursor AI{lastModel ? ` · ${lastModel}` : ""}
              </span>
            ) : (
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                bağlantı kontrol ediliyor…
              </span>
            )}
            {agent.core ? (
              <span className="rounded-full border border-[var(--brand)]/40 bg-[var(--brand-soft)] px-3 py-1 text-xs text-[var(--brand)]">
                v1 çekirdek
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-[var(--muted)]">{agent.summary}</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Konuştuğu roller: {peerNames || "—"}
          {projectCwd ? ` · Repo: ${projectCwd}` : ""}
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {configured === false ? (
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm">
            Cursor API anahtarı eksik. <code className="text-[var(--brand)]">.env</code> içine{" "}
            <code className="text-[var(--brand)]">CURSOR_API_KEY</code> yazıp uygulamayı yeniden paketle.
          </div>
        ) : null}

        {messages.length === 0 && !streamingText ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-panel)]/50 p-5 text-sm text-[var(--muted)]">
            Bu oda {modelLabel} ile konuşur; yanıtlar board’a ve pipeline’a bağlanabilir. Örnek: “Ödeme
            API’si için kabul kriterli story çıkar”.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-3xl rounded-xl border px-4 py-3 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "ml-auto border-[var(--brand)]/30 bg-[var(--brand-soft)]"
                  : "border-[var(--line)] bg-[var(--bg-panel)]"
              }`}
            >
              <p className="mb-1 text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                {message.role === "user" ? "Sen" : agent.name}
              </p>
              {message.text}
              {message.meta?.boardItemIds?.length ? (
                <p className="mt-2 text-[11px] text-[var(--accent)]">
                  Board’a {message.meta.boardItemIds.length} kart eklendi/güncellendi
                </p>
              ) : null}
            </div>
          ))
        )}

        {busy && streamingText ? (
          <div className="max-w-3xl rounded-xl border border-[var(--accent)]/30 bg-[var(--bg-panel)] px-4 py-3 text-sm whitespace-pre-wrap">
            <p className="mb-1 text-[10px] tracking-[0.14em] text-[var(--accent)] uppercase">
              {agent.name} · canlı
            </p>
            {streamingText}
          </div>
        ) : busy ? (
          <div className="max-w-md rounded-xl border border-[var(--line)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--muted)]">
            {agent.name} düşünüyor…
          </div>
        ) : null}

        {pendingHandoff && handoffAgent ? (
          <div className="max-w-3xl rounded-xl border border-[var(--brand)]/40 bg-[var(--brand-soft)] p-4 text-sm">
            <p className="font-medium text-[var(--brand)]">
              Devret: {handoffAgent.name}
            </p>
            <p className="mt-1 text-[var(--muted)]">{pendingHandoff.brief}</p>
            <button
              type="button"
              onClick={() => onHandoff(pendingHandoff.agentId, pendingHandoff.brief)}
              className="mt-3 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[#1a1405]"
            >
              {handoffAgent.name} odasına gönder
            </button>
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-[var(--line)] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text || busy) return;
          onSend(text);
          setDraft("");
        }}
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || messages.length === 0}
            onClick={onPinToBoard}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
          >
            Son yanıtı board’a ekle
          </button>
          {agent.talksTo.slice(0, 3).map((id) => {
            const peer = agentById(id);
            if (!peer) return null;
            return (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() =>
                  onHandoff(
                    id,
                    messages.filter((m) => m.role === "agent").at(-1)?.text?.slice(0, 600) ||
                      `${agent.name} görevini devretti.`,
                  )
                }
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-40"
              >
                → {peer.name}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            disabled={busy}
            placeholder={`${agent.name} · ${modelLabel} görev yaz…`}
            className="min-h-[72px] flex-1 resize-y rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="self-end rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[#1a1405] hover:brightness-110 disabled:opacity-50"
          >
            Gönder
          </button>
        </div>
      </form>
    </section>
  );
}
