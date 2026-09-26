import { normaliserLibelle } from "./metiers";
import { etatPieceDuBon, type EtatPiece, type TacheBon } from "./workflow";

/**
 * Les fournisseurs proposés pour une pièce (`fournisseurOptions`) : les actifs
 * de l'annuaire dans leur ordre, puis, triés, les noms déjà écrits sur des
 * commandes et celui de la pièce — sans quoi une commande ancienne perdrait le
 * sien à la première réouverture. Composition de `referentielCompose` : un même
 * nom à la casse près n'est proposé qu'une fois, sous sa graphie déclarée.
 */
export function optionsFournisseurs(annuaire: readonly { nom: string; actif: boolean }[], employes: readonly string[], courant: string): string[] {
  const retenus = new Map<string, string>();
  for (const brut of annuaire.filter((f) => f.actif || f.nom === courant).map((f) => f.nom)) {
    const nom = brut.trim();
    const cle = normaliserLibelle(nom);
    if (cle && !retenus.has(cle)) retenus.set(cle, nom);
  }
  const ajoutes = new Map<string, string>();
  for (const brut of [...employes, courant]) {
    const nom = brut.trim();
    const cle = normaliserLibelle(nom);
    if (cle && !retenus.has(cle) && !ajoutes.has(cle)) ajoutes.set(cle, nom);
  }
  return [...retenus.values(), ...[...ajoutes.values()].sort((a, b) => a.localeCompare(b, "fr"))];
}

/** Le dossier d'une pièce dont le fournisseur n'a pas été saisi (renderDossiersFournisseurs). */
export const SANS_FOURNISSEUR = "— Fournisseur non renseigné —";

export interface BonDePiece {
  id: string;
  numero_interne: string | null;
  numero_bc: string | null;
  client_nom: string;
  adresse: string | null;
  ville: string | null;
  statut_workflow: string | null;
}

export interface PieceDuBon extends EtatPiece {
  bon: BonDePiece;
}

export function pieceDuBon(bon: BonDePiece, taches: readonly TacheBon[]): PieceDuBon {
  return { bon, ...etatPieceDuBon(taches) };
}

export type OngletPieces = "a_commander" | "commandees" | "recues";

/**
 * Trois moments d'une même pièce (BC-20) : à commander tant qu'aucune date de
 * commande n'est posée, commandée ensuite, reçue quand le drapeau est levé.
 * L'ancien écran n'avait que les deux premiers ; « Reçues » garde la trace.
 */
export function ongletDe(p: EtatPiece): OngletPieces | null {
  if (p.pieceACommander) return p.dateCommande ? "commandees" : "a_commander";
  return p.recueLe ? "recues" : null;
}

/** L'onglet atteint au clavier : flèches circulaires, Début et Fin (motif ARIA des onglets, relecture 3 M8). */
export function ongletVoisin<T>(ordre: readonly T[], courant: T, touche: string): T | null {
  const i = ordre.indexOf(courant);
  const n = ordre.length;
  const cible = touche === "ArrowRight" ? (i + 1) % n : touche === "ArrowLeft" ? (i - 1 + n) % n : touche === "Home" ? 0 : touche === "End" ? n - 1 : null;
  return cible === null ? null : (ordre[cible] ?? null);
}

/** Des dossiers par fournisseur, triés par nom ; le fournisseur absent a le sien. */
export function parFournisseur<P extends { fournisseur: string }>(pieces: readonly P[]): { fournisseur: string; pieces: P[] }[] {
  const dossiers = new Map<string, P[]>();
  for (const p of pieces) {
    const cle = p.fournisseur.trim() || SANS_FOURNISSEUR;
    dossiers.set(cle, [...(dossiers.get(cle) ?? []), p]);
  }
  return [...dossiers.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fournisseur, liste]) => ({ fournisseur, pieces: liste }));
}
