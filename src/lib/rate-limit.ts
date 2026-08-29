import { RateLimitResult, rateLimitResponse } from "./rate-limit-edge";

export type { RateLimitResult };
export { rateLimitResponse };

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX = 4000;

/** Seau processus : utilisé seulement si MariaDB est injoignable (disponibilité). */
export function rateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memoryBuckets.size > MEMORY_MAX) {
    for (const [k, v] of memoryBuckets) {
      if (v.resetAt <= now) memoryBuckets.delete(k);
    }
    if (memoryBuckets.size > MEMORY_MAX) {
      const oldest = memoryBuckets.keys().next().value;
      if (oldest) memoryBuckets.delete(oldest);
    }
  }
  const cur = memoryBuckets.get(key);
  if (!cur || cur.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: Math.max(0, limit - 1), resetAt };
  }
  cur.count += 1;
  if (cur.count > limit) {
    return { success: false, remaining: 0, resetAt: cur.resetAt };
  }
  return { success: true, remaining: Math.max(0, limit - cur.count), resetAt: cur.resetAt };
}

/** Rate limiter partagé (MariaDB) — incrément atomique sur une même connexion. */
export async function rateLimitPersistent(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const { prisma } = await import("./db");
    return await prisma.$transaction(async (tx) => {
      const resetAt = new Date(Date.now() + windowMs);
      await tx.$executeRaw`
        INSERT INTO rate_limit_buckets (cle, count, reset_at)
        VALUES (${key}, LAST_INSERT_ID(1), ${resetAt})
        ON DUPLICATE KEY UPDATE
          count = LAST_INSERT_ID(IF(reset_at <= NOW(3), 1, count + 1)),
          reset_at = IF(reset_at <= NOW(3), VALUES(reset_at), reset_at)
      `;
      const rows = await tx.$queryRaw<Array<{ id: bigint | number }>>`
        SELECT LAST_INSERT_ID() AS id
      `;
      const count = Number(rows[0]?.id ?? 1);
      const row = await tx.rateLimitBucket.findUnique({ where: { cle: key } });
      const windowEnd = row?.resetAt.getTime() ?? resetAt.getTime();
      if (count > limit) {
        return { success: false, remaining: 0, resetAt: windowEnd };
      }
      return { success: true, remaining: Math.max(0, limit - count), resetAt: windowEnd };
    });
  } catch {
    return rateLimitMemory(key, limit, windowMs);
  }
}
