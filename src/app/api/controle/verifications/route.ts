import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { ROLES } from "@/lib/roles";
import { dateRange, paginationMeta } from "@/lib/pagination";
import { getMetierSettings } from "@/lib/metier";
import { buildValiditeFigee, serializeValidite } from "@/lib/validite";
import { commissionControleAuthentique, tauxCommissionControleur } from "@/lib/commissions";
import { resoudreCentreSaisi } from "@/lib/centres";

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.CT);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const numero = searchParams.get("numero")?.trim();
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 30)));
  const skip = (page - 1) * limit;

  if (numero) {
    const plaque = await prisma.plaque.findUnique({
      where: { numeroSerie: numero },
      omit: { tokenEnregistrement: true },
      include: {
        produit: true,
        commercial: { select: { identifiant: true, nom: true } },
        vente: {
          include: {
            vehicule: { select: { immatriculation: true } },
          },
        },
      },
    });

    if (!plaque) {
      return NextResponse.json({
        found: false,
        resultatSuggere: "INCONNUE",
        plaque: null,
        validite: null,
      });
    }

    const settings = await getMetierSettings();
    const validite = buildValiditeFigee({
      dateAchat: plaque.vente?.dateVente ?? null,
      dateExpiration: plaque.vente?.dateExpiration ?? null,
      validiteMois: plaque.vente?.validiteMois ?? null,
      alerteJours: plaque.vente?.alerteExpirationJours ?? settings.plaqueAlerteExpirationJours,
    });

    return NextResponse.json({
      found: true,
      resultatSuggere: "AUTHENTIQUE",
      plaque: {
        numeroSerie: plaque.numeroSerie,
        typeProduit: plaque.typeProduit,
        statut: plaque.statut,
        siteProduction: plaque.siteProduction,
        dateFabrication: plaque.dateFabrication,
        vitesseLimitation: plaque.vitesseLimitation,
        produit: plaque.produit,
        commercial: plaque.commercial,
        immatriculation: plaque.vente?.vehicule?.immatriculation ?? null,
        dateAchat: plaque.vente?.dateVente ?? null,
      },
      validite: serializeValidite(validite),
    });
  }

  const role = session!.user.role;
  const userId = Number(session!.user.id);
  const resultat = searchParams.get("resultat")?.trim();
  const range = dateRange(searchParams.get("from"), searchParams.get("to"));
  const where: Record<string, unknown> =
    role === "AGENT_CT"
      ? { agentId: userId }
      : {};
  if (resultat) where.resultat = resultat;
  if (range) where.horodatage = range;
  if (q) {
    where.OR = [
      { numeroSaisi: { contains: q } },
      { immatriculationObservee: { contains: q } },
    ];
  }

  const [entries, total] = await Promise.all([
    prisma.verification.findMany({
      where,
      include: {
        agent: { select: { identifiant: true, nom: true } },
        centre: { select: { libelle: true, ville: true } },
        plaque: {
          select: {
            numeroSerie: true,
            produit: { select: { libelle: true } },
          },
        },
      },
      orderBy: { horodatage: "desc" },
      skip,
      take: limit,
    }),
    prisma.verification.count({ where }),
  ]);

  return NextResponse.json({
    verifications: entries,
    pagination: paginationMeta(page, limit, total),
  });
}

const createSchema = z.object({
  numeroSaisi: z.string().min(3, "Numéro de série requis"),
  resultat: z.enum(["AUTHENTIQUE", "INCONNUE", "CONTREFAITE"]),
  notes: z.string().optional(),
  immatriculationObservee: z.string().optional(),
  centreId: z.number().int().positive().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.CT);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const numero = parsed.data.numeroSaisi.trim();
  const agentId = Number(session!.user.id);
  const agent = await prisma.utilisateur.findUnique({
    where: { id: agentId },
    select: { centreControleId: true },
  });
  const centreResolu = await resoudreCentreSaisi({
    saisi: parsed.data.centreId,
    role: session!.user.role,
    rattacheId: agent?.centreControleId,
  });
  if (centreResolu.error) {
    return NextResponse.json({ error: centreResolu.error }, { status: centreResolu.status ?? 400 });
  }

  const plaque = await prisma.plaque.findUnique({
    where: { numeroSerie: numero },
    include: {
      produit: { select: { commissionTauxControleur: true } },
        vente: { select: { prixVente: true, alerteExpirationJours: true } },
    },
  });

  const taux = await tauxCommissionControleur(plaque?.produit?.commissionTauxControleur);

  let verification;
  try {
  verification = await prisma.$transaction(async (tx) => {
    let dejaCommissionnee = false;
    if (plaque?.id) {
      await tx.$queryRaw`SELECT id FROM plaques WHERE id = ${plaque.id} FOR UPDATE`;
    }
    if (plaque?.id && parsed.data.resultat === "AUTHENTIQUE") {
      const existing = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM verifications
        WHERE plaque_id = ${plaque.id}
          AND commission_auth_plaque_id IS NOT NULL
        FOR UPDATE
      `;
      dejaCommissionnee = existing.length > 0;
    }

    const commission = commissionControleAuthentique({
      resultat: parsed.data.resultat,
      plaqueVendue: plaque?.statut === "VENDUE" && (plaque.vente?.prixVente ?? 0) > 0,
      dejaCommissionnee,
      prixVente: plaque?.vente?.prixVente ?? 0,
      taux,
    });

    return tx.verification.create({
      data: {
        numeroSaisi: numero,
        plaqueId: plaque?.id ?? null,
        agentId,
        centreId: centreResolu.centreId,
        resultat: parsed.data.resultat,
        notes: parsed.data.notes || null,
        immatriculationObservee: parsed.data.immatriculationObservee?.toUpperCase() || null,
        commissionTaux: commission.commissionTaux,
        commissionMontant: commission.commissionMontant,
        commissionAuthPlaqueId:
          commission.commissionMontant > 0 && plaque?.id ? plaque.id : null,
      },
      include: {
        centre: { select: { libelle: true } },
        plaque: { select: { numeroSerie: true } },
      },
    });
  });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Cette plaque a déjà une commission AUTHENTIQUE" },
        { status: 409 }
      );
    }
    throw err;
  }

  await logAudit({
    utilisateurId: agentId,
    action: "VERIFICATION_CT",
    cible: numero,
    details: JSON.stringify({
      resultat: verification.resultat,
      plaqueId: plaque?.id ?? null,
      commissionMontant: verification.commissionMontant,
    }),
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ verification }, { status: 201 });
}
