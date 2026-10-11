import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "baskanos_auth";

export function pinConfigured() {
  return Boolean(process.env.BASKANOS_PIN?.trim());
}

function expectedToken() {
  const pin = process.env.BASKANOS_PIN?.trim();
  if (!pin) return "";
  return createHmac("sha256", pin).update("baskanos-session-v1").digest("hex");
}

export function verifyPin(pin: string) {
  const expected = process.env.BASKANOS_PIN?.trim() ?? "";
  if (!expected) return true;
  const a = Buffer.from(pin);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionToken() {
  return expectedToken();
}

export async function isAuthenticated() {
  if (!pinConfigured()) return true;
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value ?? "";
  const expected = expectedToken();
  if (!value || !expected || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export function authCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: false,
    maxAge: 60 * 60 * 24 * 30,
  };
}

export { COOKIE as AUTH_COOKIE };
