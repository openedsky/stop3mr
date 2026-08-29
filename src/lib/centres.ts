import { prisma } from "./db";

export async function findCentreActif(id: number | null | undefined) {
  if (!id) return null;
  return prisma.centreControle.findFirst({
    where: { id, actif: true },
    select: { id: true },
  });
}

/** Centre saisi : doit exister et être actif. AGENT_CT / COMMERCIAL restent sur leur rattachement. */
export async function resoudreCentreSaisi(params: {
  saisi: number | null | undefined;
  role: string;
  rattacheId: number | null | undefined;
  obligatoire?: boolean;
}): Promise<{ centreId: number | null; error?: string; status?: number }> {
  const rolesFixes = params.role === "COMMERCIAL" || params.role === "AGENT_CT";
  const voulu = params.saisi ?? (rolesFixes ? params.rattacheId : null) ?? null;

  if (!voulu) {
    if (params.obligatoire || (rolesFixes && !params.rattacheId && params.role === "COMMERCIAL")) {
      return { centreId: null, error: "Indiquez le centre de contrôle technique", status: 400 };
    }
    return { centreId: null };
  }

  if (rolesFixes && params.rattacheId && voulu !== params.rattacheId) {
    return {
      centreId: null,
      error: "Le centre doit être celui auquel vous êtes rattaché",
      status: 403,
    };
  }

  const centre = await findCentreActif(voulu);
  if (!centre) {
    return { centreId: null, error: "Centre de contrôle introuvable ou inactif", status: 400 };
  }
  return { centreId: centre.id };
}
