/** Utilitaires sûrs pour le runtime Edge — aucun import Node. */

export const WEAK_SECRETS = new Set([
  "dev-secret-change-in-production-32chars-min",
  "changez-moi-en-production-avec-openssl-rand-base64-32",
  "changez-moi-rl-interne-openssl-rand-base64-32xxxx",
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
]);

export const RATE_LIMIT_KEY_MAX = 128;
export const RL_INTERNAL_HMAC_MSG = "stop3mr-rl-internal";

function normalizeIpCandidate(value: string): string {
  let v = value.trim();
  if (v.startsWith("[") && v.includes("]")) {
    v = v.slice(1, v.indexOf("]"));
  }
  if (v.startsWith("::ffff:")) v = v.slice(7);
  const colon = v.lastIndexOf(":");
  if (colon > 0 && /^\d+$/.test(v.slice(colon + 1)) && v.includes(".")) {
    v = v.slice(0, colon);
  }
  return v;
}

function looksLikeIp(value: string): boolean {
  if (!value || value.length > 45) return false;
  if (value === "unknown" || value === "localhost" || value === "local") return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return true;
  return value.includes(":");
}

function peerIpFromRequest(request: Request): string | undefined {
  const nextIp = (request as Request & { ip?: string | null }).ip;
  if (typeof nextIp === "string" && nextIp.trim()) {
    const normalized = normalizeIpCandidate(nextIp);
    if (looksLikeIp(normalized)) return normalized;
  }
  return undefined;
}

export function getTrustedClientIp(
  request: Request,
  trustedProxy = process.env.TRUST_PROXY === "true"
): string {
  if (trustedProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = normalizeIpCandidate(forwarded.split(",")[0] ?? "");
      if (looksLikeIp(first)) return first;
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      const normalized = normalizeIpCandidate(realIp);
      if (looksLikeIp(normalized)) return normalized;
    }
  }
  const peer = peerIpFromRequest(request);
  if (peer) return peer;
  return "direct";
}

export function isMutatingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

/** Same-origin pour les mutations cookie-auth. Sec-Fetch-Site same-origin / Origin / Referer. */
export function isSameOriginRequest(request: Request): boolean {
  if (!isMutatingMethod(request.method)) return true;
  const host = request.headers.get("host");
  if (!host) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return true;
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export function buildContentSecurityPolicy(nonce: string, isProd = process.env.NODE_ENV === "production"): string {
  const script = isProd
    ? `script-src 'nonce-${nonce}' 'strict-dynamic'`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'`;
  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.openstreetmap.org",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function resolveRateLimitInternalSecret(dedicated: string, jwt: string): string | "derive" {
  if (dedicated.length >= 32 && dedicated !== jwt && !WEAK_SECRETS.has(dedicated)) {
    return dedicated;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RL_INTERNAL_SECRET invalide en production. Secret distinct de NEXTAUTH_SECRET, ≥ 32 caractères (openssl rand -base64 32)."
    );
  }
  return "derive";
}

/** HMAC Web Crypto — utilisable depuis le middleware Edge. */
export async function getRateLimitInternalSecretEdge(): Promise<string> {
  const dedicated = process.env.RL_INTERNAL_SECRET ?? "";
  const jwt = process.env.NEXTAUTH_SECRET ?? "";
  const resolved = resolveRateLimitInternalSecret(dedicated, jwt);
  if (resolved !== "derive") return resolved;
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(jwt || "dev"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(RL_INTERNAL_HMAC_MSG));
  return bytesToHex(sig);
}
