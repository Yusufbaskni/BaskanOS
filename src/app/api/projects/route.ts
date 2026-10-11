import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateState, readState } from "@/lib/store";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";

function nid() {
  return `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  let body: {
    action?: "create" | "update" | "select" | "delete";
    id?: string;
    name?: string;
    company?: string;
    cwd?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (body.action === "create") {
    if (!body.name?.trim() || !body.cwd?.trim()) {
      return NextResponse.json({ error: "name ve cwd gerekli." }, { status: 400 });
    }
    let created: Project | null = null;
    updateState((s) => {
      created = {
        id: nid(),
        name: body.name!.trim(),
        company: body.company?.trim() || "Baskani Yazılım",
        cwd: body.cwd!.trim(),
      };
      s.projects.push(created);
      s.activeProjectId = created.id;
    });
    return NextResponse.json({ project: created, state: readState() });
  }

  if (body.action === "select" && body.id) {
    updateState((s) => {
      if (s.projects.some((p) => p.id === body.id)) s.activeProjectId = body.id!;
    });
    return NextResponse.json({ state: readState() });
  }

  if (body.action === "update" && body.id) {
    updateState((s) => {
      const p = s.projects.find((x) => x.id === body.id);
      if (!p) return;
      if (body.name) p.name = body.name.trim();
      if (body.company) p.company = body.company.trim();
      if (body.cwd) p.cwd = body.cwd.trim();
    });
    return NextResponse.json({ state: readState() });
  }

  if (body.action === "delete" && body.id) {
    updateState((s) => {
      if (s.projects.length <= 1) return;
      s.projects = s.projects.filter((p) => p.id !== body.id);
      if (s.activeProjectId === body.id) s.activeProjectId = s.projects[0].id;
      s.board = s.board.filter((b) => b.projectId !== body.id);
    });
    return NextResponse.json({ state: readState() });
  }

  return NextResponse.json({ error: "Geçersiz action." }, { status: 400 });
}
