export function formatNombre(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value ?? 0);
}

export function formatFcfa(value: number): string {
  return `${formatNombre(value)} F CFA`;
}

export function computeCommission(prixHt: number, tauxPercent: number): number {
  if (prixHt <= 0 || tauxPercent <= 0) return 0;
  return Math.round((prixHt * tauxPercent) / 100);
}
