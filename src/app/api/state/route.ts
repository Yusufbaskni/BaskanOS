import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { readState, updateState } from "@/lib/store";
import type { AppState } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz", authRequired: true }, { status: 401 });
  }
  return NextResponse.json(readState());
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz", authRequired: true }, { status: 401 });
  }
  let body: Partial<AppState>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const state = updateState((s) => {
    if (typeof body.activeProjectId === "string") s.activeProjectId = body.activeProjectId;
    if (Array.isArray(body.pins)) s.pins = body.pins;
    if (Array.isArray(body.board)) s.board = body.board;
    if (Array.isArray(body.projects)) s.projects = body.projects;
    if (body.threads && typeof body.threads === "object") s.threads = body.threads;
    if (Array.isArray(body.approvals)) s.approvals = body.approvals;
  });

  return NextResponse.json(state);
}
