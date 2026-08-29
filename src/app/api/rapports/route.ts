import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { ROLES } from "@/lib/roles";
import { parseListParams, paginationMeta } from "@/lib/pagination";
import { resoudreCentreSaisi } from "@/lib/centres";

const TYPES_VENDEUR = ["SITUATION_VENTE", "RUPTURE_STOCK", "INCIDENT_SITE", "AUTRE"] as const;
const TYPES_AGENT = ["ANOMALIE_CONTROLE", "CONTREFACON", "INCIDENT_SITE", "AUTRE"] as const;

const createSchema = z.object({
  type: z.enum(["SITUATION_VENTE", "RUPTURE_STOCK", "ANOMALIE_CONTROLE", "CONTREFACON", "INCIDENT_SITE", "AUTRE"]),
  titre: z.string().min(5).max(200),
  contenu: z.string().min(10).max(8000),
  centreId: z.number().int().positive().optional().nullable(),
  periodeDebut: z.string().optional().nullable(),
  periodeFin: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.RAPPORTS);
  if (error) return error;

  const role = session!.user.role;
  const userId = Number(session!.user.id);
  const { searchParams } = new URL(request.url);
  const { page, limit, skip, q } = parseListParams(searchParams, 20);
  const type = searchParams.get("type")?.trim();
  const statut = searchParams.get("statut")?.trim();

  const where = {
    ...(role === "ADMINISTRATEUR" ? {} : { auteurId: userId }),
    ...(q ? { OR: [{ titre: { contains: q } }, { contenu: { contains: q } }] } : {}),
    ...(type ? { type: type as never } : {}),
    ...(statut ? { statut: statut as never } : {}),
  };

  const [rapports, total] = await Promise.all([
    prisma.rapport.findMany({
      where,
      orderBy: { creeLe: "desc" },
      skip,
      take: limit,
      include: {
        auteur: { select: { identifiant: true, prenom: true, nom: true, role: true } },
        centre: { select: { code: true, libelle: true, ville: true } },
      },
    }),
    prisma.rapport.count({ where }),
  ]);

  return NextResponse.json({ rapports, pagination: paginationMeta(page, limit, total) });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.RAPPORTS);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const role = session!.user.role;
  const allowed = role === "ADMINISTRATEUR" ? [...TYPES_VENDEUR, ...TYPES_AGENT] : role === "COMMERCIAL" ? TYPES_VENDEUR : TYPES_AGENT;
  if (!(allowed as readonly string[]).includes(parsed.data.type)) {
    return NextResponse.json({ error: "Type de rapport non autorisé pour ce rôle" }, { status: 403 });
  }

  const me = await prisma.utilisateur.findUnique({
    where: { id: Number(session!.user.id) },
    select: { centreControleId: true },
  });
  const centreResolu = await resoudreCentreSaisi({
    saisi: parsed.data.centreId,
    role,
    rattacheId: me?.centreControleId,
  });
  if (centreResolu.error) {
    return NextResponse.json({ error: centreResolu.error }, { status: centreResolu.status ?? 400 });
  }

  const rapport = await prisma.rapport.create({
    data: {
      auteurId: Number(session!.user.id),
      type: parsed.data.type,
      titre: parsed.data.titre,
      contenu: parsed.data.contenu,
      centreId: centreResolu.centreId,
      periodeDebut: parsed.data.periodeDebut ? new Date(parsed.data.periodeDebut) : null,
      periodeFin: parsed.data.periodeFin ? new Date(parsed.data.periodeFin) : null,
      statut: "SOUMIS",
    },
    include: {
      auteur: { select: { identifiant: true, prenom: true, nom: true } },
      centre: { select: { libelle: true } },
    },
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "RAPPORT_SOUMIS",
    cible: rapport.titre,
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ rapport }, { status: 201 });
}
