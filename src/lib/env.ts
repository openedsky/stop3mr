import { validateProductionSecrets } from "./security";

let validated = false;

export function ensureEnvSecurity() {
  if (validated) return;
  validateProductionSecrets();
  validated = true;
}

// Validation au chargement côté serveur (pas pendant next build)
if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
  try {
    ensureEnvSecurity();
  } catch (e) {
    console.error("[SECURITY]", (e as Error).message);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}
