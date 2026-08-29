/**
 * Aligne chaque mot de passe sur l'identifiant du compte.
 * Usage : npx tsx prisma/sync-passwords.ts
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROUNDS = 12;

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
}

async function main() {
  const users = await prisma.utilisateur.findMany({
    select: {
      id: true,
      identifiant: true,
      role: true,
      centreControle: { select: { code: true, commune: true } },
    },
    orderBy: { identifiant: "asc" },
  });

  console.log(`Hachage de ${users.length} mots de passe (= identifiant)…`);
  let done = 0;
  await pool(users, 12, async (user) => {
    const motDePasseHash = await bcrypt.hash(user.identifiant, ROUNDS);
    await prisma.utilisateur.update({
      where: { id: user.id },
      data: { motDePasseHash },
    });
    done += 1;
    if (done % 150 === 0 || done === users.length) {
      console.log(`  ${done} / ${users.length}`);
    }
  });

  const csvLines = [
    "role;identifiant;mot_de_passe;centre;ville",
    ...users.map((u) => {
      const centre = u.centreControle?.code ?? "";
      const ville = u.centreControle?.commune ?? "";
      return `${u.role};${u.identifiant};${u.identifiant};${centre};${ville}`;
    }),
  ];
  const dir = path.join(process.cwd(), "prisma", "data");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "comptes-test.csv"), csvLines.join("\n"), "utf8");
  console.log("CSV mis à jour : prisma/data/comptes-test.csv");
  console.log("Exemples : admin / admin · commercial / commercial · vendeur.0001 / vendeur.0001");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
