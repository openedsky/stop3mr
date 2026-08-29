import { getRateLimitInternalSecretEdge } from "./security-edge";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

const edgeMemory = new Map<string, { count: number; resetAt: number }>();
const EDGE_MEMORY_MAX = 2000;

function rateLimitEdgeMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (edgeMemory.size > EDGE_MEMORY_MAX) {
    for (const [k, v] of edgeMemory) {
      if (v.resetAt <= now) edgeMemory.delete(k);
    }
  }
  const cur = edgeMemory.get(key);
  if (!cur || cur.resetAt <= now) {
    const resetAt = now + windowMs;
    edgeMemory.set(key, { count: 1, resetAt });
    return { success: true, remaining: Math.max(0, limit - 1), resetAt };
  }
  cur.count += 1;
  if (cur.count > limit) return { success: false, remaining: 0, resetAt: cur.resetAt };
  return { success: true, remaining: Math.max(0, limit - cur.count), resetAt: cur.resetAt };
}

export function rateLimitResponse(resetAt: number) {
  return new Response(
    JSON.stringify({ error: "Trop de requêtes. Réessayez plus tard." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  );
}

/** Middleware Edge → seau MariaDB via l’API Node (aucun import Prisma). */
export async function rateLimitFromEdge(
  request: Request,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  let secret = "";
  try {
    secret = await getRateLimitInternalSecretEdge();
  } catch {
    return rateLimitEdgeMemory(key, limit, windowMs);
  }
  if (!secret) {
    return rateLimitEdgeMemory(key, limit, windowMs);
  }
  try {
    const res = await fetch(new URL("/api/internal/rate-limit", request.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rl-secret": secret,
      },
      body: JSON.stringify({ key, limit, windowMs }),
    });
    if (!res.ok) {
      return rateLimitEdgeMemory(key, limit, windowMs);
    }
    const data = (await res.json()) as RateLimitResult;
    if (typeof data.success !== "boolean" || typeof data.resetAt !== "number") {
      return rateLimitEdgeMemory(key, limit, windowMs);
    }
    return data;
  } catch {
    return rateLimitEdgeMemory(key, limit, windowMs);
  }
}
