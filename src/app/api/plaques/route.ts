import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { generateNumeroSerie } from "@/lib/serial";
import { buildVerifyUrl, generateQrCodeDataUrl } from "@/lib/qr";
import { logAudit } from "@/lib/audit";
import { decrypt } from "@/lib/encryption";
import { familleToTypeProduit, ROLES } from "@/lib/roles";
import { getUniqueProductionSite } from "@/lib/production-site";
import { wherePlaquesListe } from "@/lib/plaque-scope";
import { sansTokenEnregistrement, sansTokensEnregistrement } from "@/lib/plaque-dto";

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth([...ROLES.PRODUCTION, "COMMERCIAL"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const statut = searchParams.get("statut");
  const produitId = Number(searchParams.get("produitId") ?? 0);
  const siteProduction = searchParams.get("site")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;
  const role = session!.user.role;
  const userId = Number(session!.user.id);

  const where = wherePlaquesListe({
    role,
    userId,
    statut,
    q,
    produitId,
    siteProduction,
  });

  const [plaques, total] = await Promise.all([
    prisma.plaque.findMany({
      where,
      omit: { tokenEnregistrement: true },
      include: {
        produit: { select: { id: true, code: true, libelle: true, prixHt: true, commissionTaux: true } },
        vente: {
          include: {
            client: { select: { id: true, nom: true } },
            vehicule: { select: { immatriculation: true, marqueVehicule: true, modeleVehicule: true } },
          },
        },
        verifications: {
          orderBy: { horodatage: "desc" as const },
          take: 1,
          select: { horodatage: true, resultat: true },
        },
        createur: { select: { identifiant: true, nom: true } },
        commercial: { select: { identifiant: true, nom: true } },
      },
      orderBy: { dateFabrication: "desc" },
      skip,
      take: limit,
    }),
    prisma.plaque.count({ where }),
  ]);

  const mapped = sansTokensEnregistrement(plaques).map((p) => ({
    ...p,
    vente: p.vente
      ? {
          ...p.vente,
          client: p.vente.client
            ? {
                ...p.vente.client,
                nom: decrypt(p.vente.client.nom),
              }
            : null,
        }
      : null,
  }));

  return NextResponse.json({
    plaques: mapped,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    role,
  });
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.PRODUCTION);
  if (error) return error;

  const body = await request.json();
  const produitId = Number(body.produitId);
  const vitesseLimitation = body.vitesseLimitation ? Number(body.vitesseLimitation) : null;
  const quantite = Math.min(50, Math.max(1, Number(body.quantite ?? 1)));

  if (!produitId) {
    return NextResponse.json({ error: "Produit du catalogue requis" }, { status: 400 });
  }

  const produit = await prisma.produit.findFirst({
    where: { id: produitId, actif: true },
  });
  if (!produit) {
    return NextResponse.json({ error: "Produit introuvable ou inactif" }, { status: 400 });
  }

  if (produit.vitessesDisponibles) {
    const allowed = produit.vitessesDisponibles.split(",").map((v) => Number(v.trim()));
    if (!vitesseLimitation || !allowed.includes(vitesseLimitation)) {
      return NextResponse.json({ error: "Vitesse de limitation requise pour ce produit" }, { status: 400 });
    }
  }

  const site = await getUniqueProductionSite();
  if (!site) {
    return NextResponse.json({ error: "Aucun site de production actif. Un administrateur doit le configurer." }, { status: 400 });
  }
  const siteProduction = site.code;

  const typeProduit = familleToTypeProduit(produit.famille);
  const pending: Array<{
    numeroSerie: string;
    tokenEnregistrement: string;
    verifyUrl: string;
  }> = [];

  for (let i = 0; i < quantite; i++) {
    const numeroSerie = await generateNumeroSerie(siteProduction);
    pending.push({
      numeroSerie,
      tokenEnregistrement: randomBytes(32).toString("hex"),
      verifyUrl: await buildVerifyUrl(numeroSerie),
    });
  }

  const plaques = await prisma.$transaction(
    pending.map((item) =>
      prisma.plaque.create({
        data: {
          numeroSerie: item.numeroSerie,
          qrCodeData: "",
          tokenEnregistrement: item.tokenEnregistrement,
          typeProduit,
          produitId: produit.id,
          vitesseLimitation: produit.vitessesDisponibles ? vitesseLimitation : null,
          siteProduction,
          prixReference: produit.prixHt,
          createurId: Number(session!.user.id),
        },
      })
    )
  );

  const lastIndex = plaques.length - 1;
  const lastQr = lastIndex >= 0 ? await generateQrCodeDataUrl(pending[lastIndex].verifyUrl) : "";

  const created = plaques.map((plaque, i) => ({
    plaque: { ...sansTokenEnregistrement(plaque), qrCodeData: i === lastIndex ? lastQr : "" },
    verifyUrl: pending[i].verifyUrl,
    registerUrl: `${process.env.APP_PUBLIC_URL ?? "http://localhost:3000"}/register/${encodeURIComponent(pending[i].numeroSerie)}`,
  }));

  await logAudit({
    utilisateurId: Number(session!.user.id),
    action: "PLAQUE_CREEE",
    cible: created.map((c) => c.plaque.numeroSerie).join(", "),
    details: JSON.stringify({
      produit: produit.code,
      siteProduction,
      quantite,
      vitesseLimitation,
    }),
    adresseIp: getClientIp(request),
  });

  const last = created[created.length - 1];
  return NextResponse.json({
    plaque: last.plaque,
    verifyUrl: last.verifyUrl,
    registerUrl: last.registerUrl,
    quantite: created.length,
    series: created.map((c) => c.plaque.numeroSerie),
  }, { status: 201 });
}
