import { prisma } from "@/lib/db";

const CODE_START = 1001;

export async function nextCodeCommercial(): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const last = await tx.utilisateur.aggregate({
      _max: { codeCommercial: true },
    });
    const floor = last._max.codeCommercial ?? CODE_START - 1;
    await tx.$executeRaw`
      INSERT INTO compteurs_document (type, annee, dernier_num, mis_a_jour_le)
      VALUES ('COM', 0, LAST_INSERT_ID(${floor + 1}), NOW(3))
      ON DUPLICATE KEY UPDATE
        dernier_num = LAST_INSERT_ID(GREATEST(dernier_num, ${floor}) + 1),
        mis_a_jour_le = NOW(3)
    `;
    const rows = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT LAST_INSERT_ID() AS id`;
    return Number(rows[0]?.id ?? floor + 1);
  });
}

export async function ensureCodeCommercial(userId: number, role: string): Promise<number | null> {
  if (role !== "COMMERCIAL") return null;

  const user = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { codeCommercial: true, role: true },
  });
  if (!user || user.role !== "COMMERCIAL") return null;
  if (user.codeCommercial) return user.codeCommercial;

  const code = await nextCodeCommercial();
  await prisma.utilisateur.update({
    where: { id: userId },
    data: { codeCommercial: code },
  });
  return code;
}

export function formatCommercialLabel(c: {
  codeCommercial?: number | null;
  prenom?: string | null;
  nom?: string | null;
  identifiant?: string;
  stockAffecte?: number;
}) {
  const code = c.codeCommercial != null ? String(c.codeCommercial) : "—";
  const name = [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.identifiant || "Commercial";
  const stock = c.stockAffecte != null ? ` — stock vendeur : ${c.stockAffecte}` : "";
  return `${code} — ${name}${stock}`;
}
