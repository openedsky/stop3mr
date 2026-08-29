import { StatutValidite, VALIDITE_LABELS, validiteBadgeClass } from "@/lib/validite";

export function ValiditeBadge({
  statut,
  joursRestants,
}: {
  statut: StatutValidite;
  joursRestants?: number | null;
}) {
  const extra =
    statut === "EXPIRE_BIENTOT" && joursRestants != null
      ? ` — ${joursRestants} j`
      : statut === "EXPIREE" && joursRestants != null
        ? ` — ${Math.abs(joursRestants)} j`
        : "";
  return (
    <span className={`badge ${validiteBadgeClass(statut)}`}>
      {VALIDITE_LABELS[statut]}
      {extra}
    </span>
  );
}
