import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { decryptClientRecord, normalizePersonName, searchHash } from "@/lib/clients";
import { generateDocumentNumber, computeFactureStatut } from "@/lib/crm";
import { ROLES } from "@/lib/roles";
import { parseListParams, paginationMeta, dateRange } from "@/lib/pagination";

const recuSchema = z.object({
  factureId: z.number().int().positive(),
  montant: z.number().int().positive(),
  modePaiement: z.enum(["ESPECES", "VIREMENT", "CHEQUE", "MOBILE_MONEY", "AUTRE"]),
  datePaiement: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.CRM);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip, q } = parseListParams(searchParams, 20);
  const clientId = searchParams.get("clientId");
  const factureId = searchParams.get("factureId");
  const modePaiement = searchParams.get("modePaiement")?.trim();
  const range = dateRange(searchParams.get("from"), searchParams.get("to"));

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = Number(clientId);
  if (factureId) where.factureId = Number(factureId);
  if (modePaiement) where.modePaiement = modePaiement;
  if (range) where.datePaiement = range;

  const include = {
    client: true,
    facture: { select: { numero: true, montantTtc: true } },
    createur: { select: { identifiant: true } },
  };

  if (q) {
    const nomNorm = normalizePersonName(q);
    where.OR = [
      { numero: { contains: q } },
      { facture: { numero: { contains: q } } },
      ...(nomNorm ? [{ client: { nomHash: searchHash(nomNorm) } }] : []),
      ...(nomNorm.length >= 3 ? [{ client: { nomPrefixHash: searchHash(nomNorm.slice(0, 3)) } }] : []),
    ];
  }

  const [recus, total] = await Promise.all([
    prisma.recuPaiement.findMany({
      where,
      include,
      orderBy: { datePaiement: "desc" },
      skip,
      take: limit,
    }),
    prisma.recuPaiement.count({ where }),
  ]);

  return NextResponse.json({
    recus: recus.map((r) => ({ ...r, client: decryptClientRecord(r.client) })),
    pagination: paginationMeta(page, limit, total),
  });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.CRM);
  if (error) return error;

  const body = await request.json();
  const parsed = recuSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const facture = await prisma.facture.findUnique({
    where: { id: parsed.data.factureId },
    include: { client: true },
  });

  if (!facture) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  if (facture.statut === "ANNULEE") return NextResponse.json({ error: "Facture annulée" }, { status: 409 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM factures WHERE id = ${facture.id} FOR UPDATE`;
      const locked = await tx.facture.findUnique({ where: { id: facture.id } });
      if (!locked) throw Object.assign(new Error("Facture introuvable"), { status: 404 });
      if (locked.statut === "ANNULEE") throw Object.assign(new Error("Facture annulée"), { status: 409 });

      const solde = locked.montantTtc - locked.montantPaye;
      if (parsed.data.montant > solde) {
        throw Object.assign(new Error(`Montant supérieur au solde (${solde} F CFA)`), { status: 400 });
      }

      const numero = await generateDocumentNumber("REC", tx);
      const recu = await tx.recuPaiement.create({
        data: {
          numero,
          factureId: locked.id,
          clientId: locked.clientId,
          montant: parsed.data.montant,
          modePaiement: parsed.data.modePaiement,
          datePaiement: parsed.data.datePaiement ? new Date(parsed.data.datePaiement) : new Date(),
          reference: parsed.data.reference,
          notes: parsed.data.notes,
          createurId: Number(session!.user.id),
        },
        include: { facture: true, client: true },
      });

      const newMontantPaye = locked.montantPaye + parsed.data.montant;
      await tx.facture.update({
        where: { id: locked.id },
        data: {
          montantPaye: { increment: parsed.data.montant },
          statut: computeFactureStatut(locked.montantTtc, newMontantPaye),
        },
      });

      return recu;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });

    await logAudit({
      utilisateurId: Number(session!.user.id),
      action: "RECU_CREE",
      cible: result.numero,
      details: JSON.stringify({ facture: facture.numero, montant: parsed.data.montant }),
      adresseIp: getClientIp(request),
    });

    return NextResponse.json(
      { recu: { ...result, client: decryptClientRecord(result.client) } },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de paiement";
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: message }, { status });
  }
}
