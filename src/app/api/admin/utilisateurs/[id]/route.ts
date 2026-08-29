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
const patchSchema = z.object({
  prenom: z.string().min(2).max(100).optional(),
  nom: z.string().min(2).max(150).optional(),
  email: z.string().email().optional().or(z.literal("")),
  telephone: z.string().optional().nullable(),
  role: z.enum(APP_ROLES).optional(),
  actif: z.boolean().optional(),
  centreControleId: z.number().int().positive().optional().nullable(),
  resetMotDePasse: z.boolean().optional(),
});

async function lastAdminGuard(userId: number, nextRole?: string, nextActif?: boolean) {
  const current = await prisma.utilisateur.findUnique({ where: { id: userId } });
  if (!current) return "Utilisateur introuvable";
  const staysAdmin = (nextRole ?? current.role) === "ADMINISTRATEUR" && (nextActif ?? current.actif) !== false;
  if (current.role === "ADMINISTRATEUR" && current.actif && !staysAdmin) {
    const others = await prisma.utilisateur.count({
      where: { role: "ADMINISTRATEUR", actif: true, id: { not: userId } },
    });
    if (others === 0) return "Impossible de retirer le dernier administrateur actif";
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const userId = Number((await params).id);
  if (!userId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  if (userId === Number(session!.user.id) && parsed.data.actif === false) {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte" }, { status: 400 });
  }

  const guard = await lastAdminGuard(userId, parsed.data.role, parsed.data.actif);
  if (guard) return NextResponse.json({ error: guard }, { status: 400 });

  const role = parsed.data.role;
  const data: Record<string, unknown> = {};
  if (parsed.data.prenom !== undefined) data.prenom = parsed.data.prenom;
  if (parsed.data.nom !== undefined) data.nom = parsed.data.nom;
  if (parsed.data.email !== undefined) data.email = parsed.data.email || null;
  if (parsed.data.telephone !== undefined) data.telephone = parsed.data.telephone || null;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.actif !== undefined) data.actif = parsed.data.actif;
  let motDePasseTemporaire: string | undefined;
  if (parsed.data.resetMotDePasse) {
    const target = await prisma.utilisateur.findUnique({ where: { id: userId }, select: { identifiant: true } });
    if (target) {
      motDePasseTemporaire = generateTemporaryPassword();
      data.motDePasseHash = await bcrypt.hash(motDePasseTemporaire, 12);
    }
  }
  if (parsed.data.centreControleId !== undefined || role) {
    const nextRole = role ?? (await prisma.utilisateur.findUnique({ where: { id: userId }, select: { role: true } }))?.role;
    if (nextRole === "AGENT_CT" || nextRole === "COMMERCIAL") {
      if (parsed.data.centreControleId !== undefined) data.centreControleId = parsed.data.centreControleId;
    } else if (role) {
      data.centreControleId = null;
    }
  }

  const currentUser = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { role: true, codeCommercial: true },
  });
  const nextRole = (role ?? currentUser?.role) as string | undefined;
  if (nextRole === "COMMERCIAL" && !currentUser?.codeCommercial) {
    data.codeCommercial = await nextCodeCommercial();
  }

  const user = await prisma.utilisateur.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      identifiant: true,
      prenom: true,
      nom: true,
      codeCommercial: true,
      role: true,
      actif: true,
      centreControleId: true,
    },
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: parsed.data.actif === false ? "UTILISATEUR_DESACTIVE" : parsed.data.resetMotDePasse ? "MOT_DE_PASSE_REINITIALISE" : "UTILISATEUR_MODIFIE",
    cible: user.identifiant,
    details: JSON.stringify({ ...parsed.data }),
    adresseIp: getClientIp(request),
  });

  const secretTemporaireId = motDePasseTemporaire
    ? await deposerMotDePasseTemporaire(user.id, motDePasseTemporaire)
    : undefined;
  return NextResponse.json({ utilisateur: user, secretTemporaireId });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const userId = Number((await params).id);
  if (!userId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  if (userId === Number(session!.user.id)) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
  }

  const guard = await lastAdminGuard(userId, "OPERATEUR", false);
  if (guard) return NextResponse.json({ error: guard }, { status: 400 });

  const [ventes, verifs, plaques] = await Promise.all([
    prisma.vente.count({ where: { vendeurId: userId } }),
    prisma.verification.count({ where: { agentId: userId } }),
    prisma.plaque.count({ where: { OR: [{ commercialId: userId }, { createurId: userId }] } }),
  ]);
  if (ventes + verifs + plaques > 0) {
    return NextResponse.json(
      {
        error:
          "Ce compte a des ventes, contrôles ou plaques liés. Désactivez-le plutôt que de le supprimer.",
      },
      { status: 409 }
    );
  }

  const user = await prisma.utilisateur.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  await prisma.journalAudit.deleteMany({ where: { utilisateurId: userId } });
  await prisma.rapport.deleteMany({ where: { auteurId: userId } });
  await prisma.utilisateur.delete({ where: { id: userId } });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "UTILISATEUR_SUPPRIME",
    cible: user.identifiant,
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
