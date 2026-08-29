import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, getClientIp } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { notifySale } from "@/lib/notify";
import { decryptClientRecord, normalizePersonName, normalizePhoneDigits, searchHash } from "@/lib/clients";
import { figerTarifVente } from "@/lib/tarif";
import { ROLES } from "@/lib/roles";
import { parseListParams, paginationMeta, dateRange } from "@/lib/pagination";
import { getMetierSettings } from "@/lib/metier";
import { figerValiditeVente } from "@/lib/validite";
import { creerFacturePourVente } from "@/lib/crm";
import { findOrCreateVehiculeForClient } from "@/lib/client-vehicules";
import { isValidCiImmatriculation } from "@/lib/clients";
import { autoriserVenteInterne } from "@/lib/vente-regles";
import { resoudreCentreSaisi } from "@/lib/centres";

const venteSchema = z
  .object({
    numeroSerie: z.string().min(5, "Numéro de série requis"),
    clientId: z.number().int().positive("Client requis"),
    vehiculeId: z.number().int().positive().optional(),
    immatriculation: z.string().optional(),
    marqueVehicule: z.string().optional(),
    modeleVehicule: z.string().optional(),
    centreId: z.number().int().positive().optional().nullable(),
    canal: z.enum(["COMMERCIAL", "DIRECTE"]).optional(),
    modePaiement: z.enum(["ESPECES", "VIREMENT", "CHEQUE", "MOBILE_MONEY", "AUTRE"]).optional(),
    encaisse: z.boolean().optional(),
  })
  .refine(
    (d) => !d.immatriculation || isValidCiImmatriculation(d.immatriculation),
    { message: "Format immatriculation CI invalide (ex: AB-123-CD)" }
  );

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.VENTES);
  if (error) return error;

  const parsed = venteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const { numeroSerie, clientId, centreId } = parsed.data;
  const userId = Number(session!.user.id);
  const role = session!.user.role;
  const canal = role === "COMMERCIAL" ? "COMMERCIAL" : parsed.data.canal ?? "DIRECTE";

  const vendeur = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { centreControleId: true },
  });
  const centreResolu = await resoudreCentreSaisi({
    saisi: centreId,
    role,
    rattacheId: vendeur?.centreControleId,
    obligatoire: role === "COMMERCIAL",
  });
  if (centreResolu.error) {
    return NextResponse.json({ error: centreResolu.error }, { status: centreResolu.status ?? 400 });
  }
  const resolvedCentreId = centreResolu.centreId;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{
        id: number;
        statut: string;
        commercial_id: number | null;
        prix_reference: number;
        produit_id: number;
      }>>`
        SELECT id, statut, commercial_id, prix_reference, produit_id
        FROM plaques
        WHERE numero_serie = ${numeroSerie}
        FOR UPDATE
      `;
      const row = locked[0];
      if (!row) {
        throw Object.assign(new Error("Plaque introuvable"), { status: 404 });
      }

      const [client, centre, produit] = await Promise.all([
        tx.client.findUnique({ where: { id: clientId, actif: true } }),
        resolvedCentreId
          ? tx.centreControle.findFirst({ where: { id: resolvedCentreId, actif: true } })
          : Promise.resolve(null),
        tx.produit.findUnique({ where: { id: row.produit_id }, select: { prixHt: true, commissionTaux: true } }),
      ]);

      if (!client) {
        throw Object.assign(new Error("Client introuvable"), { status: 404 });
      }
      if (resolvedCentreId && !centre) {
        throw Object.assign(new Error("Centre de contrôle introuvable ou inactif"), { status: 404 });
      }
      const decision = autoriserVenteInterne({
        role,
        canal,
        plaqueStatut: row.statut,
        plaqueCommercialId: row.commercial_id,
        userId,
      });
      if (!decision.ok) {
        throw Object.assign(new Error(decision.error), { status: decision.status });
      }
      const venteDirecte = canal === "DIRECTE";

      let vehiculeId: number | null = null;
      if (parsed.data.vehiculeId) {
        const vehicule = await tx.vehicule.findFirst({
          where: { id: parsed.data.vehiculeId, clientId: client.id, actif: true },
        });
        if (!vehicule) {
          throw Object.assign(new Error("Véhicule introuvable pour ce client"), { status: 404 });
        }
        vehiculeId = vehicule.id;
      } else if (parsed.data.immatriculation?.trim()) {
        const created = await findOrCreateVehiculeForClient(tx, client.id, {
          immatriculation: parsed.data.immatriculation,
          marqueVehicule: parsed.data.marqueVehicule,
          modeleVehicule: parsed.data.modeleVehicule,
        });
        vehiculeId = created.id;
      }

      const avecCommission = !venteDirecte && (role === "COMMERCIAL" || Boolean(row.commercial_id));
      const tarif = figerTarifVente({
        prixCatalogue: produit?.prixHt ?? 0,
        prixReference: row.prix_reference,
        commissionTauxCatalogue: produit?.commissionTaux ?? 10,
        avecCommission,
      });
      const { prixVente, commissionTaux, commissionMontant } = tarif;
      const commissionnaireId = venteDirecte
        ? userId
        : role === "COMMERCIAL"
          ? userId
          : row.commercial_id ?? userId;

      const settings = await getMetierSettings();
      const dateAchat = new Date();
      const validite = figerValiditeVente(
        dateAchat,
        settings.plaqueValiditeMois,
        settings.plaqueAlerteExpirationJours
      );

      const updated = await tx.plaque.updateMany({
        where: { id: row.id, statut: { in: ["EN_STOCK", "AFFECTEE"] } },
        data: { statut: "VENDUE", commercialId: null, affecteeLe: null },
      });
      if (updated.count !== 1) {
        throw Object.assign(new Error("Cette plaque est déjà vendue"), { status: 409 });
      }

      const vente = await tx.vente.create({
        data: {
          plaqueId: row.id,
          clientId: client.id,
          vehiculeId,
          vendeurId: commissionnaireId,
          centreId: centre?.id ?? null,
          canal,
          prixVente,
          commissionTaux,
          commissionMontant,
          dateVente: dateAchat,
          validiteMois: validite.validiteMois,
          dateExpiration: validite.dateExpiration,
          alerteExpirationJours: validite.alerteExpirationJours,
          dateAlerte: validite.dateAlerte,
        },
        include: {
          client: true,
          vehicule: { select: { immatriculation: true } },
          plaque: {
            select: {
              numeroSerie: true,
              typeProduit: true,
              produit: { select: { libelle: true, code: true } },
            },
          },
          centre: { select: { libelle: true } },
        },
      });

      if (prixVente > 0) {
        await creerFacturePourVente(tx, {
          clientId: client.id,
          venteId: vente.id,
          montantHt: prixVente,
          createurId: userId,
          description: `Vente plaque ${numeroSerie}`,
          encaisse: parsed.data.encaisse !== false,
          modePaiement: parsed.data.modePaiement ?? "ESPECES",
        });
      }

      return vente;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });

    const clientDecrypted = decryptClientRecord(result.client);

    await notifySale({
      numeroSerie,
      nomClient: clientDecrypted.nom,
      dateVente: result.dateVente,
      venteId: result.id,
    });

    await logAudit({
      utilisateurId: userId,
      action: "VENTE_ENREGISTREE",
      cible: numeroSerie,
      details: JSON.stringify({
        clientId,
        clientNom: clientDecrypted.nom,
        prixVente: result.prixVente,
        commissionTaux: result.commissionTaux,
        commissionMontant: result.commissionMontant,
        canal,
        centreId: result.centre?.libelle ? resolvedCentreId : null,
      }),
      adresseIp: getClientIp(request),
    });

    return NextResponse.json(
      {
        vente: {
          id: result.id,
          dateVente: result.dateVente,
          prixVente: result.prixVente,
          commissionMontant: result.commissionMontant,
          canal: result.canal,
          plaque: result.plaque,
          vehicule: result.vehicule,
          client: clientDecrypted,
          centre: result.centre,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      (err as Error).message === "IMMAT_OTHER_CLIENT"
        ? "Cette immatriculation appartient à un autre client"
        : err instanceof Error
          ? err.message
          : "Erreur de vente";
    const status = (err as { status?: number }).status ?? 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth(ROLES.VENTES);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip, q } = parseListParams(searchParams, 20);
  const role = session!.user.role;
  const userId = Number(session!.user.id);
  const centreId = Number(searchParams.get("centreId") ?? 0);
  const canalFiltre = searchParams.get("canal")?.trim();
  const range = dateRange(searchParams.get("from"), searchParams.get("to"));

  const where: Record<string, unknown> = role === "COMMERCIAL" ? { vendeurId: userId } : {};
  if (centreId > 0) where.centreId = centreId;
  if (canalFiltre === "COMMERCIAL" || canalFiltre === "DIRECTE") where.canal = canalFiltre;
  if (range) where.dateVente = range;
  if (q) {
    const nomNorm = normalizePersonName(q);
    const telNorm = normalizePhoneDigits(q);
    where.OR = [
      { plaque: { numeroSerie: { contains: q } } },
      { vendeur: { identifiant: { contains: q } } },
      { vendeur: { nom: { contains: q } } },
      { vendeur: { prenom: { contains: q } } },
      { centre: { libelle: { contains: q } } },
      { vehicule: { immatriculation: { contains: q } } },
      ...(nomNorm ? [{ client: { nomHash: searchHash(nomNorm) } }] : []),
      ...(nomNorm.length >= 3 ? [{ client: { nomPrefixHash: searchHash(nomNorm.slice(0, 3)) } }] : []),
      ...(telNorm ? [{ client: { telephoneHash: searchHash(telNorm) } }] : []),
    ];
  }

  const include = {
    plaque: {
      select: {
        numeroSerie: true,
        typeProduit: true,
        produit: { select: { libelle: true, code: true } },
      },
    },
    client: true,
    vehicule: { select: { immatriculation: true } },
    vendeur: { select: { identifiant: true, nom: true, prenom: true, codeCommercial: true } },
    centre: { select: { libelle: true, ville: true } },
  };

  const [ventes, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      include,
      orderBy: { dateVente: "desc" },
      skip,
      take: limit,
    }),
    prisma.vente.count({ where }),
  ]);

  return NextResponse.json({
    ventes: ventes.map((v) => ({
      ...v,
      client: decryptClientRecord(v.client),
    })),
    pagination: paginationMeta(page, limit, total),
  });
}
