"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { CentreSelect, type CentreOption } from "@/components/CentreSelect";
import { Req } from "@/components/Req";
import { formatFcfa } from "@/lib/money";
import { TYPE_CLIENT_LABELS } from "@/lib/clients";
import { CANAL_VENTE_LABELS } from "@/lib/ventes";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

type Client = {
  id: number;
  nom: string;
  telephone: string;
  typeClient?: "PARTICULIER" | "ENTREPRISE";
  raisonSociale?: string | null;
  vehiculesSummary?: string;
  vehicules?: Array<{ id: number; immatriculation: string }>;
};

type Plaque = {
  id: number;
  numeroSerie: string;
  typeProduit: string;
  statut: string;
  vitesseLimitation?: number | null;
  prixReference?: number;
  produit?: { libelle: string; prixHt: number; commissionTaux: number } | null;
};

function NouvelleVenteForm() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const preselectedClientId = searchParams.get("clientId");
  const preselectedCanal = searchParams.get("canal") === "COMMERCIAL" ? "COMMERCIAL" : "DIRECTE";
  const isCommercial = session?.user.role === "COMMERCIAL";
  const [canal, setCanal] = useState<"COMMERCIAL" | "DIRECTE">(preselectedCanal);

  const [clients, setClients] = useState<Client[]>([]);
  const [plaques, setPlaques] = useState<Plaque[]>([]);
  const [clientId, setClientId] = useState(preselectedClientId ?? "");
  const [vehiculeId, setVehiculeId] = useState("");
  const [nouvelleImmat, setNouvelleImmat] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [centreId, setCentreId] = useState("");
  const [centreHabituel, setCentreHabituel] = useState<CentreOption | null>(null);
  const [memoriserCentre, setMemoriserCentre] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [plaqueSearch, setPlaqueSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [commissionInfo, setCommissionInfo] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/clients?limit=100")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []));
    const venteDirecte = !isCommercial && canal === "DIRECTE";
    const plaqueUrl = isCommercial
      ? "/api/plaques?statut=AFFECTEE&limit=100"
      : venteDirecte
        ? "/api/plaques?statut=EN_STOCK&limit=100"
        : "/api/plaques?statut=AFFECTEE&limit=100";
    fetch(plaqueUrl)
      .then((r) => r.json())
      .then((d) => setPlaques(d.plaques ?? []));
    fetch("/api/profile")
      .then((r) => r.json())
      .then((profileData) => {
        const own = profileData.user?.centreControle as CentreOption | undefined;
        if (own?.id) {
          setCentreHabituel(own);
          setCentreId(String(own.id));
        }
      });
  }, [isCommercial, status, canal]);

  const filteredClients = clients.filter(
    (c) =>
      !clientSearch ||
      c.nom.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.vehiculesSummary?.toLowerCase().includes(clientSearch.toLowerCase()) ?? false) ||
      c.telephone.includes(clientSearch) ||
      (c.vehicules?.some((v) => v.immatriculation.toLowerCase().includes(clientSearch.toLowerCase())) ?? false)
  );

  const filteredPlaques = plaques.filter(
    (p) => !plaqueSearch || p.numeroSerie.includes(plaqueSearch)
  );

  const selectedPlaque = plaques.find((p) => p.numeroSerie === numeroSerie);
  const selectedClient = clients.find((c) => String(c.id) === clientId);
  const prix = selectedPlaque?.produit?.prixHt ?? selectedPlaque?.prixReference ?? 0;
  const venteDirecte = isCommercial ? false : canal === "DIRECTE";
  const taux = venteDirecte ? 0 : (selectedPlaque?.produit?.commissionTaux ?? 10);
  const commission = Math.round((prix * taux) / 100);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isCommercial && !centreId) {
      setError("Indiquez le centre de contrôle technique de la vente.");
      await swalError("Centre requis", "Sélectionnez le centre où la vente est réalisée.");
      return;
    }
    const ok = await swalConfirm("Enregistrer cette vente ?", "La plaque sera marquée comme vendue.", "Enregistrer");
    if (!ok) return;
    setLoading(true);
    setError("");
    setSuccess(null);
    setCommissionInfo(null);

    const res = await fetch("/api/ventes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: Number(clientId),
        numeroSerie,
        vehiculeId: vehiculeId ? Number(vehiculeId) : undefined,
        immatriculation: nouvelleImmat.trim() || undefined,
        centreId: centreId ? Number(centreId) : null,
        canal: isCommercial ? "COMMERCIAL" : canal,
        encaisse: true,
        modePaiement: "ESPECES",
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      await swalError("Vente non enregistrée", data.error ?? "Erreur lors de la vente");
      setError(data.error ?? "Erreur lors de la vente");
      return;
    }

    const data = await res.json();
    setSuccess(data.vente.plaque.numeroSerie);
    setCommissionInfo(
      data.vente.canal === "DIRECTE" || data.vente.commissionMontant === 0
        ? `Vente directe sans commission — Prix : ${formatFcfa(data.vente.prixVente)}`
        : `Commission : ${formatFcfa(data.vente.commissionMontant)} — Prix : ${formatFcfa(data.vente.prixVente)}`
    );
    await swalSuccess("Vente enregistrée", `Plaque ${data.vente.plaque.numeroSerie}`);
    if (isCommercial && memoriserCentre && centreId) {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centreControleId: Number(centreId) }),
      });
    }
    setNumeroSerie("");
    setPlaques((prev) => prev.filter((p) => p.numeroSerie !== data.vente.plaque.numeroSerie));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/ventes" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Ventes
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          {isCommercial ? "Enregistrer une vente" : venteDirecte ? "Vente directe" : "Vente via commercial"}
        </h1>
        <p className="mb-8 text-slate-500">
          {isCommercial
            ? "Commercialisation en centre de contrôle technique. Une commission vous est attribuée."
            : venteDirecte
              ? "Vente à une organisation, une personne morale ou une personne physique, sans commission."
              : "Vente réalisée par un commercial vendeur, avec commission."}
        </p>

        {success && (
          <div className="card mb-6 border-green-200 bg-green-50">
            <p className="font-medium text-green-800">Vente enregistrée — plaque {success}</p>
            {commissionInfo && <p className="mt-1 text-sm text-green-700">{commissionInfo}</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-6">
          {!isCommercial && (
            <div>
              <label className="mb-2 block text-sm font-medium">Canal de vente<Req /></label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-3 text-left text-sm ${
                    canal === "DIRECTE" ? "border-red-500 bg-red-50" : "border-slate-200 bg-white"
                  }`}
                  onClick={() => {
                    setCanal("DIRECTE");
                    setNumeroSerie("");
                  }}
                >
                  <p className="font-semibold">{CANAL_VENTE_LABELS.DIRECTE}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Organisation, personne morale ou physique. Aucune commission.
                  </p>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-3 text-left text-sm ${
                    canal === "COMMERCIAL" ? "border-red-500 bg-red-50" : "border-slate-200 bg-white"
                  }`}
                  onClick={() => {
                    setCanal("COMMERCIAL");
                    setNumeroSerie("");
                  }}
                >
                  <p className="font-semibold">{CANAL_VENTE_LABELS.COMMERCIAL}</p>
                  <p className="mt-1 text-xs text-slate-500">Stock d&apos;un vendeur, commission appliquée.</p>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">1. Client acheteur<Req /></label>
            <input
              className="input-field mb-2"
              placeholder="Filtrer clients..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            <select
              className="input-field"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setVehiculeId("");
                setNouvelleImmat("");
              }}
              required
              size={Math.min(6, Math.max(3, filteredClients.length))}
            >
              <option value="">— Choisir un client —</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.typeClient === "ENTREPRISE" ? "Org. " : "Phys. "}
                  {c.raisonSociale || c.nom} — {c.telephone}
                </option>
              ))}
            </select>
            {selectedClient && (
              <p className="mt-1 text-xs text-slate-500">
                {TYPE_CLIENT_LABELS[selectedClient.typeClient ?? "PARTICULIER"]}
                {selectedClient.raisonSociale ? ` — ${selectedClient.raisonSociale}` : ""}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Client manquant ?{" "}
              <Link href="/clients/nouveau" className="text-red-600 hover:underline">
                Créer une personne physique ou une organisation
              </Link>
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">2. Véhicule (optionnel)</label>
            {selectedClient?.vehicules && selectedClient.vehicules.length > 0 ? (
              <select
                className="input-field"
                value={vehiculeId}
                onChange={(e) => {
                  setVehiculeId(e.target.value);
                  setNouvelleImmat("");
                }}
              >
                <option value="">— Sans véhicule —</option>
                {selectedClient.vehicules.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.immatriculation}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              className="input-field mt-2"
              placeholder="Immatriculation si connue (ex. AB-123-CD)"
              value={nouvelleImmat}
              onChange={(e) => {
                setNouvelleImmat(e.target.value);
                if (e.target.value) setVehiculeId("");
              }}
            />
            <p className="mt-1 text-xs text-slate-400">
              Une vente peut être enregistrée sans véhicule. L&apos;immatriculation n&apos;est pas obligatoire.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              3. Plaque {isCommercial ? "(votre stock vendeur)" : venteDirecte ? "(stock production)" : "(stock vendeur)"}
              <Req />
            </label>
            <input
              className="input-field mb-2"
              placeholder="Filtrer par numéro de série..."
              value={plaqueSearch}
              onChange={(e) => setPlaqueSearch(e.target.value)}
            />
            <select
              className="input-field"
              value={numeroSerie}
              onChange={(e) => setNumeroSerie(e.target.value)}
              required
              size={Math.min(6, Math.max(3, filteredPlaques.length))}
            >
              <option value="">— Choisir une plaque —</option>
              {filteredPlaques.map((p) => (
                <option key={p.id} value={p.numeroSerie}>
                  {p.numeroSerie}
                  {p.produit ? ` — ${p.produit.libelle}` : ` — ${p.typeProduit.replace("_", " ")}`}
                  {p.vitesseLimitation ? ` ${p.vitesseLimitation} km/h` : ""}
                </option>
              ))}
            </select>
            {filteredPlaques.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                {isCommercial
                  ? "Aucune plaque dans votre stock. L'unité de production doit vous les mettre à disposition."
                  : venteDirecte
                    ? "Aucune plaque en stock production. Produisez ou rapatriez du stock."
                    : "Aucune plaque affectée à un commercial."}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              4. Centre de contrôle technique {isCommercial ? <Req /> : null}
            </label>
            <CentreSelect
              value={centreId}
              onChange={(id, centre) => {
                setCentreId(id);
                if (centre) setCentreHabituel((prev) => prev ?? centre);
              }}
              initialCentre={centreHabituel}
              required={isCommercial}
            />
            {isCommercial && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={memoriserCentre}
                  onChange={(e) => setMemoriserCentre(e.target.checked)}
                />
                Mémoriser ce centre comme mon centre habituel
              </label>
            )}
            <p className="mt-1 text-xs text-slate-400">
              {isCommercial
                ? "Indiquez le centre où vous réalisez cette vente. Recherchez par ville, commune ou nom."
                : "Optionnel pour un administrateur."}
            </p>
          </div>

          {selectedPlaque && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <p>
                Prix : <strong>{formatFcfa(prix)}</strong>
              </p>
              <p>
                {venteDirecte
                  ? "Commission : aucune (vente directe)"
                  : `Commission commercial (${taux} %) : `}
                {!venteDirecte && <strong>{formatFcfa(commission)}</strong>}
              </p>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading || !clientId || !numeroSerie || (isCommercial && !centreId)}>
            {loading ? "Enregistrement..." : "Confirmer la vente"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function NouvelleVentePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <NouvelleVenteForm />
    </Suspense>
  );
}
