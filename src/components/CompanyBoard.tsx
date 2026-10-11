"use client";

import { useState } from "react";
import { AGENTS, agentById } from "@/lib/agents";
import { PIPELINE, pipelineLabel } from "@/lib/pipeline";
import type { BoardItem, BoardItemStatus } from "@/lib/types";

const COLUMNS: { id: BoardItemStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "doing", label: "Yapılıyor" },
  { id: "review", label: "İnceleme" },
  { id: "done", label: "Bitti" },
];

type Props = {
  items: BoardItem[];
  onOpenAgent: (agentId: string) => void;
  onMove: (id: string, status: BoardItemStatus) => void;
  onCreate: (input: { title: string; ownerId: string; note: string }) => void;
  onAdvance: (id: string) => void;
  onDelete: (id: string) => void;
};

export function CompanyBoard({
  items,
  onOpenAgent,
  onMove,
  onCreate,
  onAdvance,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [ownerId, setOwnerId] = useState("scrum");
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <section className="flex h-full flex-col">
      <header className="border-b border-[var(--line)] px-6 py-5">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
          Ortak proje beyni
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Company Board
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Kart sürükle, yeni iş ekle, pipeline ilerlet. Ajan çıktıları buraya düşer.
          Zincir: {PIPELINE.map((p) => p.label).join(" → ")}.
        </p>

        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onCreate({ title: title.trim(), ownerId, note: note.trim() });
            setTitle("");
            setNote("");
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yeni kart başlığı"
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Not (opsiyonel)"
            className="min-w-[160px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[#1a1405]"
          >
            Kart ekle
          </button>
        </form>
      </header>

      <div className="grid flex-1 gap-4 overflow-auto p-6 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const columnItems = items.filter((item) => item.status === col.id);
          return (
            <div
              key={col.id}
              className="min-h-[280px] rounded-xl border border-[var(--line)] bg-[var(--bg-panel)]/80 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId || e.dataTransfer.getData("text/plain");
                if (id) onMove(id, col.id);
                setDragId(null);
              }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="text-xs text-[var(--muted)]">{columnItems.length}</span>
              </div>
              <div className="space-y-2">
                {columnItems.map((item) => {
                  const owner = agentById(item.ownerId);
                  return (
                    <article
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(item.id);
                        e.dataTransfer.setData("text/plain", item.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] p-3 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-snug">{item.title}</h4>
                        <button
                          type="button"
                          title="Sil"
                          onClick={() => onDelete(item.id)}
                          className="text-[11px] text-[var(--muted)] hover:text-[var(--danger)]"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">{item.note}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                          {pipelineLabel(item.pipelineStage)}
                        </span>
                        {item.fromAgentId ? (
                          <span className="rounded-full border border-[var(--brand)]/30 px-2 py-0.5 text-[10px] text-[var(--brand)]">
                            ← {agentById(item.fromAgentId)?.name ?? item.fromAgentId}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenAgent(item.ownerId)}
                          className="text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          {owner?.name ?? item.ownerId} →
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdvance(item.id)}
                          className="text-xs font-medium text-[var(--brand)] hover:underline"
                        >
                          Sonraki aşama
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
