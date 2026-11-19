/** Retire les valeurs vides (null, undefined, chaîne vide) avant l'envoi à l'API. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  ) as Partial<T>;
}