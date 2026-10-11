"use client";

import { AGENTS, GROUPS, agentById } from "@/lib/agents";
import type { AgentId } from "@/lib/types";

type Props = {
  activeId: AgentId | "board" | "run";
  onSelect: (id: AgentId | "board" | "run") => void;
  pinned: AgentId[];
  onTogglePin: (id: AgentId) => void;
};

export function AgentSidebar({ activeId, onSelect, pinned, onTogglePin }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="font-[family-name:var(--font-display)] text-[11px] font-semibold tracking-[0.22em] text-[var(--brand)] uppercase">
          Baskani Yazılım
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
          BaskanOS
        </h1>
      </div>

      <div className="space-y-0.5 px-3 py-2">
        <button
          type="button"
          onClick={() => onSelect("run")}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
            activeId === "run"
              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
              : "text-[var(--text)] hover:bg-white/5"
          }`}
        >
          Komut Merkezi
        </button>
        <button
          type="button"
          onClick={() => onSelect("board")}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
            activeId === "board"
              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
              : "text-[var(--text)] hover:bg-white/5"
          }`}
        >
          Company Board
        </button>
      </div>

      {pinned.length > 0 ? (
        <div className="px-3 pb-2">
          <p className="mb-1 px-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
            Sabit ajanlar
          </p>
          <div className="space-y-0.5">
            {pinned.map((id) => {
              const agent = agentById(id);
              if (!agent) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm ${
                    activeId === id ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span>{agent.name}</span>
                  {agent.core ? (
                    <span className="text-[10px] text-[var(--accent)]">çekirdek</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => {
          const members = AGENTS.filter((a) => a.group === group.id);
          return (
            <div key={group.id} className="mb-3">
              <p className="mb-1 px-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--muted)] uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {members.map((agent) => {
                  const isActive = activeId === agent.id;
                  const isPinned = pinned.includes(agent.id);
                  return (
                    <div
                      key={agent.id}
                      className={`group flex items-center gap-1 rounded-md ${
                        isActive ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(agent.id)}
                        className="min-w-0 flex-1 px-2.5 py-1.5 text-left text-sm"
                      >
                        <span className="block truncate">{agent.name}</span>
                        <span className="block truncate text-[11px] text-[var(--muted)]">
                          {agent.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        title={isPinned ? "Sabiti kaldır" : "Sabitle"}
                        onClick={() => onTogglePin(agent.id)}
                        className={`mr-1 rounded px-1.5 py-0.5 text-[11px] ${
                          isPinned
                            ? "text-[var(--brand)]"
                            : "text-[var(--muted)] opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isPinned ? "★" : "☆"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
