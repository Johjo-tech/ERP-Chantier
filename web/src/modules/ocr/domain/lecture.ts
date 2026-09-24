import type { ExtractionBC } from "./contrat";

/**
 * Ce que la lecture n'a pas trouvé et dont tout l'aval dépend (port de
 * `essentielsDeLecture`, src/api/regles-bc.ts) : le numéro du bon, l'adresse du
 * chantier, au moins une ligne de travaux. Dit, jamais bloquant.
 */
export function essentielsManquants(e: Pick<ExtractionBC, "numeroBC" | "adresse" | "lignes">): string[] {
  const manques: string[] = [];
  if ((e.numeroBC ?? "").trim() === "") {
    manques.push("numéro de bon non lu — vérifiez-le sur le document, ou cochez « Sans BC » / « En attente de BC »");
  }
  if ((e.adresse ?? "").trim() === "") {
    manques.push("adresse du chantier non lue — c'est elle qui devient le « Lieu d'intervention » de la facture");
  }
  if (!e.lignes.some((l) => l.type === "ligne" && l.designation.trim() !== "")) {
    manques.push("aucune ligne de travaux lue — décrivez en gros ce qu'il y a à faire");
  }
  return manques;
}

/** Le délai au-delà duquel on rend la main (l'ancien écran : 120 s). */
export const DELAI_LECTURE_MS = 120_000;
