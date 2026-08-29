import { prisma } from "./db";

export type AuditChange = {
  champ: string;
  label: string;
  avant: unknown;
  apres: unknown;
};

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  prixHt: "Prix unitaire HT",
  commissionTaux: "Commission commercial %",
  commissionTauxControleur: "Commission contrôleur %",
  commissionTauxDefaut: "Taux commercial par défaut %",
  commissionTauxControleurDefaut: "Taux contrôleur par défaut %",
  plaqueValiditeMois: "Validité plaque (mois)",
  plaqueAlerteExpirationJours: "Alerte expiration (jours)",
  libelle: "Libellé",
  actif: "Actif",
  dimensions: "Dimensions",
  visibilite: "Visibilité",
  usagePrincipal: "Usage",
  description: "Description",
  vitessesDisponibles: "Vitesses",
  barre: "Barre",
};

export function buildAuditChanges(
  avant: Record<string, unknown>,
  apres: Record<string, unknown>,
  labels: Record<string, string> = AUDIT_FIELD_LABELS
): AuditChange[] {
  const keys = new Set([...Object.keys(avant), ...Object.keys(apres)]);
  const changes: AuditChange[] = [];
  for (const champ of keys) {
    const a = avant[champ];
    const b = apres[champ];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    changes.push({
      champ,
      label: labels[champ] ?? champ,
      avant: a ?? null,
      apres: b ?? null,
    });
  }
  return changes;
}

export function serializeAuditDiff(params: {
  avant?: Record<string, unknown>;
  apres?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): string {
  const changes =
    params.avant && params.apres ? buildAuditChanges(params.avant, params.apres) : [];
  return JSON.stringify({
    avant: params.avant ?? null,
    apres: params.apres ?? null,
    changes,
    ...params.extra,
  });
}

export function parseAuditDetails(details: string | null): {
  changes: AuditChange[];
  extra: Record<string, unknown>;
  raw: string | null;
} {
  if (!details) return { changes: [], extra: {}, raw: null };
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    if (Array.isArray(parsed.changes) && parsed.changes.length > 0) {
      const { changes, avant: _a, apres: _b, ...extra } = parsed;
      return { changes: changes as AuditChange[], extra, raw: details };
    }
    if (parsed.avant && parsed.apres && typeof parsed.avant === "object" && typeof parsed.apres === "object") {
      return {
        changes: buildAuditChanges(
          parsed.avant as Record<string, unknown>,
          parsed.apres as Record<string, unknown>
        ),
        extra: {},
        raw: details,
      };
    }
    return { changes: [], extra: parsed, raw: details };
  } catch {
    return { changes: [], extra: {}, raw: details };
  }
}

export async function logAudit(params: {
  utilisateurId?: number | null;
  action: string;
  cible?: string;
  details?: string;
  adresseIp?: string;
}) {
  try {
    await prisma.journalAudit.create({
      data: {
        utilisateurId: params.utilisateurId ?? null,
        action: params.action,
        cible: params.cible,
        details: params.details,
        adresseIp: params.adresseIp,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}
