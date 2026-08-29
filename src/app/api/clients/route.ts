import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { ROLES } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { decryptClientRecord, encryptClientData, normalizePersonName, normalizePhoneDigits, searchHash } from "@/lib/clients";
import { clientSchema } from "@/lib/client-schema";
import { createClientVehicules } from "@/lib/client-vehicules";
import { formatClientVehiculesSummary } from "@/lib/vehicules";

const clientInclude = {
  _count: { select: { ventes: true, vehicules: { where: { actif: true } } } },
  vehicules: { where: { actif: true }, orderBy: { creeLe: "asc" as const } },
  createur: { select: { identifiant: true, nom: true } },
};

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(ROLES.CLIENTS);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;
  const actifOnly = searchParams.get("actif") !== "false";
  const typeClient = searchParams.get("typeClient")?.trim();
  const fneStatut = searchParams.get("fneStatut")?.trim();

  const where: Record<string, unknown> = actifOnly ? { actif: true } : {};
  if (typeClient) where.typeClient = typeClient;
  if (fneStatut) where.fneStatut = fneStatut;

  if (q) {
    const nomNorm = normalizePersonName(q);
    const telNorm = normalizePhoneDigits(q);
    where.OR = [
      ...(nomNorm ? [{ nomHash: searchHash(nomNorm) }] : []),
      ...(nomNorm.length >= 3 ? [{ nomPrefixHash: searchHash(nomNorm.slice(0, 3)) }] : []),
      ...(telNorm ? [{ telephoneHash: searchHash(telNorm) }] : []),
      { ncc: { contains: q } },
      { vehicules: { some: { OR: [
        { immatriculation: { contains: q } },
        { marqueVehicule: { contains: q } },
      ] } } },
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: clientInclude,
      orderBy: { creeLe: "desc" },
      skip,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  const filtered = clients.map((c) => {
    const decrypted = decryptClientRecord(c);
    return {
      ...decrypted,
      vehicules: c.vehicules,
      vehiculesSummary: formatClientVehiculesSummary(c.vehicules),
      _count: c._count,
    };
  });

  return NextResponse.json({
    clients: filtered,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.CLIENTS);
  if (error) return error;

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
    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          ...encryptClientData(clientData),
          createurId: Number(session!.user.id),
        },
      });

      for (const v of vehicules) {
        await tx.vehicule.create({
          data: {
            clientId: created.id,
            immatriculation: v.immatriculation.toUpperCase().replace(/\s/g, ""),
            marqueVehicule: v.marqueVehicule?.trim() || null,
            modeleVehicule: v.modeleVehicule?.trim() || null,
          },
        });
      }

      return tx.client.findUnique({
        where: { id: created.id },
        include: { vehicules: { where: { actif: true } } },
      });
    });

    await logAudit({
      utilisateurId: Number(session!.user.id),
      action: "CLIENT_CREE",
      cible: String(client!.id),
      details: JSON.stringify({ vehicules: vehicules.map((v) => v.immatriculation) }),
      adresseIp: getClientIp(request),
    });

    return NextResponse.json(
      { client: { ...decryptClientRecord(client!), vehicules: client!.vehicules } },
      { status: 201 }
    );
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Immatriculation déjà enregistrée" }, { status: 409 });
    }
    throw e;
  }
}
