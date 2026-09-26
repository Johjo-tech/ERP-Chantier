import type { z } from "zod";

/**
 * Valide une réponse de la base contre le schéma attendu.
 *
 * Une réponse qui ne correspond pas signale un écart entre le code et le
 * schéma réel (colonne renommée, vue refaite…) : on le trace en détail pour
 * le développeur, et on lève une erreur lisible pour l'utilisateur.
 */
export function analyser<S extends z.ZodType>(schema: S, donnees: unknown, contexte: string): z.infer<S> {
  const r = schema.safeParse(donnees);
  if (!r.success) {
    console.error(`Réponse inattendue (${contexte}) :`, r.error.issues);
    throw new ErreurFormat(contexte);
  }
  return r.data;
}

export class ErreurFormat extends Error {
  constructor(contexte: string) {
    super(`Les données reçues pour « ${contexte} » n'ont pas la forme attendue.`);
    this.name = "ErreurFormat";
  }
}

/** Saisie de formulaire : « » (non renseigné) devient null — Postgres refuse "" sur une date ou une énumération. */
export function videEnNull(v: unknown): unknown {
  return typeof v === "string" && v.trim() === "" ? null : v;
}

/** Les erreurs Zod d'un formulaire, par champ (premier message seulement). */
export function erreursParChamp(e: z.ZodError): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const i of e.issues) {
    const cle = i.path.join(".");
    if (cle && !(cle in sortie)) sortie[cle] = i.message;
  }
  return sortie;
}
