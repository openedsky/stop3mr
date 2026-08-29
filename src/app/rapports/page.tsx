"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { AppRole } from "@/lib/roles";
import { nomComplet } from "@/lib/territoire";
import { swalConfirm, swalError, swalSuccess, swalToast } from "@/lib/swal";
import {
  STATUT_RAPPORT_LABELS,
  TYPE_RAPPORT_LABELS,
  TypeRapport,
  typesRapportPourRole,
} from "@/lib/rapports";
import { Req } from "@/components/Req";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";

type Rapport = {
  id: number;
  type: TypeRapport;
  statut: string;
  titre: string;
  contenu: string;
  periodeDebut: string | null;
  periodeFin: string | null;
  creeLe: string;
  auteur: { identifiant: string; prenom: string | null; nom: string | null; role: string };
  centre: { code: string; libelle: string; ville: string | null } | null;
};

const emptyForm = {
  type: "" as TypeRapport | "",
  titre: "",
  contenu: "",
  periodeDebut: "",
  periodeFin: "",
};

export default function RapportsPage() {
  const { data: session } = useSession();
  const role = session?.user.role as AppRole | undefined;
  const types = useMemo(() => (role ? typesRapportPourRole(role) : []), [role]);
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);

  async function load(search = q, p = page, type = typeFiltre, statut = statutFiltre) {
    const params = new URLSearchParams({ q: search, page: String(p), limit: "15" });
    if (type) params.set("type", type);
    if (statut) params.set("statut", statut);
    const res = await fetch(`/api/rapports?${params}`);
    const data = await res.json();
    setRapports(data.rapports ?? []);
    setPages(data.pagination?.pages ?? 1);
    setTotal(data.pagination?.total ?? 0);
    setPage(data.pagination?.page ?? p);
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.type) {
      await swalError("Type manquant", "Choisissez un type de rapport");
      return;
    }
    const ok = await swalConfirm("Soumettre ce rapport ?", "La situation sera transmise à l'administration.", "Soumettre");
    if (!ok) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/rapports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        titre: form.titre,
        contenu: form.contenu,
        periodeDebut: form.periodeDebut || null,
        periodeFin: form.periodeFin || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      await swalError("Enregistrement impossible", data.error ?? "Impossible d'enregistrer le rapport");
      setError(data.error ?? "Impossible d'enregistrer le rapport");
      return;
    }
    await swalSuccess("Rapport soumis", "Votre situation a bien été enregistrée.");
    setForm({ ...emptyForm, type: types[0] ?? "" });
    load();
  }

  async function marquerLu(id: number, statut: "LU" | "SOUMIS") {
    const ok = await swalConfirm("Marquer ce rapport comme lu ?", "Le statut du rapport va changer.", "Marquer lu");
    if (!ok) return;
    const res = await fetch(`/api/rapports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    if (!res.ok) {
      await swalError("Statut non modifié", "Impossible de mettre à jour le rapport");
      return;
    }
    await swalToast("success", "Rapport marqué comme lu");
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">Rapports de situation</h1>
        <p className="mb-8 text-slate-500">
          Signalez une situation précise sur un site, un stock, une vente ou un contrôle. Les administrateurs voient
          l&apos;ensemble des rapports.
        </p>

        <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
          <h2 className="text-lg font-semibold">Nouveau rapport</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm">Type<Req /></label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TypeRapport })}
                required
              >
                <option value="">— Choisir —</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_RAPPORT_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">Titre<Req /></label>
              <input
                className="input-field"
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                minLength={5}
                required
                placeholder="Ex. Rupture de stock panneaux rouges"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Période concernée (début)</label>
              <input
                className="input-field"
                type="date"
                value={form.periodeDebut}
                onChange={(e) => setForm({ ...form, periodeDebut: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Période concernée (fin)</label>
              <input
                className="input-field"
                type="date"
                value={form.periodeFin}
                onChange={(e) => setForm({ ...form, periodeFin: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">Description de la situation<Req /></label>
            <textarea
              className="input-field min-h-[140px]"
              value={form.contenu}
              onChange={(e) => setForm({ ...form, contenu: e.target.value })}
              minLength={10}
              required
              placeholder="Décrivez les faits, le lieu, les personnes concernées et ce que vous attendez."
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Envoi..." : "Soumettre le rapport"}
          </button>
        </form>

        <div className="card mb-4">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(q, 1, typeFiltre, statutFiltre);
            }}
            placeholder="Rechercher un rapport…"
            filters={
              <>
                <FilterField label="Type">
                  <select
                    className="input-field"
                    value={typeFiltre}
                    onChange={(e) => {
                      setTypeFiltre(e.target.value);
                      setPage(1);
                      load(q, 1, e.target.value, statutFiltre);
                    }}
                  >
                    <option value="">Tous</option>
                    {Object.entries(TYPE_RAPPORT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Statut">
                  <select
                    className="input-field"
                    value={statutFiltre}
                    onChange={(e) => {
                      setStatutFiltre(e.target.value);
                      setPage(1);
                      load(q, 1, typeFiltre, e.target.value);
                    }}
                  >
                    <option value="">Tous</option>
                    {Object.entries(STATUT_RAPPORT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FilterField>
              </>
            }
          />
        </div>

        <div className="space-y-3">
          {rapports.map((r) => (
            <article key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {TYPE_RAPPORT_LABELS[r.type]} · {STATUT_RAPPORT_LABELS[r.statut] ?? r.statut}
                  </p>
                  <h3 className="text-lg font-semibold">{r.titre}</h3>
                  <p className="text-sm text-slate-500">
                    {nomComplet(r.auteur)} ({r.auteur.identifiant})
                    {r.centre ? ` — ${r.centre.libelle}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(r.creeLe).toLocaleString("fr-FR")}
                    {r.periodeDebut && r.periodeFin
                      ? ` · période ${new Date(r.periodeDebut).toLocaleDateString("fr-FR")} → ${new Date(r.periodeFin).toLocaleDateString("fr-FR")}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => setOuvert(ouvert === r.id ? null : r.id)}>
                    {ouvert === r.id ? "Masquer" : "Lire"}
                  </button>
                  {role === "ADMINISTRATEUR" && r.statut !== "LU" && (
                    <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => marquerLu(r.id, "LU")}>
                      Marquer lu
                    </button>
                  )}
                </div>
              </div>
              {ouvert === r.id && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{r.contenu}</p>}
            </article>
          ))}
          {rapports.length === 0 && <p className="card text-sm text-slate-400">Aucun rapport pour le moment.</p>}
        </div>
        <PaginationBar
          page={page}
          pages={pages}
          total={total}
          onPage={(p) => {
            setPage(p);
            load(q, p, typeFiltre, statutFiltre);
          }}
          label="rapport"
        />
      </main>
    </div>
  );
}
