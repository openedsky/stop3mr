import { NextRequest, NextResponse } from "next/server";
import { rateLimitPersistent } from "@/lib/rate-limit";
import { getRateLimitInternalSecret, RATE_LIMIT_KEY_MAX } from "@/lib/security";

function secretsEqual(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  let same = 0;
  for (let i = 0; i < expected.length; i++) {
    same |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return same === 0;
}

export async function POST(request: NextRequest) {
  let expected = "";
  try {
    expected = getRateLimitInternalSecret();
  } catch {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  const secret = request.headers.get("x-rl-secret") ?? "";
  if (!secretsEqual(secret, expected)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  const limit = Number(body?.limit);
  const windowMs = Number(body?.windowMs);
  if (!key || key.length > RATE_LIMIT_KEY_MAX) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  if (!Number.isFinite(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1000) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const rl = await rateLimitPersistent(key, Math.min(10_000, Math.floor(limit)), Math.floor(windowMs));
  return NextResponse.json(rl);
}
