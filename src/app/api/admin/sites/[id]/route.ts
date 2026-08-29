import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  libelle: z.string().min(2).max(150).optional(),
  pays: z.string().max(100).optional(),
  ville: z.string().max(100).optional().nullable(),
  commune: z.string().max(100).optional().nullable(),
  quartier: z.string().max(100).optional().nullable(),
  adresse: z.string().max(255).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  actif: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(["ADMINISTRATEUR"]);
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  try {
    const site = await prisma.$transaction(async (tx) => {
      if (parsed.data.actif === false) {
        const others = await tx.siteProduction.count({
          where: { id: { not: Number(id) }, actif: true },
        });
        if (others === 0) {
          throw Object.assign(new Error("Impossible de désactiver le seul site de production actif"), { status: 409 });
        }
      }

      const updated = await tx.siteProduction.update({
        where: { id: Number(id) },
        data: parsed.data,
      });

      if (parsed.data.actif === true) {
        await tx.siteProduction.updateMany({
          where: { id: { not: updated.id } },
          data: { actif: false },
        });
      }

      return updated;
    });

    await logAudit({
      utilisateurId: Number(session!.user.id),
      action: "SITE_PRODUCTION_MODIFIE",
      cible: site.code,
      adresseIp: getClientIp(request),
    });

    return NextResponse.json({ site });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de mise à jour";
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: message }, { status });
  }
}
