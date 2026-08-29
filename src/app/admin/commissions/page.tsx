"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { formatFcfa } from "@/lib/money";
import { paginateItems } from "@/lib/pagination";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

type Produit = {
  id: number;
  code: string;
  libelle: string;
  prixHt: number;
  commissionTaux: number;
  commissionTauxControleur: number;
  actif: boolean;
};

type Metier = {
  plaqueValiditeMois: number;
  plaqueAlerteExpirationJours: number;
  commissionTauxControleurDefaut: number;
  commissionTauxDefaut: number;
};

export default function AdminCommissionsPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [q, setQ] = useState("");
  const [actifFiltre, setActifFiltre] = useState("");
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingMetier, setSavingMetier] = useState(false);
  const [error, setError] = useState("");
  const [metier, setMetier] = useState<Metier>({
    plaqueValiditeMois: 24,
    plaqueAlerteExpirationJours: 30,
    commissionTauxControleurDefaut: 10,
    commissionTauxDefaut: 10,
  });

  async function load() {
    const [res, metierRes] = await Promise.all([fetch("/api/produits"), fetch("/api/settings/metier")]);
    const data = await res.json();
    const metierData = await metierRes.json();
    setProduits(data.produits ?? []);
    if (metierData.settings) setMetier(metierData.settings);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(produit: Produit) {
    const ok = await swalConfirm(
      "Enregistrer cette commission ?",
      `${produit.libelle} — vente ${produit.commissionTaux} % / contrôle ${produit.commissionTauxControleur} %`,
      "Enregistrer"
    );
    if (!ok) return;
    setSavingId(produit.id);
    setError("");
    const res = await fetch("/api/produits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: produit.id,
        commissionTaux: Number(produit.commissionTaux),
        commissionTauxControleur: Number(produit.commissionTauxControleur),
        prixHt: Number(produit.prixHt),
      }),
    });
    setSavingId(null);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Enregistrement impossible", d.error ?? "Erreur");
      setError(d.error ?? "Erreur");
      return;
    }
    await swalSuccess(
      "Commissions enregistrées",
      "Les prochaines ventes et contrôles utiliseront ces taux. Les opérations déjà enregistrées restent figées."
    );
    load();
  }

  async function saveMetier() {
    const ok = await swalConfirm(
      "Enregistrer les règles métier ?",
      `Validité ${metier.plaqueValiditeMois} mois — alerte ${metier.plaqueAlerteExpirationJours} jours — taux contrôleur ${metier.commissionTauxControleurDefaut} %`,
      "Enregistrer"
    );
    if (!ok) return;
    setSavingMetier(true);
    const res = await fetch("/api/settings/metier", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metier),
    });
    setSavingMetier(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Enregistrement impossible", d.error ?? "Erreur");
      return;
    }
    await swalSuccess("Règles enregistrées", "La validité et les taux par défaut sont à jour.");
  }

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return produits.filter((p) => {
      if (actifFiltre === "true" && !p.actif) return false;
      if (actifFiltre === "false" && p.actif) return false;
      if (!lower) return true;
      return p.code.toLowerCase().includes(lower) || p.libelle.toLowerCase().includes(lower);
    });
  }, [produits, q, actifFiltre]);
  const { items: pageProduits, pagination } = paginateItems(filtered, page, 15);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Commissions et validité</h1>
        <p className="mb-6 text-slate-500">
          Taux commerciaux et contrôleurs par produit, plus la durée de validité des plaques (2 ans par défaut).
          Une modification de taux ne recalcule pas les ventes ni les contrôles déjà enregistrés.
          Une modification de durée de validité ne change pas les dates d&apos;expiration déjà figées à
          l&apos;achat. L&apos;historique conserve l&apos;ancienne et la nouvelle valeur.
        </p>

        <div className="card mb-6">
          <h2 className="mb-4 font-semibold">Règles générales</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm">Validité plaque (mois)</label>
              <input
                className="input-field"
                type="number"
                min={1}
                max={120}
                value={metier.plaqueValiditeMois}
                onChange={(e) => setMetier({ ...metier, plaqueValiditeMois: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Alerte avant expiration (jours)</label>
              <input
                className="input-field"
                type="number"
                min={0}
                max={365}
                value={metier.plaqueAlerteExpirationJours}
                onChange={(e) => setMetier({ ...metier, plaqueAlerteExpirationJours: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Taux commercial défaut (%)</label>
              <input
                className="input-field"
                type="number"
                min={0}
                max={100}
                value={metier.commissionTauxDefaut}
                onChange={(e) => setMetier({ ...metier, commissionTauxDefaut: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Taux contrôleur défaut (%)</label>
              <input
                className="input-field"
                type="number"
                min={0}
                max={100}
                value={metier.commissionTauxControleurDefaut}
                onChange={(e) => setMetier({ ...metier, commissionTauxControleurDefaut: Number(e.target.value) })}
              />
            </div>
          </div>
          <button type="button" className="btn-primary mt-4" disabled={savingMetier} onClick={saveMetier}>
            {savingMetier ? "…" : "Enregistrer les règles"}
          </button>
        </div>

        <div className="card mb-4">
          <TableSearch
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            onSubmit={() => setPage(1)}
            placeholder="Rechercher un produit…"
            filters={
              <FilterField label="Statut">
                <select
                  className="input-field"
                  value={actifFiltre}
                  onChange={(e) => {
                    setActifFiltre(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tous</option>
                  <option value="true">Actifs</option>
                  <option value="false">Inactifs</option>
                </select>
              </FilterField>
            }
          />
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-3 pr-4 font-medium">Code</th>
                <th className="pb-3 pr-4 font-medium">Produit</th>
                <th className="pb-3 pr-4 font-medium">Prix HT</th>
                <th className="pb-3 pr-4 font-medium">Comm. vente %</th>
                <th className="pb-3 pr-4 font-medium">Comm. contrôle %</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageProduits.map((p) => (
                <tr key={p.id} className={`border-b border-slate-100 ${p.actif ? "" : "opacity-60"}`}>
                  <td className="py-3 pr-4 font-mono text-xs">{p.code}</td>
                  <td className="py-3 pr-4">
                    {p.libelle}
                    {!p.actif && <span className="ml-2 text-xs text-slate-400">(inactif)</span>}
                  </td>
                  <td className="py-3 pr-4">{formatFcfa(p.prixHt)}</td>
                  <td className="py-3 pr-4">
                    <input
                      className="input-field w-24"
                      type="number"
                      min={0}
                      max={100}
                      value={p.commissionTaux}
                      onChange={(e) =>
                        setProduits((prev) =>
                          prev.map((x) =>
                            x.id === p.id ? { ...x, commissionTaux: Number(e.target.value) } : x
                          )
                        )
                      }
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      className="input-field w-24"
                      type="number"
                      min={0}
                      max={100}
                      value={p.commissionTauxControleur ?? 10}
                      onChange={(e) =>
                        setProduits((prev) =>
                          prev.map((x) =>
                            x.id === p.id ? { ...x, commissionTauxControleur: Number(e.target.value) } : x
                          )
                        )
                      }
                    />
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      className="btn-secondary !py-1.5 !text-xs"
                      disabled={savingId === p.id}
                      onClick={() => save(p)}
                    >
                      {savingId === p.id ? "…" : "Enregistrer"}
                    </button>
                  </td>
                </tr>
              ))}
              {pageProduits.length === 0 && (
                <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun produit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <PaginationBar
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            onPage={setPage}
            label="produit"
          />
        </div>
      </main>
    </div>
  );
}
