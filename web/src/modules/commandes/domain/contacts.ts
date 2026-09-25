import { z } from "zod";

/**
 * Les gestes de contact d'un bon (BC-02, contactBoutonsHTML) : noter un appel
 * ou un SMS resté sans réponse, programmer un rappel. Ils vivent dans
 * `bons_commande.tentatives_contact` (jsonb) et `rappel_date`.
 */
const schemaTentative = z.object({ id: z.string(), type: z.enum(["appel", "sms"]), date: z.string(), heure: z.string().nullish() });
export type Tentative = z.infer<typeof schemaTentative>;

/** Une entrée illisible est écartée, pas réparée : le jsonb a été écrit par l'ancien écran. */
export function tentativesDuBon(brut: unknown): Tentative[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((t) => {
    const r = schemaTentative.safeParse(t);
    return r.success ? [r.data] : [];
  });
}

const LONGUEUR_HEURE = 5;

/** « Maintenant », à l'heure de Paris comme l'ancien écran (date du jour + HH:MM). */
export function nouvelleTentative(type: Tentative["type"], id: string, aujourdhui: string, maintenant: Date): Tentative {
  return { id, type, date: aujourdhui, heure: maintenant.toTimeString().slice(0, LONGUEUR_HEURE) };
}
