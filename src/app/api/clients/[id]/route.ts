import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { decryptClientRecord, encryptClientData } from "@/lib/clients";
import { clientSchema } from "@/lib/client-schema";
import { syncClientVehicules } from "@/lib/client-vehicules";

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

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      vehicules: { where: { actif: true }, orderBy: { creeLe: "asc" } },
      ventes: {
        include: {
          plaque: { select: { numeroSerie: true, typeProduit: true, statut: true } },
          vehicule: { select: { immatriculation: true, marqueVehicule: true, modeleVehicule: true } },
        },
        orderBy: { dateVente: "desc" },
        take: 200,
      },
      createur: { select: { identifiant: true, nom: true } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    client: {
      ...decryptClientRecord(client),
      vehicules: client.vehicules,
      ventes: client.ventes,
    },
  });
}

export async function PUT(
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

  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const { vehicules, ...clientData } = parsed.data;

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: encryptClientData(clientData),
    });

    await syncClientVehicules(clientId, vehicules);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { vehicules: { where: { actif: true }, orderBy: { creeLe: "asc" } } },
    });

    await logAudit({
      utilisateurId: Number(session!.user.id),
      action: "CLIENT_MODIFIE",
      cible: String(clientId),
      details: JSON.stringify({ vehicules: vehicules.length }),
      adresseIp: getClientIp(request),
    });

    return NextResponse.json({
      client: { ...decryptClientRecord(client!), vehicules: client!.vehicules },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Immatriculation déjà utilisée par un autre client" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["ADMINISTRATEUR"]);
  if (error) return error;

  const { id } = await params;
  const clientId = Number(id);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    include: { _count: { select: { ventes: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  if (existing._count.ventes > 0) {
    await prisma.client.update({
      where: { id: clientId },
      data: { actif: false },
    });
  } else {
    await prisma.client.delete({ where: { id: clientId } });
  }

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "CLIENT_SUPPRIME",
    cible: String(clientId),
    adresseIp: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}
