"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { Req } from "@/components/Req";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { formatFcfa } from "@/lib/money";
import { paginateItems } from "@/lib/pagination";
import { swalConfirm, swalError, swalSuccess, swalToast } from "@/lib/swal";

type Produit = {
  id: number;
  code: string;
  libelle: string;
  description: string | null;
  famille: string;
  dimensions: string;
  visibilite: string;
  prixHt: number;
  commissionTaux: number;
  usagePrincipal: string;
  vitessesDisponibles: string | null;
  barre: boolean;
  imagePath: string | null;
  actif: boolean;
};

const FAMILLE_LABELS: Record<string, string> = {
  LIMITATION: "Limitation de vitesse",
  PLAQUE_ROUGE: "Plaque rouge",
  PLAQUE_BLANCHE: "Plaque blanche",
  BANDES_ROUGE_JAUNE: "Bandes rouge / jaune",
  BANDES_ROUGE_BLANC: "Bandes rouge / blanc",
};

const emptyCreate = {
  code: "",
  libelle: "",
  famille: "PLAQUE_ROUGE",
  dimensions: "300 x 300 mm",
  visibilite: "100 m",
  prixHt: 3000,
  commissionTaux: 10,
  usagePrincipal: "",
  description: "",
  vitessesDisponibles: "",
  barre: false,
};

export default function CataloguePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMINISTRATEUR";
  const canEditImage = isAdmin;
  const [produits, setProduits] = useState<Produit[]>([]);
  const [editing, setEditing] = useState<Produit | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [famille, setFamille] = useState("");
  const [actifFiltre, setActifFiltre] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return produits.filter((p) => {
      if (famille && p.famille !== famille) return false;
      if (actifFiltre === "true" && !p.actif) return false;
      if (actifFiltre === "false" && p.actif) return false;
      if (
        lower &&
        !p.code.toLowerCase().includes(lower) &&
        !p.libelle.toLowerCase().includes(lower) &&
        !(p.description?.toLowerCase().includes(lower) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [produits, q, famille, actifFiltre]);

  const { items: pageProduits, pagination } = paginateItems(filtered, page, 9);

  async function load() {
    const res = await fetch("/api/produits");
    const data = await res.json();
    setProduits(data.produits ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleImage(produit: Produit, file: File | undefined) {
    if (!file) return;
    const ok = await swalConfirm("Remplacer la photo ?", `Image du produit ${produit.libelle}`, "Enregistrer");
    if (!ok) return;
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("image", file);
    const res = await fetch(`/api/produits/${produit.id}/image`, { method: "POST", body });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Image non enregistrée", d.error ?? "Impossible d'enregistrer l'image");
      setError(d.error ?? "Impossible d'enregistrer l'image");
      return;
    }
    await swalToast("success", "Photo enregistrée");
    load();
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const ok = await swalConfirm("Enregistrer ce produit ?", editing.libelle, "Enregistrer");
    if (!ok) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/produits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        prixHt: Number(editing.prixHt),
        commissionTaux: Number(editing.commissionTaux),
        actif: editing.actif,
        libelle: editing.libelle,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Modification impossible", d.error ?? "Erreur");
      setError(d.error ?? "Erreur");
      return;
    }
    await swalSuccess("Produit enregistré");
    setEditing(null);
    load();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm("Ajouter ce produit au catalogue ?", createForm.libelle || createForm.code, "Créer");
    if (!ok) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/produits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createForm,
        prixHt: Number(createForm.prixHt),
        commissionTaux: Number(createForm.commissionTaux),
        vitessesDisponibles: createForm.vitessesDisponibles || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      await swalError("Création impossible", d.error ?? "Erreur");
      setError(d.error ?? "Erreur");
      return;
    }
    await swalSuccess("Produit créé", "Il est immédiatement disponible à la production et à la vente.");
    setCreating(false);
    setCreateForm(emptyCreate);
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-2xl font-bold">Catalogue des plaques réfléchissantes</h1>
            <p className="text-slate-500">
              Gamme Stop 3MR — tarifs HT, visibilité et commission. Les ventes déjà passées gardent le prix et la
              commission enregistrés au moment de la vente.
              {isAdmin
                ? " Cliquez sur une photo pour la remplacer."
                : " Consultation uniquement — les modifications sont réservées à l'administrateur."}
            </p>
          </div>
          {isAdmin && (
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              Nouveau produit
            </button>
          )}
        </div>

        {error && !editing && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="card mb-6">
          <TableSearch
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            onSubmit={() => setPage(1)}
            placeholder="Rechercher un produit (code, libellé)…"
            filters={
              <>
                <FilterField label="Famille">
                  <select
                    className="input-field"
                    value={famille}
                    onChange={(e) => {
                      setFamille(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Toutes</option>
                    {Object.entries(FAMILLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Visibilité">
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
              </>
            }
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pageProduits.map((p) => (
            <article key={p.id} className={`card overflow-hidden !p-0 ${p.actif ? "" : "opacity-60"}`}>
              <div className="relative flex h-40 items-center justify-center bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imagePath ?? "/catalogue/plaque-rouge.png"}
                  alt={p.libelle}
                  className="max-h-36 max-w-full object-contain"
                />
                {canEditImage && (
                  <label className="absolute bottom-2 right-2 cursor-pointer rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow ring-1 ring-slate-200">
                    {uploading ? "Envoi..." : "Changer l'image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => handleImage(p, e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
              <div className="space-y-2 p-5">
                <p className="font-mono text-xs text-slate-400">{p.code}</p>
                <h2 className="font-semibold text-slate-900">{p.libelle}</h2>
                <p className="text-xs text-slate-500">{p.description}</p>
                <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="text-slate-400">Dimensions</dt>
                    <dd>{p.dimensions}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Visibilité</dt>
                    <dd>{p.visibilite}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Prix HT</dt>
                    <dd className="font-semibold text-slate-900">{formatFcfa(p.prixHt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Commission</dt>
                    <dd>{p.commissionTaux} %</dd>
                  </div>
                </dl>
                {p.vitessesDisponibles && (
                  <p className="text-xs text-slate-500">Vitesses : {p.vitessesDisponibles.replace(/,/g, ", ")} km/h</p>
                )}
                <p className="text-xs text-slate-400">{p.usagePrincipal}</p>
                {isAdmin && (
                  <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => setEditing(p)}>
                    Actualiser
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        {pageProduits.length === 0 && (
          <p className="mb-6 text-center text-sm text-slate-400">Aucun produit pour ces filtres.</p>
        )}
        <PaginationBar
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          onPage={setPage}
          label="produit"
        />

        {creating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <form onSubmit={handleCreate} className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto">
              <h3 className="font-semibold">Nouveau produit catalogue</h3>
              <p className="text-xs text-slate-500">
                Le produit sera disponible immédiatement pour la production, l&apos;affectation et les ventes.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">Code<Req /></label>
                  <input
                    className="input-field"
                    required
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Famille<Req /></label>
                  <select
                    className="input-field"
                    value={createForm.famille}
                    onChange={(e) => setCreateForm({ ...createForm, famille: e.target.value })}
                  >
                    {Object.entries(FAMILLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm">Libellé<Req /></label>
                <input
                  className="input-field"
                  required
                  value={createForm.libelle}
                  onChange={(e) => setCreateForm({ ...createForm, libelle: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">Dimensions</label>
                  <input
                    className="input-field"
                    value={createForm.dimensions}
                    onChange={(e) => setCreateForm({ ...createForm, dimensions: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Visibilité</label>
                  <input
                    className="input-field"
                    value={createForm.visibilite}
                    onChange={(e) => setCreateForm({ ...createForm, visibilite: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">Prix HT (F CFA)</label>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    value={createForm.prixHt}
                    onChange={(e) => setCreateForm({ ...createForm, prixHt: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Commission %</label>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    max={100}
                    value={createForm.commissionTaux}
                    onChange={(e) => setCreateForm({ ...createForm, commissionTaux: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm">Usage principal<Req /></label>
                <input
                  className="input-field"
                  required
                  value={createForm.usagePrincipal}
                  onChange={(e) => setCreateForm({ ...createForm, usagePrincipal: e.target.value })}
                />
              </div>
              {createForm.famille === "LIMITATION" && (
                <div>
                  <label className="mb-1 block text-sm">Vitesses (km/h, séparées par des virgules)<Req /></label>
                  <input
                    className="input-field"
                    placeholder="30,40,50,60,70,80,90,100"
                    required
                    value={createForm.vitessesDisponibles}
                    onChange={(e) => setCreateForm({ ...createForm, vitessesDisponibles: e.target.value })}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.barre}
                  onChange={(e) => setCreateForm({ ...createForm, barre: e.target.checked })}
                />
                Avec barre
              </label>
              <div>
                <label className="mb-1 block text-sm">Description</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Création..." : "Créer le produit"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <form onSubmit={handleSave} className="card w-full max-w-md space-y-4">
              <h3 className="font-semibold">Actualiser {editing.code}</h3>
              <div>
                <label className="mb-1 block text-sm">Libellé</label>
                <input
                  className="input-field"
                  value={editing.libelle}
                  onChange={(e) => setEditing({ ...editing, libelle: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">Prix HT</label>
                  <input
                    className="input-field"
                    type="number"
                    value={editing.prixHt}
                    onChange={(e) => setEditing({ ...editing, prixHt: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Commission %</label>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    max={100}
                    value={editing.commissionTaux}
                    onChange={(e) => setEditing({ ...editing, commissionTaux: Number(e.target.value) })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.actif}
                  onChange={(e) => setEditing({ ...editing, actif: e.target.checked })}
                />
                Produit actif
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
