import { Prisma } from "@prisma/client";
import { prisma } from "./db";

function n(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (value == null) return 0;
  return Number(value);
}

type TotauxVenteRow = {
  id: number;
  identifiant: string;
  nom: string | null;
  quantite: unknown;
  chiffreAffaires: unknown;
  commission: unknown;
  commissionDue: unknown;
  commissionPayee: unknown;
};

type ProduitVenteRow = {
  id: number;
  pKey: string;
  libelle: string;
  quantite: unknown;
  ca: unknown;
  commission: unknown;
};

type TotauxCtRow = {
  id: number;
  identifiant: string;
  nom: string | null;
  controles: unknown;
  commission: unknown;
  commissionDue: unknown;
  commissionPayee: unknown;
};

type ProduitCtRow = {
  id: number;
  pKey: string;
  libelle: string;
  controles: unknown;
  commission: unknown;
};

export async function agregatsCommissionsVente(params: {
  vendeurId?: number;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.Sql[] = [Prisma.sql`v.canal = 'COMMERCIAL'`];
  if (params.vendeurId) where.push(Prisma.sql`v.vendeur_id = ${params.vendeurId}`);
  if (params.from) where.push(Prisma.sql`v.date_vente >= ${params.from}`);
  if (params.to) where.push(Prisma.sql`v.date_vente <= ${params.to}`);
  const clause = Prisma.join(where, " AND ");

  const [totaux, produits] = await Promise.all([
    prisma.$queryRaw<TotauxVenteRow[]>`
      SELECT
        COALESCE(v.vendeur_id, 0) AS id,
        COALESCE(u.identifiant, 'Sans vendeur') AS identifiant,
        u.nom AS nom,
        COUNT(*) AS quantite,
        COALESCE(SUM(v.prix_vente), 0) AS chiffreAffaires,
        COALESCE(SUM(v.commission_montant), 0) AS commission,
        COALESCE(SUM(CASE WHEN v.paiement_commission_id IS NULL THEN v.commission_montant ELSE 0 END), 0) AS commissionDue,
        COALESCE(SUM(CASE WHEN v.paiement_commission_id IS NOT NULL THEN v.commission_montant ELSE 0 END), 0) AS commissionPayee
      FROM ventes v
      LEFT JOIN utilisateurs u ON u.id = v.vendeur_id
      WHERE ${clause}
      GROUP BY COALESCE(v.vendeur_id, 0), u.identifiant, u.nom
    `,
    prisma.$queryRaw<ProduitVenteRow[]>`
      SELECT
        COALESCE(v.vendeur_id, 0) AS id,
        COALESCE(pr.code, p.type_produit) AS pKey,
        COALESCE(pr.libelle, p.type_produit) AS libelle,
        COUNT(*) AS quantite,
        COALESCE(SUM(v.prix_vente), 0) AS ca,
        COALESCE(SUM(v.commission_montant), 0) AS commission
      FROM ventes v
      INNER JOIN plaques p ON p.id = v.plaque_id
      LEFT JOIN produits pr ON pr.id = p.produit_id
      WHERE ${clause}
      GROUP BY COALESCE(v.vendeur_id, 0), COALESCE(pr.code, p.type_produit), COALESCE(pr.libelle, p.type_produit)
    `,
  ]);

  const parProduit = new Map<number, Array<{ libelle: string; quantite: number; ca: number; commission: number }>>();
  for (const row of produits) {
    const list = parProduit.get(row.id) ?? [];
    list.push({
      libelle: row.libelle,
      quantite: n(row.quantite),
      ca: n(row.ca),
      commission: n(row.commission),
    });
    parProduit.set(row.id, list);
  }

  const acteurs = totaux
    .map((a) => {
      const chiffreAffaires = n(a.chiffreAffaires);
      const commission = n(a.commission);
      return {
        id: a.id,
        identifiant: a.identifiant,
        nom: a.nom,
        quantite: n(a.quantite),
        chiffreAffaires,
        commission,
        commissionDue: n(a.commissionDue),
        commissionPayee: n(a.commissionPayee),
        partEntreprise: chiffreAffaires - commission,
        parProduit: parProduit.get(a.id) ?? [],
      };
    })
    .sort((a, b) => b.commission - a.commission);

  const totauxGlobaux = acteurs.reduce(
    (acc, a) => ({
      quantite: acc.quantite + a.quantite,
      chiffreAffaires: acc.chiffreAffaires + a.chiffreAffaires,
      commission: acc.commission + a.commission,
      commissionDue: acc.commissionDue + a.commissionDue,
      commissionPayee: acc.commissionPayee + a.commissionPayee,
      partEntreprise: acc.partEntreprise + a.partEntreprise,
    }),
    { quantite: 0, chiffreAffaires: 0, commission: 0, commissionDue: 0, commissionPayee: 0, partEntreprise: 0 }
  );

  return { totaux: totauxGlobaux, acteurs, nombreVentes: totauxGlobaux.quantite };
}

export async function agregatsCommissionsControle(params: {
  agentId?: number;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.Sql[] = [
    Prisma.sql`v.resultat = 'AUTHENTIQUE'`,
    Prisma.sql`v.commission_montant > 0`,
  ];
  if (params.agentId) where.push(Prisma.sql`v.agent_id = ${params.agentId}`);
  if (params.from) where.push(Prisma.sql`v.horodatage >= ${params.from}`);
  if (params.to) where.push(Prisma.sql`v.horodatage <= ${params.to}`);
  const clause = Prisma.join(where, " AND ");

  const [totaux, produits] = await Promise.all([
    prisma.$queryRaw<TotauxCtRow[]>`
      SELECT
        v.agent_id AS id,
        u.identifiant AS identifiant,
        COALESCE(u.nom, u.prenom) AS nom,
        COUNT(*) AS controles,
        COALESCE(SUM(v.commission_montant), 0) AS commission,
        COALESCE(SUM(CASE WHEN v.paiement_commission_id IS NULL THEN v.commission_montant ELSE 0 END), 0) AS commissionDue,
        COALESCE(SUM(CASE WHEN v.paiement_commission_id IS NOT NULL THEN v.commission_montant ELSE 0 END), 0) AS commissionPayee
      FROM verifications v
      INNER JOIN utilisateurs u ON u.id = v.agent_id
      WHERE ${clause}
      GROUP BY v.agent_id, u.identifiant, u.nom, u.prenom
    `,
    prisma.$queryRaw<ProduitCtRow[]>`
      SELECT
        v.agent_id AS id,
        COALESCE(pr.code, 'AUTRE') AS pKey,
        COALESCE(pr.libelle, 'Contrôle authentique') AS libelle,
        COUNT(*) AS controles,
        COALESCE(SUM(v.commission_montant), 0) AS commission
      FROM verifications v
      LEFT JOIN plaques p ON p.id = v.plaque_id
      LEFT JOIN produits pr ON pr.id = p.produit_id
      WHERE ${clause}
      GROUP BY v.agent_id, COALESCE(pr.code, 'AUTRE'), COALESCE(pr.libelle, 'Contrôle authentique')
    `,
  ]);

  const parProduit = new Map<number, Array<{ libelle: string; controles: number; commission: number }>>();
  for (const row of produits) {
    const list = parProduit.get(row.id) ?? [];
    list.push({
      libelle: row.libelle,
      controles: n(row.controles),
      commission: n(row.commission),
    });
    parProduit.set(row.id, list);
  }

  const acteurs = totaux
    .map((a) => ({
      id: a.id,
      identifiant: a.identifiant,
      nom: a.nom,
      controles: n(a.controles),
      commission: n(a.commission),
      commissionDue: n(a.commissionDue),
      commissionPayee: n(a.commissionPayee),
      parProduit: parProduit.get(a.id) ?? [],
    }))
    .sort((a, b) => b.commissionDue - a.commissionDue || b.commission - a.commission);

  const totauxGlobaux = acteurs.reduce(
    (acc, a) => ({
      controles: acc.controles + a.controles,
      commission: acc.commission + a.commission,
      commissionDue: acc.commissionDue + a.commissionDue,
      commissionPayee: acc.commissionPayee + a.commissionPayee,
    }),
    { controles: 0, commission: 0, commissionDue: 0, commissionPayee: 0 }
  );

  return { totaux: totauxGlobaux, acteurs, nombreControles: totauxGlobaux.controles };
}
