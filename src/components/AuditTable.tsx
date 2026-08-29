"use client";

import { parseAuditDetails, type AuditChange } from "@/lib/audit";
import { formatFcfa } from "@/lib/money";

type AuditEntry = {
  id: number;
  action: string;
  actionLabel: string;
  cible: string | null;
  details: string | null;
  horodatage: string;
  adresseIp: string | null;
  utilisateur?: { identifiant: string; nom: string | null; role?: string } | null;
};

type Props = {
  entries: AuditEntry[];
  showUser?: boolean;
};

function formatAuditValue(change: AuditChange): { avant: string; apres: string } {
  const moneyFields = new Set(["prixHt", "prixVente", "commissionMontant"]);
  const percentFields = new Set([
    "commissionTaux",
    "commissionTauxControleur",
    "commissionTauxDefaut",
    "commissionTauxControleurDefaut",
  ]);
  const formatOne = (value: unknown) => {
    if (value == null || value === "") return "—";
    if (typeof value === "boolean") return value ? "oui" : "non";
    if (typeof value === "number" && moneyFields.has(change.champ)) return formatFcfa(value);
    if (typeof value === "number" && percentFields.has(change.champ)) return `${value} %`;
    if (change.champ === "plaqueValiditeMois") return `${value} mois`;
    if (change.champ === "plaqueAlerteExpirationJours") return `${value} j`;
    return String(value);
  };
  return { avant: formatOne(change.avant), apres: formatOne(change.apres) };
}

function DetailsCell({ details }: { details: string | null }) {
  const parsed = parseAuditDetails(details);
  if (parsed.changes.length > 0) {
    return (
      <div className="space-y-1">
        {parsed.changes.map((c) => {
          const { avant, apres } = formatAuditValue(c);
          return (
            <p key={c.champ} className="text-xs leading-relaxed">
              <span className="font-medium text-slate-600">{c.label} : </span>
              <span className="text-slate-400 line-through decoration-slate-300">{avant}</span>
              <span className="mx-1 text-slate-400">→</span>
              <span className="font-semibold text-slate-800">{apres}</span>
            </p>
          );
        })}
        {typeof parsed.extra.note === "string" && (
          <p className="text-[11px] text-slate-400">{parsed.extra.note}</p>
        )}
      </div>
    );
  }
  if (Object.keys(parsed.extra).length > 0) {
    const entries = Object.entries(parsed.extra).filter(([k]) => k !== "note");
    if (entries.length === 0 && parsed.raw) {
      return <span className="text-xs text-slate-500">{parsed.raw}</span>;
    }
    return (
      <div className="space-y-0.5 text-xs text-slate-600">
        {entries.map(([k, v]) => (
          <p key={k}>
            <span className="text-slate-400">{k} : </span>
            {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
          </p>
        ))}
      </div>
    );
  }
  if (parsed.raw) return <span className="text-xs text-slate-500">{parsed.raw}</span>;
  return <span className="text-slate-300">—</span>;
}

export function AuditTable({ entries, showUser = false }: Props) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Aucune opération enregistrée</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="pb-3 pr-4 font-medium">Date / heure</th>
            {showUser && <th className="pb-3 pr-4 font-medium">Utilisateur</th>}
            <th className="pb-3 pr-4 font-medium">Action</th>
            <th className="pb-3 pr-4 font-medium">Cible</th>
            <th className="pb-3 pr-4 font-medium">Ancienne → nouvelle valeur</th>
            <th className="pb-3 font-medium">IP</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-slate-100 align-top">
              <td className="py-3 pr-4 whitespace-nowrap text-slate-600">
                {new Date(e.horodatage).toLocaleString("fr-FR")}
              </td>
              {showUser && (
                <td className="py-3 pr-4">
                  <span className="font-medium">{e.utilisateur?.identifiant ?? "—"}</span>
                  {e.utilisateur?.role && (
                    <span className="ml-1 text-xs text-slate-400">({e.utilisateur.role})</span>
                  )}
                </td>
              )}
              <td className="py-3 pr-4">
                <span className="badge badge-info">{e.actionLabel}</span>
              </td>
              <td className="py-3 pr-4 font-mono text-xs">{e.cible ?? "—"}</td>
              <td className="py-3 pr-4 max-w-md">
                <DetailsCell details={e.details} />
              </td>
              <td className="py-3 text-xs text-slate-400">{e.adresseIp ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
