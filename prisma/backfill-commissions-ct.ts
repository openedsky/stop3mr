import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const keys = [
    ["plaque_validite_mois", "24"],
    ["plaque_alerte_expiration_jours", "30"],
    ["commission_taux_controleur_defaut", "10"],
  ] as const;

  for (const [cle, valeur] of keys) {
    await prisma.parametre.upsert({
      where: { cle },
      update: {},
      create: { cle, valeur },
    });
  }

  const updated = await prisma.$executeRaw`
    UPDATE verifications v
    INNER JOIN plaques pl ON pl.id = v.plaque_id
    INNER JOIN ventes ve ON ve.plaque_id = pl.id
    INNER JOIN produits pr ON pr.id = pl.produit_id
    SET
      v.commission_taux = pr.commission_taux_controleur,
      v.commission_montant = ROUND(ve.prix_vente * pr.commission_taux_controleur / 100)
    WHERE v.resultat = 'AUTHENTIQUE'
      AND v.paiement_commission_id IS NULL
      AND v.commission_montant = 0
      AND ve.prix_vente > 0
  `;

  console.log(`Paramètres métier enregistrés. Contrôles authentiques rétroactivement commissionnés : ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
