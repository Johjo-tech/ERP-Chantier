/**
 * Mise en forme de la pré-facture pour l'écran de validation du directeur.
 *
 * Le directeur engage le montant facturé au client : il doit voir le bon de
 * commande comme un document — lignes, chapitres, totaux — et distinguer d'un
 * coup d'œil ce qui a été ajouté pendant le chantier de ce qui était commandé au
 * départ.
 *
 * Tout y est pur : le module ne touche ni au DOM, ni à `state`, ni à la base. Il
 * produit des lignes au format historique de l'application, directement
 * consommables par `printableLignesRows` et `computeTotalsAvecRemise` du
 * monolithe — c'est ce qui évite de réécrire une seconde logique de totaux, donc
 * une seconde occasion de se tromper de montant.
 */

import { REGLAGES_DEFAUT } from "./reglages";
import type { LigneChiffrable } from "../api/regles-bc";

const QUANTITE_DEFAUT = 1;
const UNITE_DEFAUT = "u";
const TVA_DEFAUT = REGLAGES_DEFAUT.documents.tvaDefaut;

export const CHAPITRE_BON_COMMANDE = "Bon de commande";
export const CHAPITRE_TRAVAUX_SUP = "Travaux supplémentaires constatés sur le chantier";

/** Classe posée sur les lignes ajoutées en cours de chantier. */
export const CLASSE_AJOUT = "p-ajout";

const ORIGINES: Record<string, string> = {
  technicien: "Ajouté — technicien",
  conducteur: "Ajouté — conducteur",
};

export interface LigneAffichee extends LigneChiffrable {
  qte?: number;
  unite?: string;
  tva?: number;
  /** Classe CSS de surbrillance, absente sur les lignes d'origine. */
  classe?: string;
  /** Étiquette d'origine, affichée devant la désignation. */
  badge?: string;
}

export interface TravailAffichable {
  libelle?: string | null;
  origine?: string | null;
  statut?: string | null;
  prix_vente_ht?: number | null;
  tva?: number | null;
}

export interface TacheTerrain {
  libelle?: string | null;
  metier?: string | null;
  date_tache?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  statut?: string | null;
  realisee_par?: string | null;
  validee_par?: string | null;
  validee_le?: string | null;
  commentaire?: string | null;
  croquis?: string | null;
}

export interface CompteRendu {
  libelle: string;
  metier: string;
  date: string;
  heures: string;
  statut: string;
  realiseePar: string | null;
  valideePar: string | null;
  valideeLe: string | null;
  commentaire: string;
  croquis: string | null;
}

/** « Ajouté — technicien », plutôt que la valeur brute stockée en base. */
export function badgeOrigine(origine: string | null | undefined): string {
  return ORIGINES[origine ?? ""] ?? "Ajouté en cours de chantier";
}

function travailEnLigne(t: TravailAffichable): LigneAffichee {
  return {
    type: "ligne",
    designation: t.libelle ?? "",
    qte: QUANTITE_DEFAUT,
    unite: UNITE_DEFAUT,
    prixUnitaire: Number(t.prix_vente_ht) || 0,
    tva: Number(t.tva) || TVA_DEFAUT,
    classe: CLASSE_AJOUT,
    badge: badgeOrigine(t.origine),
  };
}

/**
 * Document du directeur : les lignes du bon, puis les travaux supplémentaires
 * regroupés et surlignés.
 *
 * Le chapitre « Bon de commande » n'est ajouté que lorsqu'il y a des travaux
 * supplémentaires, et il est alors **obligatoire** : `printableLignesRows`
 * n'émet un sous-total qu'après avoir rencontré un chapitre. Sur un bon qui n'en
 * comportait aucun, les lignes d'origine se retrouveraient donc sans sous-total
 * alors que les travaux supplémentaires en auraient un — le directeur lirait un
 * seul montant intermédiaire et pourrait le prendre pour le total.
 */
export function lignesDocumentDirecteur(
  lignes: LigneAffichee[],
  travaux: TravailAffichable[]
): LigneAffichee[] {
  const origine = lignes ?? [];
  const ajouts = travaux ?? [];

  if (!ajouts.length) return [...origine];

  const document: LigneAffichee[] = [];

  if (origine.length) {
    document.push({ type: "chapitre", designation: CHAPITRE_BON_COMMANDE });
    document.push(...origine);
  }

  document.push({ type: "chapitre", designation: CHAPITRE_TRAVAUX_SUP });
  document.push(...ajouts.map(travailEnLigne));

  return document;
}

function heures(t: TacheTerrain): string {
  if (!t.heure_debut && !t.heure_fin) return "";
  return [t.heure_debut, t.heure_fin].filter(Boolean).join(" – ");
}

/**
 * Un compte rendu par tâche qui en porte un.
 *
 * La reconstitution historique ne remonte que la **première** tâche commentée
 * (`taches.find(...)`) : sur un bon à plusieurs métiers, les constats des autres
 * intervenants disparaissaient de l'écran. Ici, tous sont rendus.
 */
export function comptesRendusTerrain(taches: TacheTerrain[]): CompteRendu[] {
  return (taches ?? [])
    .filter((t) => (t.commentaire ?? "").trim() || t.croquis)
    .map((t) => ({
      libelle: t.libelle ?? "",
      metier: t.metier ?? "",
      date: t.date_tache ?? "",
      heures: heures(t),
      statut: t.statut ?? "",
      realiseePar: t.realisee_par ?? null,
      valideePar: t.validee_par ?? null,
      valideeLe: t.validee_le ?? null,
      commentaire: (t.commentaire ?? "").trim(),
      croquis: t.croquis ?? null,
    }));
}
