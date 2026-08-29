import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifySale } from "@/lib/notify";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/api-auth";
import { decryptClientRecord, encryptClientData, sameClientIdentity } from "@/lib/clients";
import { registerSchema } from "@/lib/client-schema";
import { findOrCreateVehiculeForClient } from "@/lib/client-vehicules";
import { rateLimitPersistent } from "@/lib/rate-limit";
import { figerTarifVente } from "@/lib/tarif";
import { getMetierSettings } from "@/lib/metier";
import { figerValiditeVente } from "@/lib/validite";
import { creerFacturePourVente } from "@/lib/crm";
import { extractRegisterToken } from "@/lib/register-token";
import { timingSafeEqual } from "crypto";

function verifyToken(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const ip = getClientIp(request) ?? "unknown";
  const rl = await rateLimitPersistent(`register-post:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const { numero } = await params;
  const decoded = decodeURIComponent(numero);

  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const token = extractRegisterToken(request, parsed.data.token);
  const { token: _token, immatriculation, marqueVehicule, modeleVehicule, ...clientData } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; statut: string }>>`
        SELECT id, statut FROM plaques WHERE numero_serie = ${decoded} FOR UPDATE
      `;
      if (!locked[0]) throw new Error("NOT_FOUND");

      const plaque = await tx.plaque.findUnique({
        where: { id: locked[0].id },
        include: { vente: true, produit: { select: { prixHt: true, commissionTaux: true } } },
      });

      if (!plaque) throw new Error("NOT_FOUND");
      if (!plaque.tokenEnregistrement || !verifyToken(token, plaque.tokenEnregistrement)) {
        throw new Error("INVALID_TOKEN");
      }
      if (plaque.statut === "VENDUE" || plaque.vente) throw new Error("ALREADY_SOLD");

      const immatUpper = immatriculation.toUpperCase().replace(/\s/g, "");

      let vehicule = await tx.vehicule.findUnique({ where: { immatriculation: immatUpper } });
      let client;

      if (vehicule) {
        client = await tx.client.findUnique({ where: { id: vehicule.clientId, actif: true } });
        if (!client) throw new Error("CLIENT_INACTIF");
        const known = decryptClientRecord(client);
        if (!sameClientIdentity(known, { nom: clientData.nom, telephone: clientData.telephone })) {
          throw new Error("CLIENT_MISMATCH");
        }
      } else {
        client = await tx.client.create({
          data: encryptClientData(clientData),
        });
        vehicule = await findOrCreateVehiculeForClient(tx, client.id, {
          immatriculation,
          marqueVehicule,
          modeleVehicule,
        });
      }

      if (plaque.statut !== "EN_STOCK" && plaque.statut !== "AFFECTEE") {
        throw new Error("ALREADY_SOLD");
      }

      await tx.plaque.update({
        where: { id: plaque.id },
        data: { statut: "VENDUE", commercialId: null, affecteeLe: null },
      });

      const tarif = figerTarifVente({
        prixCatalogue: plaque.produit?.prixHt ?? 0,
        prixReference: plaque.prixReference,
        commissionTauxCatalogue: plaque.produit?.commissionTaux ?? 10,
        avecCommission: Boolean(plaque.commercialId),
      });
      const { prixVente, commissionTaux, commissionMontant } = tarif;
      const settings = await getMetierSettings();
      const dateAchat = new Date();
      const validite = figerValiditeVente(
        dateAchat,
        settings.plaqueValiditeMois,
        settings.plaqueAlerteExpirationJours
      );

      const vente = await tx.vente.create({
        data: {
          plaqueId: plaque.id,
          clientId: client!.id,
          vehiculeId: vehicule.id,
          vendeurId: plaque.commercialId,
          canal: plaque.commercialId ? "COMMERCIAL" : "DIRECTE",
          prixVente,
          commissionTaux,
          commissionMontant,
          dateVente: dateAchat,
          validiteMois: validite.validiteMois,
          dateExpiration: validite.dateExpiration,
          alerteExpirationJours: validite.alerteExpirationJours,
          dateAlerte: validite.dateAlerte,
        },
      });

      if (prixVente > 0) {
        await creerFacturePourVente(tx, {
          clientId: client!.id,
          venteId: vente.id,
          montantHt: prixVente,
          createurId: null,
          description: `Enregistrement public plaque ${plaque.numeroSerie}`,
          encaisse: true,
          modePaiement: "ESPECES",
        });
      }

      return { plaque, client: client!, vehicule, vente };
    });

    await notifySale({
      numeroSerie: result.plaque.numeroSerie,
      nomClient: clientData.nom,
      dateVente: result.vente.dateVente,
      venteId: result.vente.id,
    });

    await logAudit({
      action: "VENTE_ENREGISTREE",
      cible: result.plaque.numeroSerie,
      details: JSON.stringify({
        immatriculation: result.vehicule.immatriculation,
        source: "public",
      }),
      adresseIp: ip,
    });

    return NextResponse.json({
      success: true,
      numeroSerie: result.plaque.numeroSerie,
      dateVente: result.vente.dateVente,
      vehicule: result.vehicule.immatriculation,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "NOT_FOUND" || msg === "INVALID_TOKEN") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    if (msg === "ALREADY_SOLD") return NextResponse.json({ error: "Plaque déjà vendue" }, { status: 409 });
    if (msg === "IMMAT_OTHER_CLIENT") {
      return NextResponse.json({ error: "Cette immatriculation appartient à un autre client" }, { status: 409 });
    }
    if (msg === "CLIENT_MISMATCH") {
      return NextResponse.json(
        { error: "Cette immatriculation est déjà liée à un autre titulaire. Vérifiez le nom et le téléphone." },
        { status: 409 }
      );
    }
    console.error("Register error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const ip = getClientIp(request) ?? "unknown";
  const rl = await rateLimitPersistent(`register-get:${ip}`, 60, 15 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const { numero } = await params;
  const decoded = decodeURIComponent(numero);
  const token = extractRegisterToken(request);

  const plaque = await prisma.plaque.findUnique({
    where: { numeroSerie: decoded },
    select: {
      numeroSerie: true,
      typeProduit: true,
      dateFabrication: true,
      statut: true,
      siteProduction: true,
      tokenEnregistrement: true,
    },
  });

  if (!plaque) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  if (!token || !plaque.tokenEnregistrement || !verifyToken(token, plaque.tokenEnregistrement)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  return NextResponse.json({
    authentic: true,
    status: "Produit authentique Stop 3MR",
    plaque: {
      numeroSerie: plaque.numeroSerie,
      typeProduit: plaque.typeProduit,
      dateFabrication: plaque.dateFabrication,
      statut: plaque.statut,
      siteProduction: plaque.siteProduction,
    },
  });
}
