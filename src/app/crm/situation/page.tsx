"use client";

import { useEffect, useState, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ClientSelect } from "@/components/ClientSelect";
import { PaginationBar } from "@/components/PaginationBar";
import { paginateItems } from "@/lib/pagination";
import {
  FACTURE_STATUT_LABELS,
  MODE_PAIEMENT_LABELS,
  formatFcfa,
} from "@/lib/crm";

type SituationData = {
  client: { id: number; nom: string; telephone: string; email: string | null; vehiculesSummary?: string; vehicules?: Array<{ immatriculation: string }> };
  situation: {
    totalFacture: number;
    totalPaye: number;
    soldeDu: number;
    facturesImpayees: number;
    nbVentes: number;
  };
  factures: Array<{ id: number; numero: string; montantTtc: number; montantPaye: number; solde: number; statut: string }>;
  recus: Array<{ id: number; numero: string; montant: number; modePaiement: string; datePaiement: string }>;
  ventes: Array<{ dateVente: string; plaque: { numeroSerie: string; typeProduit: string } }>;
};

function SituationContent() {
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get("clientId") ?? "";

  const [clientId, setClientId] = useState(initialClientId);
  const [data, setData] = useState<SituationData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialClientId) setClientId(initialClientId);
  }, [initialClientId]);

  useEffect(() => {
    if (!clientId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/crm/situation/${clientId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Situation client</h1>
        <p className="mb-6 text-slate-500">Vue consolidée CRM : factures, paiements et ventes</p>

        <div className="card mb-6 max-w-md">
          <label className="mb-2 block text-sm font-medium">Sélectionner un client</label>
          <ClientSelect value={clientId} onChange={setClientId} />
        </div>

        {loading && <p className="text-slate-400">Chargement...</p>}

        {data && !loading && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card">
                <p className="text-sm text-slate-500">Total facturé</p>
                <p className="text-xl font-bold">{formatFcfa(data.situation.totalFacture)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Total payé</p>
                <p className="text-xl font-bold text-green-600">{formatFcfa(data.situation.totalPaye)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Solde dû</p>
                <p className="text-xl font-bold text-amber-600">{formatFcfa(data.situation.soldeDu)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Ventes plaques</p>
                <p className="text-xl font-bold">{data.situation.nbVentes}</p>
              </div>
            </div>

            <div className="card mb-6">
              <h2 className="mb-2 text-lg font-semibold">{data.client.nom}</h2>
              <p className="text-sm text-slate-600">
                {data.client.telephone} · {data.client.email ?? "—"}
                {data.client.vehiculesSummary && (
                  <> · <span className="font-mono">{data.client.vehiculesSummary}</span></>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/clients/${data.client.id}`} className="btn-secondary !py-1.5 !text-xs">
                  Fiche client
                </Link>
                <Link href={`/crm/factures/nouveau?clientId=${data.client.id}`} className="btn-secondary !py-1.5 !text-xs">
                  Nouvelle facture
                </Link>
                <Link href={`/ventes/nouvelle?clientId=${data.client.id}`} className="btn-secondary !py-1.5 !text-xs">
                  Nouvelle vente
                </Link>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <FilterableSection
                title="Factures"
                items={data.factures}
                placeholder="Rechercher n° facture, statut…"
                match={(f, q) =>
                  f.numero.toLowerCase().includes(q) ||
                  (FACTURE_STATUT_LABELS[f.statut] ?? f.statut).toLowerCase().includes(q)
                }
                render={(f) => (
                  <Row
                    key={f.id}
                    left={f.numero}
                    right={`${formatFcfa(f.montantTtc)} · solde ${formatFcfa(f.solde)}`}
                    badge={FACTURE_STATUT_LABELS[f.statut]}
                    action={f.solde > 0 ? `/crm/recus/nouveau?factureId=${f.id}` : undefined}
                    actionLabel="Payer"
                  />
                )}
              />
              <FilterableSection
                title="Reçus de paiement"
                items={data.recus}
                placeholder="Rechercher n° reçu, mode…"
                match={(r, q) =>
                  r.numero.toLowerCase().includes(q) ||
                  (MODE_PAIEMENT_LABELS[r.modePaiement] ?? r.modePaiement).toLowerCase().includes(q)
                }
                render={(r) => (
                  <Row
                    key={r.id}
                    left={r.numero}
                    right={formatFcfa(r.montant)}
                    badge={MODE_PAIEMENT_LABELS[r.modePaiement]}
                  />
                )}
              />
              <FilterableSection
                title="Ventes plaques"
                items={data.ventes}
                placeholder="Rechercher série, produit…"
                match={(v, q) =>
                  v.plaque.numeroSerie.toLowerCase().includes(q) ||
                  v.plaque.typeProduit.toLowerCase().replace("_", " ").includes(q)
                }
                render={(v, i) => (
                  <Row
                    key={i}
                    left={v.plaque.numeroSerie}
                    right={new Date(v.dateVente).toLocaleDateString("fr-FR")}
                    badge={v.plaque.typeProduit.replace("_", " ")}
                  />
                )}
              />
            </div>
          </>
        )}

        {!clientId && !loading && (
          <p className="text-center text-slate-400">Sélectionnez un client pour afficher sa situation</p>
        )}
      </main>
    </div>
  );
}

function FilterableSection<T>({
  title,
  items,
  placeholder,
  match,
  render,
}: {
  title: string;
  items: T[];
  placeholder: string;
  match: (item: T, q: string) => boolean;
  render: (item: T, index: number) => ReactNode;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const lower = q.trim().toLowerCase();
  const filtered = lower ? items.filter((i) => match(i, lower)) : items;
  const { items: slice, pagination } = paginateItems(filtered, page, 8);

  return (
    <div className="card">
      <h3 className="mb-3 font-semibold text-slate-900">{title}</h3>
      <input
        className="input-field mb-3"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <div className="space-y-2">
        {slice.length === 0 ? <p className="text-sm text-slate-400">Aucun élément</p> : slice.map(render)}
      </div>
      <PaginationBar
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        onPage={setPage}
        label="élément"
      />
    </div>
  );
}

function Row({
  left,
  right,
  badge,
  action,
  actionLabel,
}: {
  left: string;
  right: string;
  badge?: string;
  action?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
      <div>
        <p className="font-mono text-xs">{left}</p>
        {badge && <span className="badge badge-info mt-1">{badge}</span>}
      </div>
      <div className="text-right">
        <p className="text-slate-600">{right}</p>
        {action && (
          <Link href={action} className="text-xs text-red-600 hover:underline">
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SituationPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement...</div>}>
      <SituationContent />
    </Suspense>
  );
}
