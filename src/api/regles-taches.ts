/**
 * Machine à états d'une tâche de planning.
 *
 * Elle vivait écrite trois fois : dans les fonctions Postgres, dans
 * `TRANSITIONS` de `queries/planning.ts`, et dans `actionsTache` de
 * `integrations/session.ts`. Trois copies d'une même règle, que rien
 * n'obligeait à rester d'accord — un refus et le message qui l'explique
 * pouvaient diverger sans que personne ne s'en aperçoive.
 *
 * Ce module est une feuille : il n'importe que des types. C'est ce qui permet
 * à `queries` et à `integrations` de partager la même règle.
 *
 * L'autorité reste la base. `20260909140000_durcir_circuit_taches.sql` garde
 * les transitions, vérifie les rôles et interdit l'écriture directe des
 * colonnes d'état. Ce qui suit en est le miroir : il sert à ne pas proposer un
 * geste qui serait de toute façon refusé, et à l'expliquer avant l'aller-retour.
 */

import type { RoleMembre, StatutTache } from "./types";

/** L'état d'une tâche qui vient de naître. */
export const STATUT_INITIAL: StatutTache = "planifiee";

/** Depuis quels états chaque geste est possible. */
export const TRANSITIONS: Record<GesteTache, readonly StatutTache[]> = {
  realiser: ["planifiee", "refusee"],
  arbitrer: ["realisee"],
} as const;

export type GesteTache = "realiser" | "arbitrer";

/** Statut d'une tâche, avec le défaut que la base applique elle-même. */
export function statutDe(statut: string | null | undefined): StatutTache {
  return (statut ?? STATUT_INITIAL) as StatutTache;
}

/** Le geste est-il possible depuis cet état ? */
export function transitionPermise(geste: GesteTache, statut: string | null): boolean {
  return TRANSITIONS[geste].includes(statutDe(statut));
}

/**
 * Pourquoi le geste est refusé, en clair.
 *
 * Le message nomme l'état de départ et ceux qui auraient convenu : « impossible »
 * seul n'apprend rien à qui le lit.
 */
export function motifTransitionRefusee(
  geste: GesteTache,
  statut: string | null,
  libelle: string
): string {
  const attendus = TRANSITIONS[geste].join(" ou ");
  return `${libelle} : impossible depuis l'état « ${statutDe(statut)} » (attendu : ${attendus}).`;
}

export interface ActionsTache {
  /** Poser une tâche au planning, l'affecter, la déplacer. */
  peutPlanifier: boolean;
  /** Renseigner constats, photos et travaux supplémentaires. */
  peutSaisir: boolean;
  /** Déclarer les travaux faits — le terrain clôture, il n'arbitre pas. */
  peutCloturer: boolean;
  /** Valider ou refuser ce que le terrain a déclaré. */
  peutArbitrer: boolean;
}

/** Ceux qui interviennent sur le chantier. */
function estTerrain(role: RoleMembre | null): boolean {
  return role === "technicien" || role === "sous_traitant";
}

/** Ceux qui arbitrent ce que le terrain déclare. */
function estEncadrement(role: RoleMembre | null): boolean {
  return role === "admin" || role === "conducteur";
}

/**
 * Répartition des rôles sur le circuit :
 *
 *   technicien   clôture sa tâche ; ne planifie pas, n'arbitre pas
 *   conducteur   planifie et arbitre
 *   admin        planifie, arbitre, et valide la pré-facture
 *   secrétaire   lit les tâches, reprend la pré-facture et facture
 *
 * Le rôle est un paramètre plutôt qu'une lecture implicite : c'est ce qui rend
 * la règle vérifiable sans monter de session.
 */
export function actionsTache(
  statut: string | null,
  role: RoleMembre | null
): ActionsTache {
  const etat = statutDe(statut);

  return {
    peutPlanifier: estEncadrement(role),
    // Une tâche validée est close : plus personne n'y touche
    peutSaisir: (estTerrain(role) || estEncadrement(role)) && etat !== "validee",
    peutCloturer:
      (estTerrain(role) || estEncadrement(role)) && transitionPermise("realiser", etat),
    // On n'arbitre que ce que le terrain a déclaré fait
    peutArbitrer: estEncadrement(role) && transitionPermise("arbitrer", etat),
  };
}

/** Qui doit agir à cette étape, en clair. */
export function prochainActeur(statut: string | null): string {
  switch (statutDe(statut)) {
    case "planifiee":
      return "le technicien";
    case "refusee":
      return "le technicien, pour reprise";
    case "realisee":
      return "le conducteur de travaux";
    case "validee":
      return "l'administrateur, pour la pré-facture";
    default:
      return "";
  }
}
