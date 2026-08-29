/**
 * Backfill post-correctifs : alerte figée, unicité CT, hashes recherche,
 * commercial_id, factures volume encaissées.
 * Usage : npx tsx prisma/repair-audit-complet.ts
 */
import { PrismaClient } from "@prisma/client";
import { decryptClientRecord, clientSearchHashes } from "../src/lib/clients";
import { backfillRecusPayee } from "./repair-recus-payee";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`
    UPDATE ventes
    SET
      alerte_expiration_jours = COALESCE(NULLIF(alerte_expiration_jours, 0), 30),
      date_alerte = DATE_SUB(date_expiration, INTERVAL COALESCE(NULLIF(alerte_expiration_jours, 0), 30) DAY)
    WHERE date_expiration IS NOT NULL
      AND date_alerte IS NULL
  `;

  await prisma.$executeRaw`
    UPDATE verifications v
    INNER JOIN (
      SELECT plaque_id, MIN(id) AS keep_id
      FROM verifications
      WHERE resultat = 'AUTHENTIQUE'
        AND commission_montant > 0
        AND plaque_id IS NOT NULL
      GROUP BY plaque_id
    ) k ON k.keep_id = v.id
    SET v.commission_auth_plaque_id = v.plaque_id
    WHERE v.commission_auth_plaque_id IS NULL
  `;

  const cleared = await prisma.plaque.updateMany({
    where: { statut: "VENDUE", commercialId: { not: null } },
    data: { commercialId: null, affecteeLe: null },
  });

  const volumePayees = await prisma.$executeRaw`
    UPDATE factures f
    INNER JOIN ventes v ON v.id = f.vente_id
    INNER JOIN plaques p ON p.id = v.plaque_id
    SET f.statut = 'PAYEE', f.montant_paye = f.montant_ttc
    WHERE f.statut = 'EMISE'
      AND p.numero_serie LIKE 'R3M-YP-260820-%'
  `;
  const recusBackfill = await backfillRecusPayee(prisma);

  const clients = await prisma.client.findMany({
    where: { OR: [{ nomHash: null }, { telephoneHash: null }] },
  });
  let hashed = 0;
  for (const c of clients) {
    const d = decryptClientRecord(c);
    await prisma.client.update({
      where: { id: c.id },
      data: clientSearchHashes(d.nom, d.telephone),
    });
    hashed += 1;
  }

  const sansAlerte = await prisma.vente.count({ where: { dateAlerte: null } });
  const venduesComm = await prisma.plaque.count({ where: { statut: "VENDUE", commercialId: { not: null } } });
  const authUniq = await prisma.verification.count({ where: { commissionAuthPlaqueId: { not: null } } });
  const emises = await prisma.facture.groupBy({ by: ["statut"], _count: true, _sum: { montantTtc: true, montantPaye: true } });

  console.log("Réparation audit complet.");
  console.log(`  Ventes sans date_alerte : ${sansAlerte}`);
  console.log(`  commercial_id retiré des VENDUE : ${cleared.count} (reste ${venduesComm})`);
  console.log(`  Commissions AUTH uniques posées : ${authUniq}`);
  console.log(`  Factures volume encaissées (lignes) : ${volumePayees}`);
  console.log(`  Reçus PAYEE créés : ${recusBackfill.created}`);
  console.log(`  Hashes client : ${hashed}`);
  console.log("  Factures :", emises.map((s) => `${s.statut} ${s._count} ttc=${s._sum.montantTtc} paye=${s._sum.montantPaye}`).join(" | "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
