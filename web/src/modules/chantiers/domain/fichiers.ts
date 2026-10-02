/**
 * Les fichiers d'un chantier : comptes-rendus, pièces du marché, sécurité,
 * inspections, devis complémentaires (CHA-03, CHA-04, CHA-41, CHA-56).
 *
 * Écart voulu (CHA-56) : l'ancien écran rangeait chaque fichier en data-URL dans
 * le JSON du chantier (champ sans colonne : perdu). Ici le fichier va dans le
 * bucket privé `terrain`, sous `<société>/chantiers/<chantier>/…` — le premier
 * segment est celui que lisent les politiques Storage — et la ligne de la table
 * fille ne garde que son chemin et son nom d'origine.
 */

/** Plafond de l'ancien écran (app.js l. 13472), gardé : c'est ce que les utilisateurs connaissent. */
export const TAILLE_MAX_FICHIER_CHANTIER = 8 * 1024 * 1024;

export type Verdict = { ok: true } | { ok: false; motif: string };

export function verifierFichierChantier(f: { size: number }): Verdict {
  if (f.size > TAILLE_MAX_FICHIER_CHANTIER) return { ok: false, motif: "Fichier trop volumineux (8 Mo maximum)." };
  return { ok: true };
}

/** Les familles de `chantier_documents.famille` (énumération `document_famille`). */
export type FamilleDocument = "dpgf" | "cctp" | "ccap" | "avenant" | "dgd" | "ppsps" | "doe";

/** Libellés et types acceptés de l'ancien écran (app.js l. 13439-13454, 14099-14126). */
export const FAMILLES: Record<FamilleDocument, { libelle: string; accepte: string }> = {
  dpgf: { libelle: "DPGF", accepte: ".pdf,.xlsx,.xls,.csv" },
  cctp: { libelle: "CCTP", accepte: ".pdf" },
  ccap: { libelle: "CCAP", accepte: ".pdf" },
  avenant: { libelle: "Avenant", accepte: ".pdf,.docx" },
  dgd: { libelle: "DGD", accepte: ".pdf,.xlsx,.xls,.docx" },
  ppsps: { libelle: "PPSPS", accepte: ".pdf,.docx,image/*" },
  doe: { libelle: "DOE", accepte: ".pdf,.docx,.xlsx,image/*" },
};
export const FAMILLES_MARCHE: readonly FamilleDocument[] = ["dpgf", "cctp", "ccap", "avenant", "dgd"];
export const FAMILLES_SECURITE: readonly FamilleDocument[] = ["ppsps", "doe"];
export const ACCEPTE_COMPTE_RENDU = ".pdf,image/*";
export const ACCEPTE_INSPECTION = ".pdf,image/*";
export const ACCEPTE_DEVIS_COMPLEMENTAIRE = ".pdf,image/*";

/**
 * Un nom utilisable comme clé d'objet : sans accent ni caractère exotique. Même
 * règle que `nomSurPourStockage` de l'ancienne couche (regles-piece-jointe.ts) ;
 * le nom d'origine reste affiché, celui-ci ne sert qu'au rangement.
 */
export function nomPourStockage(nom: string): string {
  const brut = nom.trim() || "document";
  const sansAccent = brut.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return (
    sansAccent
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, LONGUEUR_MAX_NOM_STOCKAGE) || "document"
  );
}

/** Un nom de rangement assez long pour rester lisible, assez court pour la clé d'objet du seau. */
const LONGUEUR_MAX_NOM_STOCKAGE = 120;

/** `horodatage` rend deux dépôts du même nom distincts, comme `uploadFile` de l'ancienne couche. */
export function cheminStockage(societeId: string, chantierId: string, nom: string, horodatage: number): string {
  return `${societeId}/chantiers/${chantierId}/${horodatage}_${nomPourStockage(nom)}`;
}
