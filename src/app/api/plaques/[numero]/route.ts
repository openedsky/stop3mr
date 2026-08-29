import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { decryptClientRecord } from "@/lib/clients";
import { sansTokenEnregistrement } from "@/lib/plaque-dto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const { error, session } = await requireAuth([...ROLES.PRODUCTION, "COMMERCIAL"]);
  if (error) return error;

  const { numero } = await params;
  const decoded = decodeURIComponent(numero);
  const role = session!.user.role;
  const userId = Number(session!.user.id);

  const plaque = await prisma.plaque.findUnique({
    where: { numeroSerie: decoded },
    omit: { tokenEnregistrement: true },
    include: {
      vente: {
        include: {
          client: true,
          vendeur: { select: { identifiant: true, nom: true } },
        },
      },
      createur: { select: { identifiant: true, nom: true } },
    },
  });

  if (!plaque) {
    return NextResponse.json({ error: "Plaque introuvable" }, { status: 404 });
  }

  if (role === "COMMERCIAL") {
    if (plaque.commercialId !== userId && plaque.vente?.vendeurId !== userId) {
      return NextResponse.json({ error: "Plaque introuvable" }, { status: 404 });
    }
  }

  return NextResponse.json({
    ...sansTokenEnregistrement(plaque),
    vente: plaque.vente
      ? {
          ...plaque.vente,
          client: decryptClientRecord(plaque.vente.client),
        }
      : null,
  });
}
