import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit, serializeAuditDiff } from "@/lib/audit";
import { synchroniserPrixStock } from "@/lib/tarif";
import { ROLES } from "@/lib/roles";
import { z } from "zod";

export async function GET() {
  const { error } = await requireAuth(ROLES.CATALOGUE);
  if (error) return error;

  const produits = await prisma.produit.findMany({
    orderBy: { ordre: "asc" },
  });

  return NextResponse.json({ produits });
}

const updateSchema = z.object({
  id: z.number().int().positive(),
  libelle: z.string().min(3).optional(),
  prixHt: z.number().int().min(0).optional(),
  commissionTaux: z.number().int().min(0).max(100).optional(),
  commissionTauxControleur: z.number().int().min(0).max(100).optional(),
  actif: z.boolean().optional(),
  dimensions: z.string().optional(),
  visibilite: z.string().optional(),
  usagePrincipal: z.string().optional(),
  description: z.string().optional(),
  vitessesDisponibles: z.string().optional().nullable(),
  barre: z.boolean().optional(),
});

const createSchema = z.object({
  code: z.string().min(2).max(40),
  libelle: z.string().min(3).max(255),
  famille: z.enum(["LIMITATION", "PLAQUE_ROUGE", "PLAQUE_BLANCHE", "BANDES_ROUGE_JAUNE", "BANDES_ROUGE_BLANC"]),
  dimensions: z.string().min(2).max(80),
  visibilite: z.string().min(1).max(80),
  prixHt: z.number().int().min(0),
  commissionTaux: z.number().int().min(0).max(100).default(10),
  commissionTauxControleur: z.number().int().min(0).max(100).default(10),
  usagePrincipal: z.string().min(2).max(255),
  description: z.string().optional().nullable(),
  vitessesDisponibles: z.string().optional().nullable(),
  barre: z.boolean().optional().default(false),
});

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const avant = await prisma.produit.findUnique({ where: { id } });
  if (!avant) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const produit = await prisma.$transaction(async (tx) => {
    const updated = await tx.produit.update({
      where: { id },
      data,
    });
    if (data.prixHt != null && data.prixHt !== avant.prixHt) {
      await synchroniserPrixStock(tx, id, data.prixHt);
    }
    return updated;
  });

  const avantSnapshot = {
    prixHt: avant.prixHt,
    commissionTaux: avant.commissionTaux,
    commissionTauxControleur: avant.commissionTauxControleur,
    libelle: avant.libelle,
    actif: avant.actif,
    dimensions: avant.dimensions,
    visibilite: avant.visibilite,
    usagePrincipal: avant.usagePrincipal,
    description: avant.description,
    vitessesDisponibles: avant.vitessesDisponibles,
    barre: avant.barre,
  };
  const apresSnapshot = {
    prixHt: produit.prixHt,
    commissionTaux: produit.commissionTaux,
    commissionTauxControleur: produit.commissionTauxControleur,
    libelle: produit.libelle,
    actif: produit.actif,
    dimensions: produit.dimensions,
    visibilite: produit.visibilite,
    usagePrincipal: produit.usagePrincipal,
    description: produit.description,
    vitessesDisponibles: produit.vitessesDisponibles,
    barre: produit.barre,
  };

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "PRODUIT_MODIFIE",
    cible: produit.code,
    details: serializeAuditDiff({
      avant: avantSnapshot,
      apres: apresSnapshot,
      extra: { note: "Les ventes déjà enregistrées conservent leur prix et commission d'origine." },
    }),
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ produit });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase().replace(/\s+/g, "-");
  const exists = await prisma.produit.findUnique({ where: { code } });
  if (exists) {
    return NextResponse.json({ error: "Ce code produit existe déjà" }, { status: 409 });
  }

  if (parsed.data.famille === "LIMITATION" && !parsed.data.vitessesDisponibles?.trim()) {
    return NextResponse.json({ error: "Les vitesses sont requises pour une limitation" }, { status: 400 });
  }

  const last = await prisma.produit.aggregate({ _max: { ordre: true } });
  const produit = await prisma.produit.create({
    data: {
      code,
      libelle: parsed.data.libelle,
      famille: parsed.data.famille,
      dimensions: parsed.data.dimensions,
      visibilite: parsed.data.visibilite,
      prixHt: parsed.data.prixHt,
      commissionTaux: parsed.data.commissionTaux,
      commissionTauxControleur: parsed.data.commissionTauxControleur,
      usagePrincipal: parsed.data.usagePrincipal,
      description: parsed.data.description || null,
      vitessesDisponibles:
        parsed.data.famille === "LIMITATION" ? parsed.data.vitessesDisponibles?.trim() || null : null,
      barre: parsed.data.barre ?? false,
      ordre: (last._max.ordre ?? 0) + 1,
      actif: true,
    },
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "PRODUIT_CREE",
    cible: produit.code,
    details: JSON.stringify({ libelle: produit.libelle, prixHt: produit.prixHt, commissionTaux: produit.commissionTaux }),
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ produit }, { status: 201 });
}

