import { nextSerieCounter } from "./counters";

function formatDatePrefix(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export async function generateNumeroSerie(
  siteCode: string = process.env.DEFAULT_SITE_CODE ?? "YP",
  date: Date = new Date()
): Promise<string> {
  const datePrefix = formatDatePrefix(date);
  const normalizedSite = siteCode.toUpperCase().slice(0, 10);

  const numero = await nextSerieCounter(normalizedSite, datePrefix);

  const counter = String(numero).padStart(6, "0");
  return `R3M-${normalizedSite}-${datePrefix}-${counter}`;
}

export function parseNumeroSerie(numero: string): {
  prefix: string;
  site: string;
  date: string;
  counter: string;
} | null {
  const match = numero.match(/^R3M-([A-Z0-9]+)-(\d{6})-(\d{6})$/);
  if (!match) return null;
  return {
    prefix: "R3M",
    site: match[1],
    date: match[2],
    counter: match[3],
  };
}
