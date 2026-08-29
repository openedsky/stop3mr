import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decryptClientRecord } from "./clients";
import { sansTokenEnregistrement } from "./plaque-dto";
import { rateLimitMemory } from "./rate-limit";
import {
  buildContentSecurityPolicy,
  getRateLimitInternalSecret,
  getTrustedClientIp,
  isSameOriginRequest,
  RATE_LIMIT_KEY_MAX,
  sanitizeCsvCell,
  sanitizeSpreadsheetValue,
} from "./security";

describe("SEC-001 tokenEnregistrement", () => {
  it("ôte le jeton de la charge utile plaque", () => {
    const out = sansTokenEnregistrement({
      numeroSerie: "R3M-PR-1",
      tokenEnregistrement: "abc123",
      statut: "EN_STOCK",
    });
    assert.equal("tokenEnregistrement" in out, false);
    assert.equal(out.numeroSerie, "R3M-PR-1");
  });
});

describe("SEC-002 IP de confiance", () => {
  it("ignore X-Forwarded-For si le proxy n’est pas de confiance", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    assert.equal(getTrustedClientIp(req, false), "direct");
  });

  it("prend le premier hop XFF derrière un proxy de confiance", () => {
    const req = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    assert.equal(getTrustedClientIp(req, true), "203.0.113.9");
  });

  it("utilise l’IP pair NextRequest quand TRUST_PROXY=false", () => {
    const req = new Request("http://localhost/api") as Request & { ip?: string };
    req.ip = "192.0.2.10";
    assert.equal(getTrustedClientIp(req, false), "192.0.2.10");
  });
});

describe("SEC-003 formules tableur", () => {
  it("neutralise = + - @ en CSV et XLSX", () => {
    assert.equal(sanitizeCsvCell("=cmd|'/c calc'!A0"), "'=cmd|'/c calc'!A0");
    assert.equal(sanitizeSpreadsheetValue("+1+1"), "'+1+1");
    assert.equal(sanitizeSpreadsheetValue("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(sanitizeSpreadsheetValue("Kouassi"), "Kouassi");
    assert.equal(sanitizeSpreadsheetValue(1500), 1500);
  });
});

describe("SEC-004 CSP production", () => {
  it("n’autorise pas script-src unsafe-inline en production", () => {
    const csp = buildContentSecurityPolicy("n0nceValue==", true);
    assert.match(csp, /script-src 'nonce-n0nceValue==' 'strict-dynamic'/);
    assert.equal(/script-src [^;]*unsafe-inline/.test(csp), false);
    assert.equal(/script-src [^;]*unsafe-eval/.test(csp), false);
  });
});

describe("SEC-005 fallback mémoire", () => {
  it("accepte puis refuse au-delà de la limite", () => {
    const key = `mem-test-${Date.now()}-${Math.random()}`;
    const a = rateLimitMemory(key, 2, 60_000);
    const b = rateLimitMemory(key, 2, 60_000);
    const c = rateLimitMemory(key, 2, 60_000);
    assert.equal(a.success, true);
    assert.equal(b.success, true);
    assert.equal(c.success, false);
  });
});

describe("SEC-006 secret RL interne", () => {
  it("ne réutilise pas NEXTAUTH_SECRET en clair", async () => {
    const prevRl = process.env.RL_INTERNAL_SECRET;
    const prevJwt = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "unit-test-nextauth-secret-value-32chars";
    delete process.env.RL_INTERNAL_SECRET;
    try {
      const derived = getRateLimitInternalSecret();
      const { getRateLimitInternalSecretEdge } = await import("./security-edge");
      const edge = await getRateLimitInternalSecretEdge();
      assert.notEqual(derived, process.env.NEXTAUTH_SECRET);
      assert.ok(derived.length >= 32);
      assert.equal(edge, derived);
    } finally {
      if (prevRl !== undefined) process.env.RL_INTERNAL_SECRET = prevRl;
      else delete process.env.RL_INTERNAL_SECRET;
      if (prevJwt !== undefined) process.env.NEXTAUTH_SECRET = prevJwt;
    }
  });
});

describe("SEC-007 plafond de clé", () => {
  it("fixe un maximum de 128 caractères", () => {
    assert.equal(RATE_LIMIT_KEY_MAX, 128);
  });
});

describe("SEC-009 déchiffrement", () => {
  it("n’expose pas le ciphertext si la clé échoue", () => {
    const blob = `${"a".repeat(32)}:${"b".repeat(32)}:deadbeef`;
    const client = {
      nom: blob,
      telephone: blob,
      email: blob,
      raisonSociale: null,
      adresse: blob,
      numeroPieceIdentite: blob,
    };
    const out = decryptClientRecord(client as never);
    assert.equal(out.nom, "");
    assert.equal(out.telephone, "");
    assert.equal(out.email, "");
  });
});

describe("SEC-011 CSRF same-origin", () => {
  it("accepte same-origin et refuse cross-site", () => {
    const ok = new Request("http://localhost:3000/api/ventes", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
    });
    const ko = new Request("http://localhost:3000/api/ventes", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "https://evil.test", "sec-fetch-site": "cross-site" },
    });
    assert.equal(isSameOriginRequest(ok), true);
    assert.equal(isSameOriginRequest(ko), false);
  });
});
