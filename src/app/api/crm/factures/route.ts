import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { decryptClientRecord, normalizePersonName, searchHash } from "@/lib/clients";
import { generateDocumentNumber } from "@/lib/crm";
import { ROLES } from "@/lib/roles";
import { parseListParams, paginationMeta, dateRange } from "@/lib/pagination";

const factureSchema = z
  .object({
    clientId: z.number().int().positive(),
    montantHt: z.number().int().positive(),
    montantTtc: z.number().int().positive(),
    tva: z.number().int().min(0).default(0),
    description: z.string().optional(),
    dateEcheance: z.string().optional(),
    statut: z.enum(["BROUILLON", "EMISE"]).optional(),
  })
  .refine((d) => d.montantTtc >= d.montantHt, { message: "Le montant TTC doit être supérieur ou égal au HT" })
  .refine((d) => d.montantTtc === d.montantHt + d.tva, {
    message: "Le TTC doit être égal au HT + TVA",
  });

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.CRM);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip, q } = parseListParams(searchParams, 20);
  const clientId = searchParams.get("clientId");
  const statut = searchParams.get("statut");
  const impayees = searchParams.get("impayees") === "true";
  const range = dateRange(searchParams.get("from"), searchParams.get("to"));

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = Number(clientId);
  if (statut) where.statut = statut;
  if (impayees) where.statut = { in: ["EMISE", "PARTIELLEMENT_PAYEE"] };
  if (range) where.dateEmission = range;

  const include = {
    client: true,
    createur: { select: { identifiant: true } },
    _count: { select: { recus: true } },
  };

  const mapFacture = <
    T extends {
      numero: string;
      montantTtc: number;
      montantPaye: number;
      client: Parameters<typeof decryptClientRecord>[0];
    },
  >(
    f: T
  ) => ({
    ...f,
    client: decryptClientRecord(f.client),
    solde: f.montantTtc - f.montantPaye,
  });

  if (q) {
    const nomNorm = normalizePersonName(q);
    where.OR = [
      { numero: { contains: q } },
      ...(nomNorm ? [{ client: { nomHash: searchHash(nomNorm) } }] : []),
      ...(nomNorm.length >= 3 ? [{ client: { nomPrefixHash: searchHash(nomNorm.slice(0, 3)) } }] : []),
      { client: { ncc: { contains: q } } },
    ];
  }

  const [factures, total] = await Promise.all([
    prisma.facture.findMany({
      where,
      include,
      orderBy: { dateEmission: "desc" },
      skip,
      take: limit,
    }),
    prisma.facture.count({ where }),
  ]);

  return NextResponse.json({
    factures: factures.map(mapFacture),
    pagination: paginationMeta(page, limit, total),
  });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.CRM);
  if (error) return error;

  const body = await request.json();
  const parsed = factureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId, actif: true } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const statut = parsed.data.statut ?? "EMISE";

  const facture = await prisma.$transaction(async (tx) => {
    const numero = await generateDocumentNumber("FAC", tx);
    return tx.facture.create({
      data: {
        numero,
        clientId: parsed.data.clientId,
        montantHt: parsed.data.montantHt,
        montantTtc: parsed.data.montantTtc,
        tva: parsed.data.tva,
        description: parsed.data.description,
        dateEcheance: parsed.data.dateEcheance ? new Date(parsed.data.dateEcheance) : null,
        statut,
        createurId: Number(session!.user.id),
      },
      include: { client: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "FACTURE_CREEE",
    cible: facture.numero,
    adresseIp: getClientIp(request),
  });

  return NextResponse.json(
    { facture: { ...facture, client: decryptClientRecord(facture.client), solde: facture.montantTtc } },
    { status: 201 }
  );
}
