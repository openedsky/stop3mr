import { prisma } from "../src/lib/db";
import { nextCodeCommercial } from "../src/lib/commercial-code";

async function main() {
  const commercials = await prisma.utilisateur.findMany({
    where: { role: "COMMERCIAL", codeCommercial: null },
    orderBy: { id: "asc" },
    select: { id: true, identifiant: true },
  });

  for (const commercial of commercials) {
    const code = await nextCodeCommercial();
    await prisma.utilisateur.update({
      where: { id: commercial.id },
      data: { codeCommercial: code },
    });
    console.log(`${commercial.identifiant} → ${code}`);
  }

  console.log(`${commercials.length} commercial(aux) mis à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
