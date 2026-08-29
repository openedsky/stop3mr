import { prisma } from "@/lib/db";

export async function getUniqueProductionSite() {
  return prisma.siteProduction.findFirst({
    where: { actif: true },
    orderBy: { id: "asc" },
  });
}
