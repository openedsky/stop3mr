"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { ClientForm, ClientFormData } from "@/components/ClientForm";
import { ClientSituationCard } from "@/components/ClientSituationCard";
import { PaginationBar } from "@/components/PaginationBar";
import { TYPE_CLIENT_LABELS, TYPE_PIECE_LABELS, FNE_STATUT_LABELS } from "@/lib/clients";
import { paginateItems } from "@/lib/pagination";
import { formatVehiculeLabel, VehiculePayload } from "@/lib/vehicules";
import { swalConfirm, swalError, swalSuccess } from "@/lib/swal";

type ClientDetail = ClientFormData & {
  id: number;
  vehicules: VehiculePayload[];
  ventes: Array<{
    id: number;
    dateVente: string;
    plaque: { numeroSerie: string; typeProduit: string; statut: string };
    vehicule?: { immatriculation: string; marqueVehicule: string | null; modeleVehicule: string | null } | null;
  }>;
};

type Situation = {
  totalFacture: number;
  totalPaye: number;
  soldeDu: number;
  facturesImpayees: number;
  nbVentes: number;
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/crm/situation/${id}`).then((r) => r.json()),
    ]).then(([clientData, situationData]) => {
      setClient(clientData.client);
      setSituation(situationData.situation);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleUpdate(data: ClientFormData) {
    setSaving(true);
    const res = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Erreur");
    }
    const { client: updated } = await res.json();
    setClient((prev) => (prev ? { ...prev, ...updated, vehicules: updated.vehicules } : null));
    setEditMode(false);
    await swalSuccess("Client modifié");
  }

  async function handleDelete() {
    const ok = await swalConfirm("Désactiver ce client ?", "Le client ne sera plus proposé dans les ventes.", "Désactiver");
    if (!ok) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      await swalError("Suppression impossible", body.error ?? "Erreur");
      return;
    }
    await swalSuccess("Client désactivé");
    router.push("/clients");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8">Chargement...</main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-8">Client introuvable</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/clients" className="mb-4 inline-block text-sm text-slate-500 hover:text-red-600">
          ← Retour aux clients
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{client.nom}</h1>
            <p className="text-sm text-slate-500">{client.telephone}</p>
            <p className="text-xs text-slate-400">
              {TYPE_CLIENT_LABELS[client.typeClient ?? "PARTICULIER"]} — {client.vehicules.length} véhicule(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/ventes/nouvelle?clientId=${client.id}`} className="btn-primary">
              Enregistrer une vente
            </Link>
            {!editMode && (
              <button onClick={() => setEditMode(true)} className="btn-secondary">
                Modifier
              </button>
            )}
            {session?.user.role === "ADMINISTRATEUR" && (
              <button onClick={handleDelete} className="btn-secondary !text-red-600">
                Supprimer
              </button>
            )}
          </div>
        </div>

        {situation && (
          <div className="mb-6">
            <ClientSituationCard situation={situation} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold">
              {editMode ? "Modifier le client" : "Informations"}
            </h2>
            {editMode ? (
              <ClientForm
                initial={client}
                onSubmit={handleUpdate}
                loading={saving}
                submitLabel="Sauvegarder"
              />
            ) : (
              <dl className="space-y-3 text-sm">
                {client.raisonSociale && (
                  <div>
                    <dt className="text-slate-500">Raison sociale</dt>
                    <dd className="font-medium">{client.raisonSociale}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-500">Téléphone</dt>
                  <dd className="font-medium">{client.telephone}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">E-mail</dt>
                  <dd>{client.email ?? "—"}</dd>
                </div>
                {client.ncc && (
                  <div>
                    <dt className="text-slate-500">NCC</dt>
                    <dd className="font-mono">{client.ncc}</dd>
                  </div>
                )}
                {client.rccm && (
                  <div>
                    <dt className="text-slate-500">RCCM</dt>
                    <dd>{client.rccm}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-500">Adresse</dt>
                  <dd>{[client.adresse, client.commune, client.ville].filter(Boolean).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Pièce d&apos;identité</dt>
                  <dd>
                    {client.typePieceIdentite ? TYPE_PIECE_LABELS[client.typePieceIdentite] : "—"}
                    {client.numeroPieceIdentite ? ` — ${client.numeroPieceIdentite}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">FNE</dt>
                  <dd>
                    {FNE_STATUT_LABELS[client.fneStatut ?? "NON_APPLICABLE"]}
                    {client.fneReference ? ` — Réf. ${client.fneReference}` : ""}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="space-y-6">
            {!editMode && (
              <div className="card">
                <h2 className="mb-4 text-lg font-semibold">
                  Véhicules ({client.vehicules.length})
                </h2>
                <div className="space-y-2">
                  {client.vehicules.map((v) => (
                    <div key={v.id ?? v.immatriculation} className="rounded-lg border border-slate-100 p-3">
                      <p className="font-mono font-medium">{v.immatriculation}</p>
                      <p className="text-sm text-slate-600">
                        {[v.marqueVehicule, v.modeleVehicule].filter(Boolean).join(" ") || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="mb-4 text-lg font-semibold">
                Historique des ventes ({client.ventes.length})
              </h2>
              <ClientVentesList ventes={client.ventes} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ClientVentesList({
  ventes,
}: {
  ventes: Array<{
    id: number;
    dateVente: string;
    plaque: { numeroSerie: string; typeProduit: string; statut: string };
    vehicule?: { immatriculation: string; marqueVehicule: string | null; modeleVehicule: string | null } | null;
  }>;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const lower = q.trim().toLowerCase();
  const filtered = lower
    ? ventes.filter(
        (v) =>
          v.plaque.numeroSerie.toLowerCase().includes(lower) ||
          v.plaque.typeProduit.toLowerCase().includes(lower) ||
          (v.vehicule?.immatriculation.toLowerCase().includes(lower) ?? false)
      )
    : ventes;
  const { items, pagination } = paginateItems(filtered, page, 8);

  return (
    <>
      <input
        className="input-field mb-3"
        placeholder="Rechercher série, produit, immatriculation…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <div className="space-y-3">
        {items.map((v) => (
          <div key={v.id} className="rounded-lg border border-slate-100 p-3">
            <p className="font-mono text-xs text-slate-600">{v.plaque.numeroSerie}</p>
            <p className="text-sm">
              {v.plaque.typeProduit.replace("_", " ")} —{" "}
              {v.vehicule ? formatVehiculeLabel(v.vehicule) : "—"} —{" "}
              {new Date(v.dateVente).toLocaleString("fr-FR")}
            </p>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Aucune vente enregistrée</p>}
      </div>
      <PaginationBar
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        onPage={setPage}
        label="vente"
      />
    </>
  );
}
