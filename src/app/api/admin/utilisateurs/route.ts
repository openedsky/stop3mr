import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { APP_ROLES, ROLES } from "@/lib/roles";
import { nextCodeCommercial } from "@/lib/commercial-code";
import { generateTemporaryPassword } from "@/lib/security";
import { deposerMotDePasseTemporaire } from "@/lib/secret-temporaire";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const role = searchParams.get("role") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 40)));
  const skip = (page - 1) * limit;
  const codeQ = q && /^\d+$/.test(q) ? Number(q) : null;
  const actifParam = searchParams.get("actif")?.trim();

  const where = {
    ...(actifParam === "true" ? { actif: true } : {}),
    ...(actifParam === "false" ? { actif: false } : {}),
    ...(role && ["OPERATEUR", "ADMINISTRATEUR", "COMMERCIAL", "AGENT_CT"].includes(role) ? { role: role as never } : {}),
    ...(q
      ? {
          OR: [
            { identifiant: { contains: q } },
            { prenom: { contains: q } },
            { nom: { contains: q } },
            { telephone: { contains: q } },
            ...(codeQ ? [{ codeCommercial: codeQ }] : []),
          ],
        }
      : {}),
  };

  const [utilisateurs, total, parRole] = await Promise.all([
    prisma.utilisateur.findMany({
      where,
      orderBy: [{ role: "asc" }, { identifiant: "asc" }],
      skip,
      take: limit,
      select: {
        id: true,
        identifiant: true,
        prenom: true,
        nom: true,
        codeCommercial: true,
        email: true,
        telephone: true,
        role: true,
        actif: true,
        centreControleId: true,
        centreControle: { select: { code: true, libelle: true, ville: true } },
        creeLe: true,
        _count: { select: { ventesEnregistrees: true, plaquesAffectees: true, verifications: true } },
      },
    }),
    prisma.utilisateur.count({ where }),
    prisma.utilisateur.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  return NextResponse.json({
    utilisateurs,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit) || 1),
    parRole,
  });
}

const createSchema = z.object({
  identifiant: z.string().min(3).max(100),
  prenom: z.string().min(2).max(100),
  nom: z.string().min(2).max(150),
  email: z.string().email().optional().or(z.literal("")),
  telephone: z.string().optional(),
  role: z.enum(APP_ROLES),
  centreControleId: z.number().int().positive().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const exists = await prisma.utilisateur.findUnique({
    where: { identifiant: parsed.data.identifiant },
  });
  if (exists) {
    return NextResponse.json({ error: "Identifiant déjà utilisé" }, { status: 409 });
  }

  const motDePasseTemporaire = generateTemporaryPassword();
  const user = await prisma.utilisateur.create({
    data: {
      identifiant: parsed.data.identifiant,
      motDePasseHash: await bcrypt.hash(motDePasseTemporaire, 12),
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      role: parsed.data.role,
      codeCommercial: parsed.data.role === "COMMERCIAL" ? await nextCodeCommercial() : null,
      centreControleId:
        parsed.data.role === "AGENT_CT" || parsed.data.role === "COMMERCIAL"
          ? parsed.data.centreControleId ?? null
          : null,
    },
    select: {
      id: true,
      identifiant: true,
      prenom: true,
      nom: true,
      codeCommercial: true,
      role: true,
      actif: true,
    },
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "UTILISATEUR_CREE",
    cible: user.identifiant,
    details: JSON.stringify({ role: user.role }),
    adresseIp: getClientIp(request),
  });

  const secretTemporaireId = await deposerMotDePasseTemporaire(user.id, motDePasseTemporaire);
  return NextResponse.json({ utilisateur: user, secretTemporaireId }, { status: 201 });
}
