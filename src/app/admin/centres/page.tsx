"use client";

import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import type { CentreCarte } from "@/lib/geo";
import { formatNombre } from "@/lib/money";
import { PaginationBar, TableSearch, FilterField } from "@/components/PaginationBar";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";
import { Req } from "@/components/Req";

const CentresMap = dynamic(() => import("@/components/CentresMap").then((m) => m.CentresMap), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Chargement de la carte...
    </div>
  ),
});

type Centre = {
  id: number;
  code: string;
  libelle: string;
  pays: string;
  ville: string | null;
  commune: string | null;
  quartier: string | null;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  actif: boolean;
  _count: { agents: number; verifications: number; ventes: number };
};

const emptyForm = {
  code: "",
  libelle: "",
  pays: "Côte d'Ivoire",
  ville: "",
  commune: "",
  quartier: "",
  adresse: "",
  latitude: "",
  longitude: "",
};

export default function CentresPage() {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [carte, setCarte] = useState<CentreCarte[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [actif, setActif] = useState("all");
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  async function load(search = q, p = page, act = actif) {
    const params = new URLSearchParams({ q: search, page: String(p), limit: "20", actif: act });
    const [list, mapData] = await Promise.all([
      fetch(`/api/admin/centres?${params}`).then((r) => r.json()),
      fetch("/api/carte").then((r) => r.json()),
    ]);
    setCentres(list.centres ?? []);
    setTotal(list.pagination?.total ?? list.total ?? 0);
    setPages(list.pagination?.pages ?? 1);
    setPage(list.pagination?.page ?? p);
    setCarte((mapData.sites ?? []).filter((s: CentreCarte) => s.kind !== "production"));
  }

  useEffect(() => {
    load();
  }, []);

  function setField(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function payload() {
    return {
      code: form.code,
      libelle: form.libelle,
      pays: form.pays,
      ville: form.ville || null,
      commune: form.commune || null,
      quartier: form.quartier || null,
      adresse: form.adresse || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await swalConfirm(
      editingId ? "Modifier ce centre ?" : "Enregistrer ce centre ?",
      form.libelle || form.code,
      "Enregistrer"
    );
    if (!ok) return;
    setSaving(true);
    setError("");
    const body = editingId
      ? (() => {
          const { code: _code, ...rest } = payload();
          return rest;
        })()
      : payload();
    const res = await fetch(editingId ? `/api/admin/centres/${editingId}` : "/api/admin/centres", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      await swalError("Centre non enregistré", data.error ?? "Erreur");
      setError(data.error ?? "Erreur");
      return;
    }
    await swalSuccess(editingId ? "Centre modifié" : "Centre enregistré");
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  function edit(c: Centre) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      libelle: c.libelle,
      pays: c.pays,
      ville: c.ville ?? "",
      commune: c.commune ?? "",
      quartier: c.quartier ?? "",
      adresse: c.adresse ?? "",
      latitude: c.latitude != null ? String(c.latitude) : "",
      longitude: c.longitude != null ? String(c.longitude) : "",
    });
  }

  async function geocode() {
    const q = [form.adresse, form.quartier, form.commune, form.ville, form.pays].filter(Boolean).join(", ");
    if (q.length < 3) {
      await swalError("Géocodage impossible", "Indiquez au moins une ville ou une adresse pour le géocodage");
      setError("Indiquez au moins une ville ou une adresse pour le géocodage");
      return;
    }
    setGeocoding(true);
    setError("");
    const res = await fetch(`/api/geo/geocode?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setGeocoding(false);
    if (!res.ok || !data.results?.[0]) {
      await swalError("Aucun résultat", data.error ?? "Aucun résultat de géocodage");
      setError(data.error ?? "Aucun résultat de géocodage");
      return;
    }
    const r = data.results[0];
    setForm((f) => ({
      ...f,
      latitude: String(r.latitude),
      longitude: String(r.longitude),
      ville: f.ville || r.ville || "",
      commune: f.commune || r.commune || "",
      quartier: f.quartier || r.quartier || "",
      adresse: f.adresse || r.adresse || "",
      pays: f.pays || r.pays || "Côte d'Ivoire",
    }));
  }

  const pickerCentres: CentreCarte[] = carte;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/admin" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Administration
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Centres de contrôle technique</h1>
        <p className="mb-4 text-slate-500">
          Points de vente et de vérification sur le territoire — distincts de l&apos;usine de production de Yopougon.
        </p>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="font-semibold">{editingId ? "Modifier le centre" : "Nouveau centre"}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm">Code<Req /></label>
                <input className="input-field" value={form.code} onChange={(e) => setField("code", e.target.value)} required disabled={!!editingId} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm">Libellé<Req /></label>
                <input className="input-field" value={form.libelle} onChange={(e) => setField("libelle", e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm">Pays<Req /></label>
                <input className="input-field" value={form.pays} onChange={(e) => setField("pays", e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm">Ville</label>
                <input className="input-field" value={form.ville} onChange={(e) => setField("ville", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Commune</label>
                <input className="input-field" value={form.commune} onChange={(e) => setField("commune", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm">Quartier</label>
                <input className="input-field" value={form.quartier} onChange={(e) => setField("quartier", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm">Adresse précise</label>
              <input className="input-field" value={form.adresse} onChange={(e) => setField("adresse", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-sm">Latitude</label>
                <input className="input-field font-mono" value={form.latitude} onChange={(e) => setField("latitude", e.target.value)} placeholder="5.32380" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Longitude</label>
                <input className="input-field font-mono" value={form.longitude} onChange={(e) => setField("longitude", e.target.value)} placeholder="-4.01970" />
              </div>
              <div className="flex items-end">
                <button type="button" className="btn-secondary w-full" onClick={geocode} disabled={geocoding}>
                  {geocoding ? "..." : "Géocoder"}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Annuler
                </button>
              )}
            </div>
          </form>

          <div>
            <p className="mb-2 text-sm text-slate-500">Cliquez sur la carte pour renseigner le GPS.</p>
            <CentresMap
              centres={pickerCentres}
              pickMode
              onPick={(lat, lng) => {
                setField("latitude", lat.toFixed(6));
                setField("longitude", lng.toFixed(6));
              }}
              className="h-[420px]"
            />
          </div>
        </div>

        <div className="card mb-4">
          <TableSearch
            value={q}
            onChange={setQ}
            onSubmit={() => {
              setPage(1);
              load(q, 1, actif);
            }}
            placeholder="Rechercher un centre CT (ville, commune, code)…"
            filters={
              <FilterField label="Statut">
                <select
                  className="input-field"
                  value={actif}
                  onChange={(e) => {
                    setActif(e.target.value);
                    setPage(1);
                    load(q, 1, e.target.value);
                  }}
                >
                  <option value="all">Tous</option>
                  <option value="true">Actifs</option>
                  <option value="false">Inactifs</option>
                </select>
              </FilterField>
            }
          />
          <p className="mb-0 text-xs text-slate-400">{formatNombre(total)} centre(s) de contrôle</p>
        </div>
        <div className="space-y-3">
          {centres.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{c.libelle}</p>
                <p className="text-sm text-slate-500">
                  {[c.adresse, c.quartier, c.commune, c.ville, c.pays].filter(Boolean).join(" · ")}
                </p>
                <p className="font-mono text-xs text-slate-400">
                  {c.latitude != null && c.longitude != null
                    ? `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`
                    : "GPS non renseigné"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-400">
                  {formatNombre(c._count.agents)} agent(s) · {formatNombre(c._count.ventes)} vente(s) · {formatNombre(c._count.verifications)} vérif.
                </p>
                <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => edit(c)}>
                  Géoréférencer
                </button>
              </div>
            </div>
          ))}
        </div>
        <PaginationBar
          page={page}
          pages={pages}
          total={total}
          onPage={(p) => {
            setPage(p);
            load(q, p, actif);
          }}
          label="centre"
        />
      </main>
    </div>
  );
}
