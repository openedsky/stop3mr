export type StatutValidite = "NON_VENDUE" | "VALIDE" | "EXPIRE_BIENTOT" | "EXPIREE";

export type ValiditeInfo = {
  statut: StatutValidite;
  dateAchat: Date | null;
  dateExpiration: Date | null;
  joursRestants: number | null;
  validiteMois: number | null;
};

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function dateExpirationPlaque(dateAchat: Date, validiteMois: number): Date {
  return addMonths(dateAchat, validiteMois);
}

export function figerValiditeVente(dateAchat: Date, validiteMois: number, alerteJours = 30) {
  const dateExpiration = dateExpirationPlaque(dateAchat, validiteMois);
  const alerte = Math.max(0, alerteJours);
  return {
    validiteMois,
    dateExpiration,
    alerteExpirationJours: alerte,
    dateAlerte: addDays(dateExpiration, -alerte),
  };
}

export function statutDepuisExpiration(
  dateExpiration: Date,
  alerteJours: number,
  now = new Date()
): { statut: StatutValidite; joursRestants: number } {
  const joursRestants = Math.ceil((dateExpiration.getTime() - now.getTime()) / 86_400_000);
  let statut: StatutValidite = "VALIDE";
  if (joursRestants <= 0) statut = "EXPIREE";
  else if (joursRestants <= alerteJours) statut = "EXPIRE_BIENTOT";
  return { statut, joursRestants };
}

export function buildValidite(
  dateAchat: Date | null | undefined,
  validiteMois: number,
  alerteJours: number,
  now = new Date()
): ValiditeInfo {
  return buildValiditeFigee({
    dateAchat,
    dateExpiration: dateAchat ? dateExpirationPlaque(dateAchat, validiteMois) : null,
    validiteMois,
    alerteJours,
    now,
  });
}

/** Utilise la date d'expiration figée à la vente, pas le paramètre courant. */
export function buildValiditeFigee(params: {
  dateAchat: Date | null | undefined;
  dateExpiration?: Date | null;
  validiteMois?: number | null;
  alerteJours: number;
  now?: Date;
}): ValiditeInfo {
  const now = params.now ?? new Date();
  if (!params.dateAchat) {
    return { statut: "NON_VENDUE", dateAchat: null, dateExpiration: null, joursRestants: null, validiteMois: null };
  }
  const mois = params.validiteMois && params.validiteMois > 0 ? params.validiteMois : 24;
  const dateExpiration = params.dateExpiration ?? dateExpirationPlaque(params.dateAchat, mois);
  const { statut, joursRestants } = statutDepuisExpiration(dateExpiration, params.alerteJours, now);
  return {
    statut,
    dateAchat: params.dateAchat,
    dateExpiration,
    joursRestants,
    validiteMois: mois,
  };
}

export function serializeValidite(info: ValiditeInfo) {
  return {
    statut: info.statut,
    dateAchat: info.dateAchat?.toISOString() ?? null,
    dateExpiration: info.dateExpiration?.toISOString() ?? null,
    joursRestants: info.joursRestants,
    validiteMois: info.validiteMois,
  };
}

export const VALIDITE_LABELS: Record<StatutValidite, string> = {
  NON_VENDUE: "Non vendue",
  VALIDE: "Valide",
  EXPIRE_BIENTOT: "Expire bientôt",
  EXPIREE: "Expirée",
};

export function validiteBadgeClass(statut: StatutValidite): string {
  if (statut === "EXPIREE") return "badge-danger";
  if (statut === "EXPIRE_BIENTOT") return "badge-warning";
  if (statut === "VALIDE") return "badge-success";
  return "badge-neutral";
}

/** Bornes sur dateExpiration / dateAlerte figées à la vente. */
export function filtresExpirationFigee(_alerteJours?: number, now = new Date()) {
  return {
    expirees: { dateExpiration: { lte: now } },
    expireBientot: {
      AND: [{ dateExpiration: { gt: now } }, { dateAlerte: { lte: now } }],
    },
  };
}
