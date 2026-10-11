"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentRoom } from "@/components/AgentRoom";
import { AgentSidebar } from "@/components/AgentSidebar";
import { AuthGate } from "@/components/AuthGate";
import { CommandCenter } from "@/components/CommandCenter";
import { CompanyBoard } from "@/components/CompanyBoard";
import { ProjectBar } from "@/components/ProjectBar";
import { agentById } from "@/lib/agents";
import { threadKey } from "@/lib/store-client";
import type {
  AgentId,
  AppState,
  BoardItemStatus,
  ChatMessage,
} from "@/lib/types";

export function Studio() {
  const [authed, setAuthed] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<AgentId | "board" | "run">("run");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lastModels, setLastModels] = useState<Record<string, string>>({});
  const [pendingHandoff, setPendingHandoff] = useState<{
    agentId: AgentId;
    brief: string;
  } | null>(null);

  const onAuthed = useCallback(() => setAuthed(true), []);

  const load = useCallback(async () => {
    const [stateRes, chatRes] = await Promise.all([
      fetch("/api/state"),
      fetch("/api/agents/chat"),
    ]);
    if (stateRes.status === 401) {
      setAuthed(false);
      return;
    }
    const data = (await stateRes.json()) as AppState;
    setState(data);
    const chat = await chatRes.json();
    setConfigured(Boolean(chat.configured));
  }, []);

  useEffect(() => {
    if (!authed) return;
    void load();
  }, [authed, load]);

  const project = useMemo(() => {
    if (!state) return null;
    return state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];
  }, [state]);

  const boardItems = useMemo(() => {
    if (!state || !project) return [];
    return state.board.filter((b) => b.projectId === project.id);
  }, [state, project]);

  const activeAgent =
    view === "board" || view === "run" ? null : agentById(view) ?? null;

  const messages: ChatMessage[] = useMemo(() => {
    if (!state || !project || !activeAgent) return [];
    return state.threads[threadKey(project.id, activeAgent.id)] ?? [];
  }, [state, project, activeAgent]);

  const togglePin = async (id: AgentId) => {
    if (!state) return;
    const pins = state.pins.includes(id)
      ? state.pins.filter((x) => x !== id)
      : [...state.pins, id];
    const res = await fetch("/api/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pins }),
    });
    setState(await res.json());
  };

  const sendToAgent = async (agentId: AgentId, text: string) => {
    if (!state || !project || busyId) return;
    const key = threadKey(project.id, agentId);
    const prior = state.threads[key] ?? [];
    const userMsg: ChatMessage = {
      id: `${agentId}-u-${Date.now()}`,
      role: "user",
      text,
      at: new Date().toISOString(),
    };
    setState({
      ...state,
      threads: { ...state.threads, [key]: [...prior, userMsg] },
    });
    setBusyId(agentId);
    setStreamingText("");
    setPendingHandoff(null);

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: text,
          projectId: project.id,
          stream: true,
          history: [...prior, userMsg].map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (typeof data.configured === "boolean") setConfigured(data.configured);
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

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
            text?: string;
            error?: string;
            model?: string;
            handoff?: { agentId: AgentId; brief: string };
            state?: AppState;
            configured?: boolean;
          };
          if (payload.type === "delta" && payload.text) {
            assembled += payload.text;
            setStreamingText(assembled);
          } else if (payload.type === "done") {
            if (payload.model) {
              setLastModels((prev) => ({ ...prev, [agentId]: payload.model! }));
            }
            if (payload.handoff) setPendingHandoff(payload.handoff);
            if (payload.state) setState(payload.state);
            setConfigured(true);
            setStreamingText("");
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Ajan hatası");
          }
        }
      }
    } catch (error) {
      const errText = `Bağlantı hatası: ${error instanceof Error ? error.message : "ağ hatası"}`;
      setState((prev) => {
        if (!prev || !project) return prev;
        const k = threadKey(project.id, agentId);
        const cur = prev.threads[k] ?? [];
        return {
          ...prev,
          threads: {
            ...prev.threads,
            [k]: [
              ...cur,
              {
                id: `${agentId}-e-${Date.now()}`,
                role: "agent",
                text: errText,
                at: new Date().toISOString(),
              },
            ],
          },
        };
      });
      setStreamingText("");
    } finally {
      setBusyId(null);
      await load();
    }
  };

  const boardPost = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  if (!authed) return <AuthGate onAuthed={onAuthed} />;

  if (!state || !project) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-[var(--muted)]">
        Durum yükleniyor…
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-elevated)]/90 backdrop-blur">
        <ProjectBar
          projects={state.projects}
          activeProjectId={state.activeProjectId}
          approvals={state.approvals.filter((a) => a.projectId === project.id)}
          onSelectProject={async (id) => {
            const res = await fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "select", id }),
            });
            const data = await res.json();
            if (data.state) setState(data.state);
          }}
          onCreateProject={async (input) => {
            const res = await fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "create", ...input }),
            });
            const data = await res.json();
            if (data.state) setState(data.state);
          }}
          onResolveApproval={async (id, status) => {
            const res = await fetch("/api/approvals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, status }),
            });
            const data = await res.json();
            if (data.state) setState(data.state);
          }}
        />
        <div className="min-h-0 flex-1">
          <AgentSidebar
            activeId={view}
            onSelect={setView}
            pinned={state.pins}
            onTogglePin={togglePin}
          />
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-transparent">
        {view === "run" ? (
          <CommandCenter
            configured={configured}
            projectId={project.id}
            onFinished={() => void load()}
            onOpenAgent={(id) => setView(id)}
          />
        ) : view === "board" || !activeAgent ? (
          <CompanyBoard
            items={boardItems}
            onOpenAgent={(id) => setView(id)}
            onMove={(id, status: BoardItemStatus) =>
              void boardPost({ action: "update", id, status })
            }
            onCreate={(input) =>
              void boardPost({
                action: "create",
                ...input,
                projectId: project.id,
                pipelineStage: "brief",
              })
            }
            onAdvance={(id) => void boardPost({ action: "advance", id })}
            onDelete={(id) => void boardPost({ action: "delete", id })}
          />
        ) : (
          <AgentRoom
            agent={activeAgent}
            messages={messages}
            busy={busyId === activeAgent.id}
            streamingText={busyId === activeAgent.id ? streamingText : ""}
            configured={configured}
            lastModel={lastModels[activeAgent.id]}
            projectCwd={project.cwd}
            pendingHandoff={pendingHandoff}
            onSend={(text) => void sendToAgent(activeAgent.id, text)}
            onHandoff={(agentId, brief) => {
              setPendingHandoff(null);
              setView(agentId);
              void sendToAgent(
                agentId,
                `Önceki ajan (${activeAgent.name}) devretti:\n\n${brief}`,
              );
            }}
            onPinToBoard={() => {
              const last = [...messages].reverse().find((m) => m.role === "agent");
              if (!last) return;
              void boardPost({
                action: "create",
                title: `${activeAgent.name}: ${last.text.slice(0, 60)}…`,
                note: last.text.slice(0, 400),
                ownerId: activeAgent.id,
                projectId: project.id,
                status: "review",
              });
              setView("board");
            }}
          />
        )}
      </main>
    </div>
  );
}
