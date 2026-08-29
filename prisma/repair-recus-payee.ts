/**
 * Crée les reçus manquants pour les factures PAYEE (jeu volume).
 * Usage : npx tsx prisma/repair-recus-payee.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function backfillRecusPayee(db: Db) {
  const manquantes = await db.$queryRaw<
    Array<{
      id: number;
      client_id: number;
      montant_paye: number;
      date_emission: Date;
    }>
  >`
    SELECT f.id, f.client_id, f.montant_paye, f.date_emission
    FROM factures f
    LEFT JOIN recus_paiement r ON r.facture_id = f.id
    WHERE f.statut = 'PAYEE'
      AND f.montant_paye > 0
      AND r.id IS NULL
    ORDER BY f.id
  `;

  if (manquantes.length === 0) {
    return { created: 0 };
  }

  const annee = new Date().getFullYear();
  const run = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`
      INSERT INTO compteurs_document (type, annee, dernier_num, mis_a_jour_le)
      VALUES ('REC', ${annee}, LAST_INSERT_ID(${manquantes.length}), NOW(3))
      ON DUPLICATE KEY UPDATE
        dernier_num = LAST_INSERT_ID(dernier_num + ${manquantes.length}),
        mis_a_jour_le = NOW(3)
    `;
    const rows = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT LAST_INSERT_ID() AS id`;
    const last = Number(rows[0]?.id ?? 0);
    const first = last - manquantes.length + 1;

    const data = manquantes.map((f, i) => ({
      numero: `REC-${annee}-${String(first + i).padStart(5, "0")}`,
      factureId: f.id,
      clientId: f.client_id,
      montant: f.montant_paye,
      modePaiement: "ESPECES" as const,
      datePaiement: f.date_emission,
      reference: "BACKFILL-PAYEE",
      notes: "Reçu généré pour aligner les pièces sur le statut PAYEE",
    }));

    const BATCH = 400;
    for (let i = 0; i < data.length; i += BATCH) {
      await tx.recuPaiement.createMany({ data: data.slice(i, i + BATCH) });
    }
  };

  if ("$transaction" in db) {
    await db.$transaction(run);
  } else {
    await run(db);
  }

  return { created: manquantes.length };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { created } = await backfillRecusPayee(prisma);
    if (created === 0) {
      console.log("Aucun reçu à créer.");
      return;
    }
    const recus = await prisma.recuPaiement.aggregate({ _count: true, _sum: { montant: true } });
    const sansRecu = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n
      FROM factures f
      LEFT JOIN recus_paiement r ON r.facture_id = f.id
      WHERE f.statut = 'PAYEE' AND r.id IS NULL
    `;
    console.log(`Reçus créés : ${created}`);
    console.log(`Total reçus : ${recus._count} / ${recus._sum.montant ?? 0} F CFA`);
    console.log(`PAYEE sans reçu restante : ${Number(sansRecu[0]?.n ?? 0)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("repair-recus-payee")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
