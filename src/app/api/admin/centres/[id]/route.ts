import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { ROLES } from "@/lib/roles";

const patchSchema = z.object({
  libelle: z.string().min(3).max(200).optional(),
  pays: z.string().max(100).optional(),
  ville: z.string().max(100).optional().nullable(),
  commune: z.string().max(100).optional().nullable(),
  quartier: z.string().max(100).optional().nullable(),
  adresse: z.string().max(255).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  actif: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(ROLES.ADMIN);
  if (error) return error;

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Données invalides" }, { status: 400 });
  }

  const centre = await prisma.centreControle.update({
    where: { id },
    data: parsed.data,
  });

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "CENTRE_CT_MODIFIE",
    cible: centre.code,
    details: JSON.stringify(parsed.data),
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ centre });
}
