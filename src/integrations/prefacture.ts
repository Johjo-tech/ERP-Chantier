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
import { memeMetier, metierDeLaLigne } from "../api/regles-metiers";
import type { LigneChiffrable } from "../api/regles-bc";

/** Ce qu'un travail vaut quand il n'a pas été mesuré : un forfait. */
const QUANTITE_DEFAUT = 1;
const UNITE_DEFAUT = "u";

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
  quantite?: number | null;
  unite?: string | null;
  prix_vente_ht?: number | null;
  tva?: number | null;
  /** La tâche pendant laquelle le travail a été constaté — d'où son métier. */
  planning_tache_id?: string | null;
}

export interface TacheTerrain {
  id?: string | null;
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

function travailEnLigne(t: TravailAffichable, tvaDefaut: number): LigneAffichee {
  return {
    type: "ligne",
    designation: t.libelle ?? "",
    /* La quantité était figée à 1 : un travail mesuré — « reprise de plinthes
       sur 4 ml » — comptait pour une unité, et le total affiché pendant le
       chiffrage ne valait pas celui de la facture, que `bc_generer_facture`
       calcule bien sur `quantite`. */
    qte: t.quantite != null ? Number(t.quantite) : QUANTITE_DEFAUT,
    unite: t.unite || UNITE_DEFAUT,
    prixUnitaire: Number(t.prix_vente_ht) || 0,
    tva: Number(t.tva) || tvaDefaut,
    classe: CLASSE_AJOUT,
    badge: badgeOrigine(t.origine),
  };
}

/**
 * Le métier d'un travail supplémentaire : celui de la tâche pendant laquelle il
 * a été constaté.
 *
 * `tache_travaux_supplementaires` ne porte PAS de colonne `metier`, et il n'en
 * faut pas : la tâche en a un, et le travail la désigne par
 * `planning_tache_id`. Une colonne de plus serait une seconde vérité à tenir
 * d'accord avec la première.
 */
export function metierDuTravail(
  travail: TravailAffichable,
  taches: TacheTerrain[]
): string | null {
  const id = travail?.planning_tache_id;
  if (!id) return null;
  const tache = (taches ?? []).find((t) => t.id === id);
  return (tache?.metier ?? "").trim() || null;
}

/** Un chapitre du bon : son métier, et l'index de sa dernière ligne. */
interface BlocChapitre {
  metier: string | null;
  dernier: number;
}

/**
 * Les chapitres d'un bon, chacun avec son métier.
 *
 * Le métier se lit SUR LE CHAPITRE — choisi, ou déduit de son titre. C'est
 * `metierDeLaLigne` qui fait autorité, la même règle que l'écran et le planning
 * lisent déjà : la recopier ici créerait une seconde vérité, et les 830 bons
 * dont le chapitre ne porte aucun métier explicite la prendraient de plein
 * fouet.
 */
function blocsDeChapitres(
  lignes: LigneAffichee[],
  connus: (string | null | undefined)[]
): BlocChapitre[] {
  const blocs: BlocChapitre[] = [];
  lignes.forEach((l, i) => {
    if (l.type === "chapitre") {
      blocs.push({ metier: metierDeLaLigne(l, connus)?.metier ?? null, dernier: i });
      return;
    }
    if (blocs.length) blocs[blocs.length - 1].dernier = i;
  });
  return blocs;
}

export interface PlacementTravaux {
  /** Index d'une ligne du bon → les travaux à émettre juste après elle. */
  apres: Map<number, TravailAffichable[]>;
  /** Ceux qu'aucun chapitre ne réclame : ils garderont leur propre chapitre. */
  restants: TravailAffichable[];
}

/**
 * Chaque travail rejoint le chapitre du métier sur lequel il a été constaté.
 *
 * Un siphon remplacé pendant la tâche Plomberie appartient au corps d'état
 * Plomberie : c'est là qu'il doit être chiffré, compté dans le sous-total, et
 * facturé. Groupés à part, ils faussaient chaque sous-total par métier et
 * tombaient sur la facture après le dernier chapitre du bon, silencieusement
 * attribués à lui.
 *
 * Ce qui ne trouve pas son chapitre — un travail saisi par le conducteur au
 * niveau du bon, donc sans tâche, ou dont le métier n'a pas de chapitre —
 * reste groupé à la fin sous `CHAPITRE_TRAVAUX_SUP`. Le rattacher au hasard
 * serait pire que de le laisser visible à part.
 */
export function placerTravauxDansChapitres(
  lignes: LigneAffichee[],
  travaux: TravailAffichable[],
  taches: TacheTerrain[],
  connus: (string | null | undefined)[]
): PlacementTravaux {
  const blocs = blocsDeChapitres(lignes ?? [], connus ?? []);
  const apres = new Map<number, TravailAffichable[]>();
  const restants: TravailAffichable[] = [];

  for (const t of travaux ?? []) {
    const metier = metierDuTravail(t, taches);
    const bloc = metier
      ? blocs.find((b) => !!b.metier && memeMetier(b.metier, metier))
      : undefined;

    if (!bloc) {
      restants.push(t);
      continue;
    }
    const liste = apres.get(bloc.dernier) ?? [];
    liste.push(t);
    apres.set(bloc.dernier, liste);
  }

  return { apres, restants };
}

/**
 * Document du directeur : les lignes du bon, chaque travail supplémentaire
 * glissé dans le chapitre de son métier, et le reste groupé à la fin.
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
  travaux: TravailAffichable[],
  /* Le taux vient des réglages de la société : 20 % en neuf, 10 % en
     rénovation, 0 en autoliquidation. Le figer ici le rendrait faux ailleurs. */
  tvaDefaut: number = REGLAGES_DEFAUT.documents.tvaDefaut,
  /* Les tâches donnent leur métier aux travaux ; les métiers connus servent à
     lire celui d'un chapitre qui ne le déclare pas. Sans eux, la fonction se
     comporte comme avant : tout est groupé à la fin. */
  taches: TacheTerrain[] = [],
  connus: (string | null | undefined)[] = []
): LigneAffichee[] {
  const origine = lignes ?? [];
  const ajouts = travaux ?? [];

  if (!ajouts.length) return [...origine];

  const { apres, restants } = placerTravauxDansChapitres(origine, ajouts, taches, connus);
  const document: LigneAffichee[] = [];

  if (origine.length) {
    /* Le bon porte souvent ses propres chapitres — un par métier. En coiffer
       d'un autre laissait un « Bon de commande — Sous-total 0,00 € » en tête
       du document : le sous-total se referme au chapitre suivant, qui arrive
       aussitôt. On ne coiffe donc que des lignes sans structure. */
    if (!origine.some((l) => l.type === "chapitre")) {
      document.push({ type: "chapitre", designation: CHAPITRE_BON_COMMANDE });
    }
    origine.forEach((l, i) => {
      document.push(l);
      for (const t of apres.get(i) ?? []) document.push(travailEnLigne(t, tvaDefaut));
    });
  }

  if (restants.length) {
    document.push({ type: "chapitre", designation: CHAPITRE_TRAVAUX_SUP });
    document.push(...restants.map((t) => travailEnLigne(t, tvaDefaut)));
  }

  return document;
}

/**
 * Le même document, débarrassé de ce qui n'est que de l'affichage.
 *
 * `classe` et `badge` surlignent l'ajout à l'écran du directeur ; ils n'ont ni
 * colonne ni sens sur le bon enregistré. `colonnesDe()` les écarterait en
 * silence — les retirer ici le dit à voix haute.
 */
export function lignesAEnregistrer(document: LigneAffichee[]): LigneAffichee[] {
  return (document ?? []).map((l) => {
    const ligne = { ...l };
    delete ligne.classe;
    delete ligne.badge;
    return ligne;
  });
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
