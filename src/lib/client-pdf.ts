import { prisma } from "./db";
import { decryptClientRecord } from "./clients";

export async function clientForPdf(clientId: number) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { vehicules: { where: { actif: true }, orderBy: { creeLe: "asc" } } },
  });
  if (!client) return null;
  const decrypted = decryptClientRecord(client);
  return {
    ...decrypted,
    immatriculation: client.vehicules[0]?.immatriculation,
    vehicules: client.vehicules.map((v) => v.immatriculation),
  };
}
