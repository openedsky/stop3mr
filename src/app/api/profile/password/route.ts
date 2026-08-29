import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { isStrongPassword } from "@/lib/security";
import { rateLimitPersistent, rateLimitResponse } from "@/lib/rate-limit";
const schema = z.object({
  actuel: z.string().min(1, "Mot de passe actuel requis"),
  nouveau: z.string().min(1, "Nouveau mot de passe requis"),
  confirmation: z.string().min(1, "Confirmation requise"),
});

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ALL);
  if (error) return error;

  const rl = await rateLimitPersistent(`pwd-change:${session!.user.id}`, 5, 15 * 60 * 1000);
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const { actuel, nouveau, confirmation } = parsed.data;
  if (nouveau !== confirmation) {
    return NextResponse.json({ error: "La confirmation ne correspond pas au nouveau mot de passe" }, { status: 400 });
  }
  if (nouveau === actuel) {
    return NextResponse.json({ error: "Le nouveau mot de passe doit être différent de l'actuel" }, { status: 400 });
  }
  if (!isStrongPassword(nouveau)) {
    return NextResponse.json(
      {
        error:
          "Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule et un chiffre",
      },
      { status: 400 }
    );
  }

  const user = await prisma.utilisateur.findUnique({
    where: { id: Number(session!.user.id) },
  });
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const ok = await bcrypt.compare(actuel, user.motDePasseHash);
  if (!ok) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
  }

  await prisma.utilisateur.update({
    where: { id: user.id },
    data: { motDePasseHash: await bcrypt.hash(nouveau, 12) },
  });

  await logAudit({
    utilisateurId: user.id,
    action: "MOT_DE_PASSE_MODIFIE",
    cible: user.identifiant,
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}
