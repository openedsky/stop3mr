import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const { error } = await requireAuth(ROLES.PRODUCTION);
  if (error) return error;

  const { numero } = await params;
  const plaque = await prisma.plaque.findUnique({
    where: { numeroSerie: decodeURIComponent(numero) },
    select: { tokenEnregistrement: true, statut: true },
  });
  if (!plaque?.tokenEnregistrement) {
    return NextResponse.json({ error: "Jeton introuvable" }, { status: 404 });
  }
  if (plaque.statut === "VENDUE") {
    return NextResponse.json({ error: "Cette plaque est déjà vendue" }, { status: 409 });
  }
  return NextResponse.json({ token: plaque.tokenEnregistrement });
}
