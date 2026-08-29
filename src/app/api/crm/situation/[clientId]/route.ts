import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { decryptClientRecord } from "@/lib/clients";
import { ROLES } from "@/lib/roles";

const LIST_CAP = 100;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { error } = await requireAuth(ROLES.CLIENTS);
  if (error) return error;

  const { clientId } = await params;
  const id = Number(clientId);
  if (Number.isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const [client, ventes, factures, recus, factureAgg, recuAgg, impayeesAgg, nbVentes] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        vehicules: { where: { actif: true }, orderBy: { creeLe: "asc" } },
      },
    }),
    prisma.vente.findMany({
      where: { clientId: id },
      include: {
        plaque: { select: { numeroSerie: true, typeProduit: true, prixReference: true } },
        vehicule: { select: { immatriculation: true, marqueVehicule: true, modeleVehicule: true } },
      },
      orderBy: { dateVente: "desc" },
      take: LIST_CAP,
    }),
    prisma.facture.findMany({
      where: { clientId: id },
      include: { recus: true },
      orderBy: { dateEmission: "desc" },
      take: LIST_CAP,
    }),
    prisma.recuPaiement.findMany({
      where: { clientId: id },
      include: { facture: { select: { numero: true } } },
      orderBy: { datePaiement: "desc" },
      take: LIST_CAP,
    }),
    prisma.facture.aggregate({
      where: { clientId: id, statut: { not: "ANNULEE" } },
      _sum: { montantTtc: true },
      _count: true,
    }),
    prisma.recuPaiement.aggregate({
      where: { clientId: id },
      _sum: { montant: true },
      _count: true,
    }),
    prisma.facture.aggregate({
      where: { clientId: id, statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE"] } },
      _sum: { montantTtc: true, montantPaye: true },
      _count: true,
    }),
    prisma.vente.count({ where: { clientId: id } }),
  ]);

  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const decrypted = decryptClientRecord(client);
  const totalFacture = factureAgg._sum.montantTtc ?? 0;
  const totalPaye = recuAgg._sum.montant ?? 0;
  const soldeDu = (impayeesAgg._sum.montantTtc ?? 0) - (impayeesAgg._sum.montantPaye ?? 0);

  return NextResponse.json({
    client: {
      ...decrypted,
      vehicules: client.vehicules,
      vehiculesSummary: client.vehicules.map((v) => v.immatriculation).join(", "),
    },
    situation: {
      totalFacture,
      totalPaye,
      soldeDu,
      facturesImpayees: impayeesAgg._count,
      nbVentes,
      nbFactures: factureAgg._count,
      nbRecus: recuAgg._count,
    },
    ventes,
    factures: factures.map((f) => ({
      ...f,
      solde: f.montantTtc - f.montantPaye,
    })),
    recus,
  });
}
