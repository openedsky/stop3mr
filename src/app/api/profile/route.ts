import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/audit";

const profileSchema = z.object({
  prenom: z.string().min(2).max(100).optional(),
  nom: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  centreControleId: z.number().int().positive().nullable().optional(),
});

export async function GET() {
  const { error, session } = await requireAuth(ROLES.ALL);
  if (error) return error;

  const user = await prisma.utilisateur.findUnique({
    where: { id: Number(session!.user.id) },
    select: {
      id: true,
      identifiant: true,
      prenom: true,
      nom: true,
      email: true,
      role: true,
      creeLe: true,
      centreControle: { select: { id: true, libelle: true, ville: true, commune: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ALL);
  if (error) return error;

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const role = session!.user.role;
  const data: {
    prenom?: string;
    nom?: string;
    email?: string | null;
    centreControleId?: number | null;
  } = {};
  if (parsed.data.prenom !== undefined) data.prenom = parsed.data.prenom;
  if (parsed.data.nom !== undefined) data.nom = parsed.data.nom;
  if (parsed.data.email !== undefined) data.email = parsed.data.email || null;

  if (parsed.data.centreControleId !== undefined && (role === "COMMERCIAL" || role === "AGENT_CT")) {
    if (parsed.data.centreControleId) {
      const centre = await prisma.centreControle.findFirst({
        where: { id: parsed.data.centreControleId, actif: true },
        select: { id: true },
      });
      if (!centre) {
        return NextResponse.json({ error: "Centre de contrôle introuvable ou inactif" }, { status: 404 });
      }
      data.centreControleId = centre.id;
    } else {
      data.centreControleId = null;
    }
  }

  const user = await prisma.utilisateur.update({
    where: { id: Number(session!.user.id) },
    data,
    select: {
      id: true,
      identifiant: true,
      prenom: true,
      nom: true,
      email: true,
      role: true,
      creeLe: true,
      centreControle: { select: { id: true, libelle: true, ville: true, commune: true } },
    },
  });

  await logAudit({
    utilisateurId: user.id,
    action: "PROFIL_MODIFIE",
    cible: user.identifiant,
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ user });
}
