/**
 * Les unités proposées sur une ligne de devis, de facture ou de bon (DEV-08,
 * `uniteOptions`, app.js l. 2486) : celles DÉCLARÉES au référentiel de la
 * société (domaine « unite », dans leur ordre), sinon la liste de repli de
 * l'ancien écran. La liste des réglages n'est pas lue : l'ancienne app l'a
 * reconnue comme « une liste qui mentait » — éditable, et sans effet.
 */
export const UNITES_REPLI: readonly string[] = ["u", "pièce", "h", "forfait", "m", "m²", "m³", "ml", "mm", "jour"];

export interface EntreeReferentiel {
  domaine: string;
  libelle: string | null;
  position: number | null;
}

/** L'ordre de `entreesDuDomaine` (regles-referentiels.ts) : position, puis libellé à la française. */
export function unitesDeLaSociete(entrees: readonly EntreeReferentiel[]): string[] {
  const declarees = entrees
    .filter((e) => e.domaine === "unite")
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.libelle ?? "").localeCompare(b.libelle ?? "", "fr"))
    .map((e) => e.libelle ?? "")
    .filter(Boolean);
  return declarees.length ? declarees : [...UNITES_REPLI];
}
