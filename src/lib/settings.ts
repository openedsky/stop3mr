import { prisma } from "./db";

export type QrEnvironment = "localhost" | "production";

export type QrSettings = {
  environment: QrEnvironment;
  urlLocalhost: string;
  urlProduction: string;
  verifyPath: string;
};

const DEFAULTS: QrSettings = {
  environment: "localhost",
  urlLocalhost: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
  urlProduction: process.env.APP_PUBLIC_URL ?? "https://stop3mr.ci",
  verifyPath: "/verify",
};

let cache: { settings: QrSettings; expires: number } | null = null;

export async function getQrSettings(): Promise<QrSettings> {
  if (cache && cache.expires > Date.now()) {
    return cache.settings;
  }

  const params = await prisma.parametre.findMany({
    where: {
      cle: {
        in: ["qr_environment", "qr_url_localhost", "qr_url_production", "qr_verify_path"],
      },
    },
  });

  const map = Object.fromEntries(params.map((p) => [p.cle, p.valeur]));

  const settings: QrSettings = {
    environment: (map.qr_environment as QrEnvironment) ?? DEFAULTS.environment,
    urlLocalhost: map.qr_url_localhost ?? DEFAULTS.urlLocalhost,
    urlProduction: map.qr_url_production ?? DEFAULTS.urlProduction,
    verifyPath: map.qr_verify_path ?? DEFAULTS.verifyPath,
  };

  cache = { settings, expires: Date.now() + 30_000 };
  return settings;
}

export async function saveQrSettings(data: Partial<QrSettings>): Promise<QrSettings> {
  const entries: Array<[string, string]> = [];
  if (data.environment) entries.push(["qr_environment", data.environment]);
  if (data.urlLocalhost) entries.push(["qr_url_localhost", data.urlLocalhost.replace(/\/$/, "")]);
  if (data.urlProduction) entries.push(["qr_url_production", data.urlProduction.replace(/\/$/, "")]);
  if (data.verifyPath) entries.push(["qr_verify_path", data.verifyPath.startsWith("/") ? data.verifyPath : `/${data.verifyPath}`]);

  for (const [cle, valeur] of entries) {
    await prisma.parametre.upsert({
      where: { cle },
      update: { valeur },
      create: { cle, valeur },
    });
  }

  cache = null;
  return getQrSettings();
}

export async function getActiveBaseUrl(): Promise<string> {
  const s = await getQrSettings();
  return s.environment === "production" ? s.urlProduction : s.urlLocalhost;
}

export function invalidateSettingsCache() {
  cache = null;
}
