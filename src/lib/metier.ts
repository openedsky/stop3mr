import { prisma } from "./db";

export type MetierSettings = {
  plaqueValiditeMois: number;
  plaqueAlerteExpirationJours: number;
  commissionTauxControleurDefaut: number;
  commissionTauxDefaut: number;
};

const DEFAULTS: MetierSettings = {
  plaqueValiditeMois: 24,
  plaqueAlerteExpirationJours: 30,
  commissionTauxControleurDefaut: 10,
  commissionTauxDefaut: 10,
};

const KEYS = {
  plaqueValiditeMois: "plaque_validite_mois",
  plaqueAlerteExpirationJours: "plaque_alerte_expiration_jours",
  commissionTauxControleurDefaut: "commission_taux_controleur_defaut",
  commissionTauxDefaut: "commission_taux_defaut",
} as const;

let cache: { settings: MetierSettings; expires: number } | null = null;

function parseIntClamped(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function getMetierSettings(): Promise<MetierSettings> {
  if (cache && cache.expires > Date.now()) return cache.settings;

  const params = await prisma.parametre.findMany({
    where: { cle: { in: Object.values(KEYS) } },
  });
  const map = Object.fromEntries(params.map((p) => [p.cle, p.valeur]));

  const settings: MetierSettings = {
    plaqueValiditeMois: parseIntClamped(map[KEYS.plaqueValiditeMois], DEFAULTS.plaqueValiditeMois, 1, 120),
    plaqueAlerteExpirationJours: parseIntClamped(
      map[KEYS.plaqueAlerteExpirationJours],
      DEFAULTS.plaqueAlerteExpirationJours,
      0,
      365
    ),
    commissionTauxControleurDefaut: parseIntClamped(
      map[KEYS.commissionTauxControleurDefaut],
      DEFAULTS.commissionTauxControleurDefaut,
      0,
      100
    ),
    commissionTauxDefaut: parseIntClamped(map[KEYS.commissionTauxDefaut], DEFAULTS.commissionTauxDefaut, 0, 100),
  };

  cache = { settings, expires: Date.now() + 30_000 };
  return settings;
}

export async function saveMetierSettings(data: Partial<MetierSettings>): Promise<MetierSettings> {
  const entries: Array<[string, string]> = [];
  if (data.plaqueValiditeMois != null) {
    entries.push([KEYS.plaqueValiditeMois, String(parseIntClamped(String(data.plaqueValiditeMois), 24, 1, 120))]);
  }
  if (data.plaqueAlerteExpirationJours != null) {
    entries.push([
      KEYS.plaqueAlerteExpirationJours,
      String(parseIntClamped(String(data.plaqueAlerteExpirationJours), 30, 0, 365)),
    ]);
  }
  if (data.commissionTauxControleurDefaut != null) {
    entries.push([
      KEYS.commissionTauxControleurDefaut,
      String(parseIntClamped(String(data.commissionTauxControleurDefaut), 10, 0, 100)),
    ]);
  }
  if (data.commissionTauxDefaut != null) {
    entries.push([KEYS.commissionTauxDefaut, String(parseIntClamped(String(data.commissionTauxDefaut), 10, 0, 100))]);
  }

  for (const [cle, valeur] of entries) {
    await prisma.parametre.upsert({
      where: { cle },
      update: { valeur },
      create: { cle, valeur },
    });
  }

  cache = null;
  return getMetierSettings();
}

export function invalidateMetierCache() {
  cache = null;
}

export function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const to = new Date(y, m, 0, 23, 59, 59, 999);
  return { from, to };
}

export function currentYearMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
