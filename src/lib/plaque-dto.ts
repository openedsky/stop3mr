/** Jeton d’enregistrement : jamais dans une réponse JSON hors GET register-token. */
export function sansTokenEnregistrement<T extends { tokenEnregistrement?: unknown }>(
  plaque: T
): Omit<T, "tokenEnregistrement"> {
  const { tokenEnregistrement: _token, ...rest } = plaque;
  return rest;
}

export function sansTokensEnregistrement<T extends { tokenEnregistrement?: unknown }>(
  plaques: T[]
): Array<Omit<T, "tokenEnregistrement">> {
  return plaques.map(sansTokenEnregistrement);
}
