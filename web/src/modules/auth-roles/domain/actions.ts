import type { RoleMembre } from "./permissions";

/**
 * Les deux règles de droits HORS MATRICE de l'ancien écran, en un seul endroit :
 *
 *  - `actionsTache` — port de `src/api/regles-taches.ts#actionsTache` (AUTH-37) ;
 *  - `actionsFacturation` — port de `integrations/session.ts#actionsFacturation` (AUTH-36).
 *
 * Elles étaient recopiées dans les modules planning et commandes, et rien
 * n'obligeait les copies à rester d'accord (l'ancien code avait connu la même
 * dérive entre `session.ts` et `regles-taches.ts`). Les modules les
 * réexportent ; parité : tests/parite/actions.essai.ts.
 *
 * Ce ne sont que des MIROIRS : la base garde transitions et rôles
 * (`tache_marquer_realisee`, `tache_valider`, `bc_chiffrage_valide*`,
 * `bc_generer_facture`). Ils servent à ne pas proposer un geste qui serait
 * refusé. Les appelants passent le rôle EFFECTIF (AUTH-38).
 */
export type StatutTache = "planifiee" | "realisee" | "validee" | "refusee";
export type GesteTache = "realiser" | "arbitrer";

/** Le statut qu'une tâche prend à sa création, en base comme ici. */
export const STATUT_INITIAL: StatutTache = "planifiee";

/** Depuis quels états chaque geste est possible (RM-54, BC-37) : une tâche validée ne se rouvre pas. */
export const TRANSITIONS: Record<GesteTache, readonly StatutTache[]> = {
  realiser: ["planifiee", "refusee"],
  arbitrer: ["realisee"],
};

/** Statut d'une tâche, avec le défaut que la base applique elle-même. */
export function statutDe(statut: string | null | undefined): StatutTache {
  return (statut ?? STATUT_INITIAL) as StatutTache;
}

export function transitionPermise(geste: GesteTache, statut: string | null | undefined): boolean {
  return TRANSITIONS[geste].includes(statutDe(statut));
}

export interface ActionsTache {
  peutPlanifier: boolean;
  peutSaisir: boolean;
  peutCloturer: boolean;
  peutArbitrer: boolean;
}

/** À qui la tâche est confiée, vu du compte connecté. */
export interface AppartenanceTache {
  aUneEquipe: boolean;
  enFaitPartie: boolean;
}

const estTerrain = (role: RoleMembre | null) => role === "technicien" || role === "sous_traitant";
const estEncadrement = (role: RoleMembre | null) => role === "admin" || role === "conducteur";

/**
 * Le terrain n'agit que sur les tâches de son équipe ; sans information
 * d'équipe, on ne restreint rien et la base garde le dernier mot (« confiée à
 * une autre équipe »).
 */
function peutAgir(role: RoleMembre | null, appartenance?: AppartenanceTache): boolean {
  if (!estTerrain(role)) return estEncadrement(role);
  return appartenance ? appartenance.enFaitPartie : true;
}

/**
 * Qui fait quoi sur une tâche : planifier = encadrement ; saisir et clôturer =
 * le terrain DE L'ÉQUIPE (ou l'encadrement), tâche non validée ; arbitrer =
 * encadrement, sur une tâche déclarée faite.
 */
export function actionsTache(statut: string | null | undefined, role: RoleMembre | null, appartenance?: AppartenanceTache): ActionsTache {
  const etat = statutDe(statut);
  const agit = peutAgir(role, appartenance);
  return {
    peutPlanifier: estEncadrement(role),
    // Une tâche validée est close : plus personne n'y touche.
    peutSaisir: agit && etat !== "validee",
    peutCloturer: agit && transitionPermise("realiser", etat),
    peutArbitrer: estEncadrement(role) && transitionPermise("arbitrer", etat),
  };
}

/** Les formulations reprennent celles que la base oppose : l'écran et le refus disent la même chose. */
export function motifLectureSeule(role: RoleMembre | null, appartenance?: AppartenanceTache): string | null {
  if (!estTerrain(role) || !appartenance || appartenance.enFaitPartie) return null;
  return appartenance.aUneEquipe
    ? "Cette tâche est confiée à une autre équipe."
    : "Aucune équipe n'est affectée à cette tâche : son arbitrage revient au conducteur.";
}

export interface ActionsFacturation {
  /** Chiffrer les travaux supplémentaires et arrêter le montant de la pré-facture. */
  peutValiderPrefacture: boolean;
  /** Reprendre la pré-facture avant émission. */
  peutModifierPrefacture: boolean;
  /** Émettre la facture (`bc_generer_facture` : admin, secrétaire). */
  peutFacturer: boolean;
  /** Envoyer un bon en facturation sans que le planning en atteste (`bc_chiffrage_valide_hors_circuit`). */
  peutFacturerHorsCircuit: boolean;
}

/**
 * Chiffrer et valider sont deux droits : la secrétaire complète la
 * pré-facture et émet la facture, seul l'administrateur arrête le montant.
 */
export function actionsFacturation(role: RoleMembre | null): ActionsFacturation {
  return {
    peutValiderPrefacture: role === "admin",
    peutModifierPrefacture: role === "admin" || role === "secretaire",
    peutFacturer: role === "admin" || role === "secretaire",
    peutFacturerHorsCircuit: role === "admin",
  };
}
