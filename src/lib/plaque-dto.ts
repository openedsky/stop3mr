/** Jeton d’enregistrement : jamais dans une réponse JSON hors GET register-token. */
export function sansTokenEnregistrement<T extends object>(
  plaque: T
): Omit<T, "tokenEnregistrement"> {
  const { tokenEnregistrement: _token, ...rest } = plaque as T & {
    tokenEnregistrement?: unknown;
  };
  return rest;
}

export function sansTokensEnregistrement<T extends object>(
  plaques: T[]
): Array<Omit<T, "tokenEnregistrement">> {
  return plaques.map(sansTokenEnregistrement);
}
