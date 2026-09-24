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

// ============ RETOUR AU PLANNING ============

/** Ce qu'il faut savoir d'une tâche pour dire si le bon peut repartir. */
export interface TacheDuRetour {
  metier?: string | null;
  date_tache?: string | null;
  statut: string | null;
}

/**
 * Pourquoi ce bon ne peut pas retourner au planning — `null` quand il le peut.
 *
 * Miroir de la garde de `bc_piece_recue`, qui oppose le même refus. Il sert à
 * l'expliquer sur place, en nommant le métier et la date que l'utilisateur a
 * sous les yeux, plutôt qu'après l'aller-retour et sous forme d'un code SQL.
 *
 * Une tâche validée est un arbitrage du conducteur : la sortir du calendrier le
 * déferait sans laisser de trace. La sortie est le SAV, qui rouvre une affaire
 * en le disant.
 */
export function refusRetourAuPlanning(taches: TacheDuRetour[]): string | null {
  const arbitrees = (taches ?? []).filter((t) => statutDe(t.statut) === "validee");
  if (!arbitrees.length) return null;

  const nommees = arbitrees
    .map((t) => [t.metier, t.date_tache].filter(Boolean).join(" du "))
    .filter(Boolean)
    .join(", ");

  return (
    `${arbitrees.length} tâche(s) de ce bon sont validées par le conducteur` +
    (nommees ? ` (${nommees})` : "") +
    " : une affaire arbitrée ne se replanifie pas — ouvrez un SAV."
  );
}

/**
 * Sur quelle tâche POSER le drapeau « pièce à commander ».
 *
 * Une seule : celle où le technicien se trouve. La porteuse d'abord, pour que
 * le fournisseur et la date de commande rejoignent la description déjà saisie
 * — les séparer les rendait illisibles, la lecture ne regardant que la
 * porteuse. À défaut, la plus ancienne.
 */
export function cibleAPoserLaPiece<T extends { id: string; piece_a_commander?: boolean | null }>(
  taches: T[]
): string | null {
  const liste = taches ?? [];
  return (liste.find((t) => t.piece_a_commander) ?? liste[0])?.id ?? null;
}

/**
 * Sur quelles tâches LEVER le drapeau. Toutes celles qui le portent.
 *
 * L'asymétrie avec la pose n'est pas un oubli : la lecture répond « pièce en
 * commande » dès qu'UNE tâche est drapée. Lever sur une seule laissait donc le
 * bon dans l'onglet avec son badge, et c'est précisément ce qui l'empêchait de
 * retourner au planning.
 */
export function ciblesALeverLaPiece<T extends { id: string; piece_a_commander?: boolean | null }>(
  taches: T[]
): string[] {
  return (taches ?? []).filter((t) => t.piece_a_commander).map((t) => t.id);
}

// ============ LE CRÉNEAU D'UNE JOURNÉE ============
//
// Une tâche occupe une plage horaire : `heure_debut` et `heure_fin`. L'écran,
// lui, raisonne en « heure de début + durée en heures », parce que c'est ce
// qu'on choisit sur une grille où une case vaut une heure.
//
// La conversion vit ici, et nulle part ailleurs : l'écriture et la lecture
// doivent en donner la même lecture, sans quoi un créneau enregistré ne se
// relirait pas tel qu'il a été posé.

/** Ce que le modal propose quand personne n'a encore choisi. */
export const HEURE_DEFAUT = "08:00";
export const DUREE_DEFAUT_H = 1;
/** Bornes de la liste de durées du modal, et de la poignée du planning. */
export const DUREE_MIN_H = 1;
export const DUREE_MAX_H = 8;

export interface Creneau {
  /** Heure de début, « HH:MM ». */
  heure: string;
  /** Nombre de cases d'une heure occupées sur la grille. */
  duree: number;
}

/** Une plage telle que la table la range. */
export interface PlageTache {
  heure_debut?: string | null;
  heure_fin?: string | null;
}

/** « 8:5 », « 08:00:00 » → « 08:00 ». Chaîne vide si rien d'exploitable. */
function normaliserHeure(brut: string | null | undefined): string {
  const [h, m] = String(brut ?? "").split(":");
  const heures = Number(h);
  const minutes = Number(m ?? 0);
  if (!Number.isFinite(heures) || heures < 0 || heures > 23) return "";
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) return "";
  return `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function minutesDe(heure: string): number {
  const [h, m] = heure.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Le créneau que l'écran déclare — ou rien du tout.
 *
 * REND `null` QUAND L'ÉCRAN NE DIT RIEN DES DEUX, et c'est la garde qui tient
 * tout le reste. Les tâches déjà en base n'ont pas d'horaire : sans ce `null`,
 * le premier enregistrement venu — un changement d'équipe, une pièce signalée —
 * graverait « 08:00 » sur des journées dont personne n'a jamais dit l'heure, et
 * l'invention deviendrait indiscernable d'une saisie.
 *
 * Un seul des deux suffit en revanche à déclarer un créneau : qui choisit
 * « 3 h » regarde une vignette qui affiche déjà 08:00, et l'autre valeur prend
 * donc son défaut plutôt que d'annuler le geste.
 */
export function creneauDeclare(
  heure: string | null | undefined,
  duree: number | string | null | undefined
): Creneau | null {
  const debut = normaliserHeure(heure);
  const heures = Number(duree);
  const dureeDite = Number.isFinite(heures) && heures > 0;
  if (!debut && !dureeDite) return null;
  return {
    heure: debut || HEURE_DEFAUT,
    duree: dureeDite
      ? Math.min(DUREE_MAX_H, Math.max(DUREE_MIN_H, Math.round(heures)))
      : DUREE_DEFAUT_H,
  };
}

/**
 * La fin d'un créneau : son début plus sa durée.
 *
 * LA PAUSE DE MIDI N'EST PAS DÉDUITE, volontairement. La grille du planning
 * ajoute une case quand un créneau enjambe midi, et la durée que l'écran
 * enregistre compte donc déjà cette case. « 10:00, 3 cases » finit bien à
 * 13:00 — l'heure réelle à laquelle l'équipe repart. Retrancher la pause ici
 * rendrait la conversion non réversible : relire donnerait 2 h là où on avait
 * écrit 3, et écriture et lecture divergeraient dès le premier aller-retour.
 *
 * Bornée à la fin de journée : un créneau ne déborde pas sur le lendemain —
 * un autre jour, c'est une autre date.
 */
export function finDuCreneau(heure: string, duree: number): string {
  const debut = normaliserHeure(heure) || HEURE_DEFAUT;
  const fin = minutesDe(debut) + Math.max(DUREE_MIN_H, duree) * 60;
  const borne = Math.min(fin, 23 * 60 + 59);
  return `${String(Math.floor(borne / 60)).padStart(2, "0")}:${String(borne % 60).padStart(2, "0")}`;
}

/** Ce qu'une tâche doit porter pour dire ce créneau. */
export function colonnesDuCreneau(creneau: Creneau): {
  heure_debut: string;
  heure_fin: string;
} {
  return {
    heure_debut: normaliserHeure(creneau.heure) || HEURE_DEFAUT,
    heure_fin: finDuCreneau(creneau.heure, creneau.duree),
  };
}

/**
 * Le créneau que porte une tâche, ou `null` si elle n'en porte pas.
 *
 * Une fin sans début, ou une fin antérieure au début, ne décrit rien
 * d'exploitable : mieux vaut « pas de créneau » qu'une durée négative posée sur
 * la grille.
 */
export function creneauDeLaTache(tache: PlageTache): Creneau | null {
  const debut = normaliserHeure(tache?.heure_debut);
  const fin = normaliserHeure(tache?.heure_fin);
  if (!debut) return null;
  if (!fin) return { heure: debut, duree: DUREE_DEFAUT_H };
  const heures = Math.round((minutesDe(fin) - minutesDe(debut)) / 60);
  if (heures <= 0) return null;
  return { heure: debut, duree: Math.min(DUREE_MAX_H, heures) };
}

/** Deux créneaux disent-ils la même chose ? Sert à ne pas écrire pour rien. */
export function memeCreneau(a: Creneau | null, b: Creneau | null): boolean {
  if (!a || !b) return a === b;
  return (
    (normaliserHeure(a.heure) || HEURE_DEFAUT) === (normaliserHeure(b.heure) || HEURE_DEFAUT) &&
    a.duree === b.duree
  );
}

/**
 * Le créneau de cette journée est-il encore un plan, ou déjà un fait ?
 *
 * Une journée pointée réalisée ou validée par le terrain raconte ce qui s'est
 * passé. En réécrire l'horaire depuis le planning falsifierait un constat.
 */
export function creneauModifiable(statut: string | null | undefined): boolean {
  const etat = statutDe(statut);
  return etat === "planifiee" || etat === "refusee";
}
