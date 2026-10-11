import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateState, readState, activeProject } from "@/lib/store";
import type { BoardItem, BoardItemStatus, PipelineStage } from "@/lib/types";
import { nextPipelineStage } from "@/lib/pipeline";

export const runtime = "nodejs";

function nid() {
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  let body: {
    action?: "create" | "update" | "delete" | "advance";
    id?: string;
    title?: string;
    note?: string;
    status?: BoardItemStatus;
    ownerId?: string;
    pipelineStage?: PipelineStage;
    projectId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const state = readState();
  const projectId = body.projectId || activeProject(state).id;
  const now = new Date().toISOString();

  if (body.action === "create") {
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title gerekli." }, { status: 400 });
    }
    let created: BoardItem | null = null;
    updateState((s) => {
      created = {
        id: nid(),
        title: body.title!.trim(),
        note: body.note?.trim() || "",
        status: body.status ?? "backlog",
        ownerId: body.ownerId || "scrum",
        projectId,
        pipelineStage: body.pipelineStage ?? "brief",
        updatedAt: now,
      };
      s.board.unshift(created);
    });
    return NextResponse.json({ item: created, state: readState() });
  }

  if (body.action === "update" && body.id) {
    updateState((s) => {
      const item = s.board.find((b) => b.id === body.id);
      if (!item) return;
      if (body.title != null) item.title = body.title;
      if (body.note != null) item.note = body.note;
      if (body.status) item.status = body.status;
      if (body.ownerId) item.ownerId = body.ownerId;
      if (body.pipelineStage) item.pipelineStage = body.pipelineStage;
      item.updatedAt = now;
    });
    return NextResponse.json({ state: readState() });
  }

  if (body.action === "delete" && body.id) {
    updateState((s) => {
      s.board = s.board.filter((b) => b.id !== body.id);
    });
    return NextResponse.json({ state: readState() });
  }

  if (body.action === "advance" && body.id) {
    let nextItem: BoardItem | null = null;
    updateState((s) => {
      const item = s.board.find((b) => b.id === body.id);
      if (!item) return;
      const next = nextPipelineStage(item.pipelineStage);
      if (!next) {
        item.status = "done";
        item.updatedAt = now;
        return;
      }
      item.status = "done";
      item.updatedAt = now;
      nextItem = {
        id: nid(),
        title: `${next.label}: ${item.title}`,
        note: `Önceki aşama (${item.pipelineStage ?? "—"}) tamamlandı. Devam et.`,
        status: "backlog",
        ownerId: next.defaultOwner,
        projectId: item.projectId,
        pipelineStage: next.stage,
        fromAgentId: item.ownerId,
        updatedAt: now,
      };
      s.board.unshift(nextItem);
    });
    return NextResponse.json({ item: nextItem, state: readState() });
  }

  return NextResponse.json({ error: "Geçersiz action." }, { status: 400 });
}
