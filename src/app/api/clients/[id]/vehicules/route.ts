import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { vehiculeSchema } from "@/lib/client-schema";
import { mapVehiculeInput } from "@/lib/vehicules";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(ROLES.CLIENTS);
  if (error) return error;

  const { id } = await params;
  const clientId = Number(id);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const vehicules = await prisma.vehicule.findMany({
    where: { clientId, actif: true },
    orderBy: { creeLe: "asc" },
  });

  return NextResponse.json({ vehicules });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(ROLES.CLIENTS);
  if (error) return error;

  const { id } = await params;
  const clientId = Number(id);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId, actif: true } });
  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = vehiculeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  try {
    const vehicule = await prisma.vehicule.create({
      data: { ...mapVehiculeInput(parsed.data), clientId },
    });

    await logAudit({
      utilisateurId: Number(session!.user.id),
      action: "VEHICULE_AJOUTE",
      cible: vehicule.immatriculation,
      adresseIp: getClientIp(request),
    });

    return NextResponse.json({ vehicule }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Immatriculation déjà enregistrée" }, { status: 409 });
    }
    throw e;
  }
}
