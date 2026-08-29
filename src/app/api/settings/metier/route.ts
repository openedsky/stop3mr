import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { getMetierSettings, saveMetierSettings } from "@/lib/metier";
import { logAudit, serializeAuditDiff } from "@/lib/audit";

export async function GET() {
  const { error } = await requireAuth([...ROLES.ADMIN, ...ROLES.CT, ...ROLES.VENTES]);
  if (error) return error;
  return NextResponse.json({ settings: await getMetierSettings() });
}

const patchSchema = z.object({
  plaqueValiditeMois: z.number().int().min(1).max(120).optional(),
  plaqueAlerteExpirationJours: z.number().int().min(0).max(365).optional(),
  commissionTauxControleurDefaut: z.number().int().min(0).max(100).optional(),
  commissionTauxDefaut: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const avant = await getMetierSettings();
  const settings = await saveMetierSettings(parsed.data);
  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "PARAMETRES_METIER",
    cible: "validite-commissions",
    details: serializeAuditDiff({
      avant: { ...avant },
      apres: { ...settings },
      extra: {
        note: "Les ventes déjà enregistrées conservent leur date d'expiration figée. Seules les ventes futures utilisent la nouvelle durée. Les commissions déjà stockées ne sont pas recalculées.",
      },
    }),
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ settings });
}
