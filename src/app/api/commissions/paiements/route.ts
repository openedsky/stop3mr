import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { currentYearMonth, monthBounds } from "@/lib/metier";
import { createPaiementCommission } from "@/lib/commissions";
import { logAudit } from "@/lib/audit";
import { paginationMeta, parseListParams } from "@/lib/pagination";
import { nomComplet } from "@/lib/territoire";

function resolvePeriode(searchParams: URLSearchParams) {
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const mois = searchParams.get("mois") ?? currentYearMonth();
  if (fromStr && toStr) {
    const from = new Date(`${fromStr}T00:00:00`);
    const to = new Date(`${toStr}T23:59:59.999`);
    return { from, to, mois: "" };
  }
  return { ...monthBounds(mois), mois };
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth([...ROLES.PAIEMENTS_COMMISSIONS, ...ROLES.VENTES, ...ROLES.COMMISSIONS_CT]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { from, to, mois } = resolvePeriode(searchParams);
  const { page, limit, skip } = parseListParams(searchParams, 20);
  const role = session!.user.role;
  const userId = Number(session!.user.id);
  const isAdmin = role === "ADMINISTRATEUR";
  const type =
    role === "COMMERCIAL"
      ? "VENTE"
      : role === "AGENT_CT"
        ? "CONTROLE"
        : searchParams.get("type") === "CONTROLE"
          ? "CONTROLE"
          : searchParams.get("type") === "VENTE"
            ? "VENTE"
            : null;

  const venteWhere = {
    canal: "COMMERCIAL" as const,
    commissionMontant: { gt: 0 },
    dateVente: { gte: from, lte: to },
    ...(!isAdmin ? { vendeurId: userId } : {}),
  };
  const verifWhere = {
    resultat: "AUTHENTIQUE" as const,
    commissionMontant: { gt: 0 },
    horodatage: { gte: from, lte: to },
    ...(!isAdmin ? { agentId: userId } : {}),
  };

  const [ventesDue, ventesPayees, verifsDue, verifsPayees, historique, totalHist] = await Promise.all([
    type === "CONTROLE"
      ? []
      : prisma.vente.groupBy({
          by: ["vendeurId"],
          where: { ...venteWhere, paiementCommissionId: null, vendeurId: { not: null } },
          _count: { _all: true },
          _sum: { commissionMontant: true },
        }),
    type === "CONTROLE"
      ? []
      : prisma.vente.aggregate({
          where: { ...venteWhere, paiementCommissionId: { not: null } },
          _count: { _all: true },
          _sum: { commissionMontant: true },
        }),
    type === "VENTE"
      ? []
      : prisma.verification.groupBy({
          by: ["agentId"],
          where: { ...verifWhere, paiementCommissionId: null },
          _count: { _all: true },
          _sum: { commissionMontant: true },
        }),
    type === "VENTE"
      ? []
      : prisma.verification.aggregate({
          where: { ...verifWhere, paiementCommissionId: { not: null } },
          _count: { _all: true },
          _sum: { commissionMontant: true },
        }),
    prisma.paiementCommission.findMany({
      where: {
        datePaiement: { gte: from, lte: to },
        ...(type ? { type } : {}),
        ...(!isAdmin ? { utilisateurId: userId } : {}),
      },
      include: {
        utilisateur: { select: { id: true, identifiant: true, prenom: true, nom: true, role: true } },
        createur: { select: { identifiant: true, nom: true } },
      },
      orderBy: { datePaiement: "desc" },
      skip,
      take: limit,
    }),
    prisma.paiementCommission.count({
      where: {
        datePaiement: { gte: from, lte: to },
        ...(type ? { type } : {}),
        ...(!isAdmin ? { utilisateurId: userId } : {}),
      },
    }),
  ]);

  const userIds = [
    ...new Set([
      ...ventesDue.map((r) => r.vendeurId).filter((id): id is number => id != null),
      ...verifsDue.map((r) => r.agentId),
    ]),
  ];
  const users = userIds.length
    ? await prisma.utilisateur.findMany({
        where: { id: { in: userIds } },
        select: { id: true, identifiant: true, prenom: true, nom: true, role: true },
      })
    : [];
  const uMap = new Map(users.map((u) => [u.id, u]));

  const aPayer = [
    ...ventesDue.map((r) => ({
      type: "VENTE" as const,
      utilisateurId: r.vendeurId!,
      nom: nomComplet(uMap.get(r.vendeurId!) ?? { identifiant: `#${r.vendeurId}` }),
      identifiant: uMap.get(r.vendeurId!)?.identifiant ?? "",
      operations: r._count._all,
      montant: r._sum.commissionMontant ?? 0,
    })),
    ...verifsDue.map((r) => ({
      type: "CONTROLE" as const,
      utilisateurId: r.agentId,
      nom: nomComplet(uMap.get(r.agentId) ?? { identifiant: `#${r.agentId}` }),
      identifiant: uMap.get(r.agentId)?.identifiant ?? "",
      operations: r._count._all,
      montant: r._sum.commissionMontant ?? 0,
    })),
  ].sort((a, b) => b.montant - a.montant);

  const dueVentes = aPayer.filter((x) => x.type === "VENTE").reduce((s, x) => s + x.montant, 0);
  const dueControles = aPayer.filter((x) => x.type === "CONTROLE").reduce((s, x) => s + x.montant, 0);

  return NextResponse.json({
    periode: { from: from.toISOString(), to: to.toISOString(), mois },
    totaux: {
      aPayer: dueVentes + dueControles,
      ventesDue: dueVentes,
      controlesDue: dueControles,
      ventesPayees: type === "CONTROLE" ? 0 : (ventesPayees as { _sum: { commissionMontant: number | null } })._sum.commissionMontant ?? 0,
      controlesPayees: type === "VENTE" ? 0 : (verifsPayees as { _sum: { commissionMontant: number | null } })._sum.commissionMontant ?? 0,
    },
    aPayer,
    historique: historique.map((p) => ({
      ...p,
      beneficiaire: nomComplet(p.utilisateur),
    })),
    pagination: paginationMeta(page, limit, totalHist),
    canPay: isAdmin,
  });
}

const paySchema = z.object({
  type: z.enum(["VENTE", "CONTROLE"]),
  utilisateurId: z.number().int().positive(),
  mois: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  modePaiement: z.enum(["ESPECES", "VIREMENT", "CHEQUE", "MOBILE_MONEY", "AUTRE"]),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.PAIEMENTS_COMMISSIONS);
  if (error) return error;

  const parsed = paySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const { from, to } =
    parsed.data.from && parsed.data.to
      ? { from: new Date(`${parsed.data.from}T00:00:00`), to: new Date(`${parsed.data.to}T23:59:59.999`) }
      : monthBounds(parsed.data.mois ?? currentYearMonth());

  try {
    const paiement = await prisma.$transaction(
      async (tx) => {
        return createPaiementCommission(
          {
            type: parsed.data.type,
            utilisateurId: parsed.data.utilisateurId,
            periodeDebut: from,
            periodeFin: to,
            modePaiement: parsed.data.modePaiement,
            reference: parsed.data.reference,
            notes: parsed.data.notes,
            createurId: Number(session!.user.id),
          },
          tx
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 }
    );

    await logAudit({
      utilisateurId: Number(session!.user.id),
      action: "COMMISSION_PAYEE",
      cible: paiement.numero,
      details: JSON.stringify({
        type: paiement.type,
        utilisateurId: paiement.utilisateurId,
        montant: paiement.montant,
        operations: paiement.nombreOperations,
      }),
      adresseIp: getClientIp(request),
    });

    return NextResponse.json({ paiement }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Paiement impossible";
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: message }, { status });
  }
}
