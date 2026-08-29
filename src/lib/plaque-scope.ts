type PlaqueWhere = Record<string, unknown>;

export function wherePlaquesListe(params: {
  role: string;
  userId: number;
  statut?: string | null;
  q?: string | null;
  produitId?: number;
  siteProduction?: string | null;
}): PlaqueWhere {
  const where: PlaqueWhere = {};
  if (params.produitId && params.produitId > 0) where.produitId = params.produitId;
  if (params.siteProduction) where.siteProduction = params.siteProduction;

  const statut = params.statut;
  const statutOk = statut === "EN_STOCK" || statut === "VENDUE" || statut === "AFFECTEE";
  const search = params.q ? { numeroSerie: { contains: params.q } } : null;

  if (params.role === "COMMERCIAL") {
    const scope: PlaqueWhere =
      statut === "VENDUE"
        ? { statut: "VENDUE", vente: { vendeurId: params.userId } }
        : statutOk
          ? { commercialId: params.userId, statut: "AFFECTEE" }
          : {
              OR: [
                { commercialId: params.userId, statut: "AFFECTEE" },
                { statut: "VENDUE", vente: { vendeurId: params.userId } },
              ],
            };
    if (search) where.AND = [scope, search];
    else Object.assign(where, scope);
    return where;
  }

  if (statutOk) where.statut = statut;
  if (search) Object.assign(where, search);
  return where;
}
