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

/** À qui la tâche est confiée, vu du compte qui regarde. */
export interface AppartenanceTache {
  /** Une équipe est affectée à cette tâche. */
  aUneEquipe: boolean;
  /** Le compte qui regarde en fait partie. */
  enFaitPartie: boolean;
}

/**
 * Le terrain n'agit que sur les tâches de son équipe.
 *
 * `tache_marquer_realisee` l'impose déjà en base — « Cette tâche est confiée à
 * une autre équipe » — mais l'écran l'ignorait : il montrait « Travaux
 * terminés » sur **toutes** les tâches du bon, y compris celles d'un autre
 * métier confié à une autre équipe. Le technicien cliquait, et découvrait le
 * refus après coup. L'interface doit masquer ce que la base refuserait, pas
 * offrir ce qu'elle va rejeter.
 *
 * Sans information d'équipe, on ne restreint rien : c'est le cas de tous les
 * écrans qui n'ont pas la tâche sous la main, et la base reste le dernier mot.
 */
function terrainPeutAgir(
  role: RoleMembre | null,
  appartenance?: AppartenanceTache
): boolean {
  if (!estTerrain(role)) return estEncadrement(role);
  if (!appartenance) return true;
  return appartenance.enFaitPartie;
}

/**
 * Répartition des rôles sur le circuit :
 *
 *   technicien   clôture les tâches de son équipe ; ne planifie pas, n'arbitre pas
 *   conducteur   planifie et arbitre
 *   admin        planifie, arbitre, et valide la pré-facture
 *   secrétaire   lit les tâches, reprend la pré-facture et facture
 *
 * Le rôle est un paramètre plutôt qu'une lecture implicite : c'est ce qui rend
 * la règle vérifiable sans monter de session. L'appartenance à l'équipe suit le
 * même principe, et reste facultative — un écran qui ne la connaît pas obtient
 * le comportement d'avant.
 */
export function actionsTache(
  statut: string | null,
  role: RoleMembre | null,
  appartenance?: AppartenanceTache
): ActionsTache {
  const etat = statutDe(statut);
  const peutAgir = terrainPeutAgir(role, appartenance);

  return {
    peutPlanifier: estEncadrement(role),
    // Une tâche validée est close : plus personne n'y touche
    peutSaisir: peutAgir && etat !== "validee",
    peutCloturer: peutAgir && transitionPermise("realiser", etat),
    // On n'arbitre que ce que le terrain a déclaré fait
    peutArbitrer: estEncadrement(role) && transitionPermise("arbitrer", etat),
  };
}

/**
 * Pourquoi ce compte ne peut rien faire sur cette tâche, en clair.
 *
 * Les formulations reprennent celles que la base oppose, pour que l'écran et le
 * refus disent la même chose. `null` quand il n'y a rien à expliquer.
 */
export function motifLectureSeule(
  role: RoleMembre | null,
  appartenance?: AppartenanceTache
): string | null {
  if (!estTerrain(role) || !appartenance || appartenance.enFaitPartie) return null;
  return appartenance.aUneEquipe
    ? "Cette tâche est confiée à une autre équipe."
    : "Aucune équipe n'est affectée à cette tâche : son arbitrage revient au conducteur.";
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
