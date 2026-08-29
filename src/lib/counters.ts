import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient;

async function lastInsertId(tx: Tx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT LAST_INSERT_ID() AS id`;
  return Number(rows[0]?.id ?? 0);
}

/** Incrément atomique du compteur de série (sûr avec le pool de connexions Prisma). */
export async function nextSerieCounter(siteCode: string, datePrefix: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO compteurs_serie (site_code, date_prefix, dernier_num, mis_a_jour_le)
      VALUES (${siteCode}, ${datePrefix}, LAST_INSERT_ID(1), NOW(3))
      ON DUPLICATE KEY UPDATE
        dernier_num = LAST_INSERT_ID(dernier_num + 1),
        mis_a_jour_le = NOW(3)
    `;
    return lastInsertId(tx);
  });
}

/** Incrément atomique FAC / REC / COM. */
export async function nextDocumentCounter(type: string, annee: number, tx?: Tx): Promise<number> {
  const run = async (client: Tx) => {
    await client.$executeRaw`
      INSERT INTO compteurs_document (type, annee, dernier_num, mis_a_jour_le)
      VALUES (${type}, ${annee}, LAST_INSERT_ID(1), NOW(3))
      ON DUPLICATE KEY UPDATE
        dernier_num = LAST_INSERT_ID(dernier_num + 1),
        mis_a_jour_le = NOW(3)
    `;
    return lastInsertId(client);
  };
  if (tx) return run(tx);
  return prisma.$transaction(run);
}
