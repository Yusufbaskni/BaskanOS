import { NextResponse } from "next/server";
import {
  authCookieOptions,
  isAuthenticated,
  pinConfigured,
  sessionToken,
  verifyPin,
  AUTH_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    pinRequired: pinConfigured(),
    authenticated: await isAuthenticated(),
  });
}

export async function POST(request: Request) {
  let body: { pin?: string; action?: "login" | "logout" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  if (body.action === "logout") {
    const res = NextResponse.json({ ok: true, authenticated: !pinConfigured() });
    res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  if (!pinConfigured()) {
    return NextResponse.json({ ok: true, authenticated: true });
  }

  if (!verifyPin(String(body.pin ?? ""))) {
    return NextResponse.json({ error: "PIN hatalı." }, { status: 401 });
  }

  const token = sessionToken();
  const res = NextResponse.json({ ok: true, authenticated: true });
  const opts = authCookieOptions(token);
  res.cookies.set(opts.name, opts.value, opts);
  return res;
}
