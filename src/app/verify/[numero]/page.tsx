import { prisma } from "@/lib/db";
import { BrandProtection, Watermark } from "@/components/BrandProtection";
import { ValiditeBadge } from "@/components/ValiditeBadge";
import { getMetierSettings } from "@/lib/metier";
import { buildValiditeFigee } from "@/lib/validite";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  STOP: "Plaque STOP",
  LIMITATION_VITESSE: "Plaque limitation de vitesse",
};

const MIN_LOOKUP_MS = 80;

async function withMinDelay<T>(promise: Promise<T>, minMs = MIN_LOOKUP_MS): Promise<T> {
  const started = Date.now();
  const result = await promise;
  const wait = minMs - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return result;
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const decoded = decodeURIComponent(numero);

  const plaque = await withMinDelay(
    prisma.plaque.findUnique({
      where: { numeroSerie: decoded },
      select: {
        numeroSerie: true,
        typeProduit: true,
        dateFabrication: true,
        statut: true,
        siteProduction: true,
        vitesseLimitation: true,
        produit: { select: { libelle: true, code: true, dimensions: true } },
        vente: { select: { dateVente: true, dateExpiration: true, validiteMois: true, alerteExpirationJours: true } },
      },
    })
  );

  if (!plaque) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-red-950 px-4 py-12">
        <BrandProtection>
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="relative border-b border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Résultat de vérification</h1>
              <p className="mt-1 text-sm text-slate-600">Ce QR n’est pas reconnu comme un produit Stop 3MR authentifié.</p>
            </div>
            <div className="relative space-y-4 px-6 py-8">
              <p className="text-sm text-slate-500">
                Les informations personnelles du propriétaire ne sont pas affichées sur cette page publique.
              </p>
              <Link href="/" className="btn-primary inline-block">
                Retour
              </Link>
            </div>
          </div>
        </BrandProtection>
      </div>
    );
  }

  const settings = await getMetierSettings();
  const validite = buildValiditeFigee({
    dateAchat: plaque.vente?.dateVente ?? null,
    dateExpiration: plaque.vente?.dateExpiration ?? null,
    validiteMois: plaque.vente?.validiteMois ?? null,
    alerteJours: plaque.vente?.alerteExpirationJours ?? settings.plaqueAlerteExpirationJours,
  });
  const headerExpired = validite.statut === "EXPIREE";
  const headerSoon = validite.statut === "EXPIRE_BIENTOT";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-red-950 px-4 py-12">
      <BrandProtection>
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
          <Watermark text={plaque.numeroSerie} />

          <div
            className={`relative border-b px-6 py-8 text-center ${
              headerExpired
                ? "border-red-200 bg-red-50"
                : headerSoon
                  ? "border-amber-200 bg-amber-50"
                  : "border-green-200 bg-green-50"
            }`}
          >
            <div
              className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                headerExpired ? "bg-red-100" : headerSoon ? "bg-amber-100" : "bg-green-100"
              }`}
            >
              <svg
                className={`h-8 w-8 ${headerExpired ? "text-red-600" : headerSoon ? "text-amber-600" : "text-green-600"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {headerExpired ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                )}
              </svg>
            </div>
            <h1
              className={`text-xl font-bold ${
                headerExpired ? "text-red-800" : headerSoon ? "text-amber-800" : "text-green-800"
              }`}
            >
              {headerExpired ? "Plaque authentique — validité expirée" : "Produit authentique Stop 3MR"}
            </h1>
            <p
              className={`mt-1 text-sm ${
                headerExpired ? "text-red-600" : headerSoon ? "text-amber-700" : "text-green-600"
              }`}
            >
              {headerExpired
                ? "Ce produit est reconnu, mais sa période de validité de deux ans est dépassée."
                : headerSoon
                  ? "Ce produit est reconnu. Sa validité arrive bientôt à échéance."
                  : "Ce produit est reconnu par la plateforme officielle"}
            </p>
          </div>

          <div className="relative space-y-4 px-6 py-8">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white">
                3MR
              </div>
              <div>
                <p className="font-bold text-slate-900">Stop Réfléchissant 3M</p>
                <p className="text-xs text-slate-500">Marque verbale Stop 3MR</p>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Numéro de série</dt>
                <dd className="font-mono font-semibold text-slate-900">{plaque.numeroSerie}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Type de plaque</dt>
                <dd className="font-medium text-right">
                  {plaque.produit?.libelle ?? TYPE_LABELS[plaque.typeProduit] ?? plaque.typeProduit}
                  {plaque.vitesseLimitation ? ` — ${plaque.vitesseLimitation} km/h` : ""}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Date de fabrication</dt>
                <dd>{plaque.dateFabrication.toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Site de production</dt>
                <dd>{plaque.siteProduction}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Statut produit</dt>
                <dd>
                  <span className={`badge ${plaque.statut === "VENDUE" ? "badge-success" : "badge-info"}`}>
                    {plaque.statut === "VENDUE" ? "Enregistrée / vendue" : "Authentique — en stock"}
                  </span>
                </dd>
              </div>
              {validite.dateExpiration && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Date d&apos;achat</dt>
                    <dd>{validite.dateAchat?.toLocaleDateString("fr-FR")}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Validité</dt>
                    <dd className="text-right">
                      <ValiditeBadge statut={validite.statut} joursRestants={validite.joursRestants} />
                      <p className="mt-1 text-xs text-slate-500">
                        Jusqu&apos;au {validite.dateExpiration.toLocaleDateString("fr-FR")}
                      </p>
                    </dd>
                  </div>
                </>
              )}
            </dl>

            <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">
              Les informations personnelles du propriétaire ne sont pas affichées sur cette page
              publique, conformément à la politique de confidentialité.
            </p>
          </div>
        </div>
      </BrandProtection>
    </div>
  );
}
