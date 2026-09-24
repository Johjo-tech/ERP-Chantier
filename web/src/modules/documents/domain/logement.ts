/**
 * Le lieu d'intervention d'un document (logement du locataire).
 *
 * Les champs complémentaires ne valent que pour certains statuts ; l'ancien
 * écran les nettoyait à l'enregistrement (`cleanLogementFields`, app.js l.
 * 4643) pour ne pas garder un occupant sur un logement vacant.
 */
export type StatutLogement = "occupé" | "vacant" | "commune";

export const STATUTS_LOGEMENT: readonly { code: StatutLogement; libelle: string }[] = [
  { code: "occupé", libelle: "Logement occupé" },
  { code: "vacant", libelle: "Logement vacant" },
  { code: "commune", libelle: "Partie commune" },
];

export interface ChampsLogement {
  logement_statut: StatutLogement | null;
  occupant: string | null;
  etage: string | null;
  numero_logement: string | null;
  precision_commune: string | null;
  ancien_locataire: string | null;
}

export function nettoyerLogement<T extends ChampsLogement>(c: T): T {
  const s = c.logement_statut;
  return {
    ...c,
    occupant: s === "occupé" ? c.occupant : null,
    etage: s === "occupé" || s === "vacant" ? c.etage : null,
    numero_logement: s === "occupé" || s === "vacant" ? c.numero_logement : null,
    precision_commune: s === "commune" ? c.precision_commune : null,
    ancien_locataire: s === "vacant" ? c.ancien_locataire : null,
  };
}
