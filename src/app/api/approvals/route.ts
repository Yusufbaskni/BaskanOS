import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateState, readState } from "@/lib/store";
import type { ApprovalStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  let body: { id?: string; status?: ApprovalStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }
  if (!body.id || !body.status || !["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "id ve status gerekli." }, { status: 400 });
  }
  updateState((s) => {
    const apr = s.approvals.find((a) => a.id === body.id);
    if (apr) apr.status = body.status!;
  });
  return NextResponse.json({ state: readState() });
}
