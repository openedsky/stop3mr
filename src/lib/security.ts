import crypto from "crypto";
import {
  RATE_LIMIT_KEY_MAX,
  RL_INTERNAL_HMAC_MSG,
  WEAK_SECRETS,
  resolveRateLimitInternalSecret,
} from "./security-edge";

export {
  RATE_LIMIT_KEY_MAX,
  buildContentSecurityPolicy,
  createCspNonce,
  getTrustedClientIp,
  isMutatingMethod,
  isSameOriginRequest,
} from "./security-edge";

export function safeCallbackUrl(url: string | null | undefined, fallback = "/dashboard"): string {
  if (!url) return fallback;
  let decoded = url.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.includes("://") ||
    decoded.includes("@") ||
    /[\u0000-\u001f]/.test(decoded)
  ) {
    return fallback;
  }
  if (
    decoded.startsWith("/login") ||
    decoded.startsWith("/api") ||
    decoded.startsWith("/verify") ||
    decoded.startsWith("/register")
  ) {
    return fallback;
  }
  return decoded;
}

/** Préfixe les cellules CSV / tableur pour éviter l'injection de formules Excel */
export function sanitizeCsvCell(value: string | number): string {
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeSpreadsheetValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  return sanitizeCsvCell(value);
}

export function csvEscape(value: string | number | null | undefined): string {
  const sanitized = sanitizeCsvCell(value ?? "");
  if (/[;"\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/** Empreinte du hash (invalidation JWT après changement de mot de passe). */
export function passwordFingerprint(motDePasseHash: string): string {
  return crypto.createHash("sha256").update(motDePasseHash).digest("hex").slice(0, 16);
}

export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(14);
  let body = "";
  for (const b of bytes) body += alphabet[b % alphabet.length];
  return `Aa1${body}`.slice(0, 16);
}

export function getRateLimitInternalSecret(): string {
  const dedicated = process.env.RL_INTERNAL_SECRET ?? "";
  const jwt = process.env.NEXTAUTH_SECRET ?? "";
  const resolved = resolveRateLimitInternalSecret(dedicated, jwt);
  if (resolved !== "derive") return resolved;
  return crypto.createHmac("sha256", jwt || "dev").update(RL_INTERNAL_HMAC_MSG).digest("hex");
}

export function validateProductionSecrets(): void {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  const encKey = process.env.ENCRYPTION_KEY ?? "";
  const rl = process.env.RL_INTERNAL_SECRET ?? "";

  if (process.env.NODE_ENV !== "production") {
    if (WEAK_SECRETS.has(secret) || WEAK_SECRETS.has(encKey) || secret.length < 32) {
      console.warn(
        "[SECURITY] Secrets d'exemple détectés. Générez NEXTAUTH_SECRET, ENCRYPTION_KEY et RL_INTERNAL_SECRET avant toute mise en production."
      );
    }
    return;
  }

  if (secret.length < 32 || WEAK_SECRETS.has(secret)) {
    throw new Error(
      "NEXTAUTH_SECRET invalide en production. Générez avec: openssl rand -base64 32"
    );
  }

  if (encKey.length !== 64 || WEAK_SECRETS.has(encKey)) {
    throw new Error(
      "ENCRYPTION_KEY invalide en production. Générez avec: openssl rand -hex 32"
    );
  }

  if (rl.length < 32 || WEAK_SECRETS.has(rl) || rl === secret) {
    throw new Error(
      "RL_INTERNAL_SECRET invalide en production. Secret distinct de NEXTAUTH_SECRET, openssl rand -base64 32."
    );
  }

  const trust = process.env.TRUST_PROXY;
  if (trust !== "true" && trust !== "false") {
    throw new Error(
      'TRUST_PROXY doit valoir "true" ou "false" en production (true seulement derrière un proxy qui écrase X-Forwarded-For).'
    );
  }
}

export function isStrongPassword(password: string): boolean {
  if (password.length < 12) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  const weak = ["admin123", "operateur123", "password123", "123456789012"];
  if (weak.includes(password.toLowerCase())) return false;
  return true;
}

export function generateRegistrationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
