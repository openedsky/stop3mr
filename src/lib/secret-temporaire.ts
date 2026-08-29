import { randomBytes } from "crypto";
import { prisma } from "./db";
import { decrypt, encrypt } from "./encryption";

const TTL_MS = 10 * 60 * 1000;

export async function deposerMotDePasseTemporaire(
  utilisateurId: number,
  motDePasse: string
): Promise<string> {
  await prisma.secretTemporaire.deleteMany({
    where: { utilisateurId, consommeLe: null },
  });
  const id = randomBytes(32).toString("hex");
  await prisma.secretTemporaire.create({
    data: {
      id,
      utilisateurId,
      ciphertext: encrypt(motDePasse),
      expireLe: new Date(Date.now() + TTL_MS),
    },
  });
  return id;
}

export async function consommerMotDePasseTemporaire(
  id: string,
  utilisateurId: number
): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;

  const row = await prisma.$transaction(async (tx) => {
    const found = await tx.secretTemporaire.findUnique({ where: { id } });
    if (!found || found.utilisateurId !== utilisateurId) return null;
    if (found.consommeLe || found.expireLe.getTime() <= Date.now()) return null;
    await tx.secretTemporaire.update({
      where: { id },
      data: { consommeLe: new Date() },
    });
    return found;
  });

  if (!row) return null;
  try {
    return decrypt(row.ciphertext);
  } catch {
    return null;
  }
}
