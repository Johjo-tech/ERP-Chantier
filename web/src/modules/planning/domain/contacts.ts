import type { Tentative } from "./cartes";

/**
 * Le suivi des contacts d'un bon (PLN-07) : tentatives d'appel ou de SMS, et
 * rappel programmé. Port de `logTentativeContact`, `removeTentativeContact`,
 * `confirmerRappel` (app.js l. 9247-9360). Les tentatives vivent dans
 * `bons_commande.tentatives_contact` (jsonb), le rappel dans `rappel_date`.
 */

export function ajouterTentative(tentatives: readonly Tentative[], type: Tentative["type"], date: string, heure: string, id: string): Tentative[] {
  return [...tentatives, { id, type, date, heure }];
}

export function retirerTentative(tentatives: readonly Tentative[], id: string): Tentative[] {
  return tentatives.filter((t) => t.id !== id);
}

/** Un rappel se programme aujourd'hui ou plus tard : rappeler hier n'a pas de sens. */
export function refusRappel(date: string, aujourdhui: string): string | null {
  if (!date) return "Choisissez une date de rappel.";
  if (date < aujourdhui) return "La date de rappel ne peut pas être passée.";
  return null;
}

/** `tel:` n'accepte ni espace ni point : l'attribut garde les chiffres et le « + », le texte la graphie saisie. */
export function lienTelephone(telephone: string | null | undefined): string | null {
  const brut = (telephone ?? "").trim();
  if (!brut) return null;
  const chiffres = brut.replace(/[^+0-9]/g, "");
  return chiffres ? `tel:${chiffres}` : null;
}

/** L'heure « HH:MM » à Paris, pour horodater une tentative comme la pendule du bureau. */
export function heureDeParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
