import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";

/**
 * Machine à états d'une tâche de planning, et créneau d'une journée.
 *
 * Port de `src/api/regles-taches.ts` (parité : tests/parite/planning.essai.ts).
 * L'autorité reste la base : `tache_marquer_realisee`, `tache_valider` et le
 * déclencheur `circuit_etat_reserve` gardent transitions et rôles. Ce miroir
 * sert à ne pas proposer un geste qui serait refusé, et à dire pourquoi avant
 * l'aller-retour.
 */
export type StatutTache = "planifiee" | "realisee" | "validee" | "refusee";
export type GesteTache = "realiser" | "arbitrer";

export const STATUT_INITIAL: StatutTache = "planifiee";

export const TRANSITIONS: Record<GesteTache, readonly StatutTache[]> = {
  realiser: ["planifiee", "refusee"],
  arbitrer: ["realisee"],
};

export const LIBELLES_STATUT: Record<StatutTache, string> = {
  planifiee: "Planifiée",
  realisee: "Travaux déclarés faits",
  validee: "Validée",
  refusee: "Refusée",
};

/** Statut d'une tâche, avec le défaut que la base applique elle-même. */
export function statutDe(statut: string | null | undefined): StatutTache {
  return (statut ?? STATUT_INITIAL) as StatutTache;
}

export function transitionPermise(geste: GesteTache, statut: string | null): boolean {
  return TRANSITIONS[geste].includes(statutDe(statut));
}

/** Le message nomme l'état de départ et ceux qui auraient convenu : « impossible » seul n'apprend rien. */
export function motifTransitionRefusee(geste: GesteTache, statut: string | null, libelle: string): string {
  return `${libelle} : impossible depuis l'état « ${statutDe(statut)} » (attendu : ${TRANSITIONS[geste].join(" ou ")}).`;
}

export interface ActionsTache {
  peutPlanifier: boolean;
  peutSaisir: boolean;
  peutCloturer: boolean;
  peutArbitrer: boolean;
}

export interface AppartenanceTache {
  aUneEquipe: boolean;
  enFaitPartie: boolean;
}

const estTerrain = (role: RoleMembre | null) => role === "technicien" || role === "sous_traitant";
const estEncadrement = (role: RoleMembre | null) => role === "admin" || role === "conducteur";

/**
 * Le terrain n'agit que sur les tâches de son équipe ; sans information
 * d'équipe, on ne restreint rien et la base garde le dernier mot.
 */
function terrainPeutAgir(role: RoleMembre | null, appartenance?: AppartenanceTache): boolean {
  if (!estTerrain(role)) return estEncadrement(role);
  if (!appartenance) return true;
  return appartenance.enFaitPartie;
}

export function actionsTache(statut: string | null, role: RoleMembre | null, appartenance?: AppartenanceTache): ActionsTache {
  const etat = statutDe(statut);
  const peutAgir = terrainPeutAgir(role, appartenance);
  return {
    peutPlanifier: estEncadrement(role),
    // Une tâche validée est close : plus personne n'y touche.
    peutSaisir: peutAgir && etat !== "validee",
    peutCloturer: peutAgir && transitionPermise("realiser", etat),
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

// ============ LE CRÉNEAU D'UNE JOURNÉE ============

export const HEURE_DEFAUT = "08:00";
export const DUREE_DEFAUT_H = 1;
export const DUREE_MIN_H = 1;
export const DUREE_MAX_H = 8;

export interface Creneau {
  heure: string;
  duree: number;
}

export interface PlageTache {
  heure_debut?: string | null;
  heure_fin?: string | null;
}

/** Arrondi à l'entier le plus proche, demi vers le haut — celui de `Math.round` (l'argent n'est pas en jeu : des heures). */
const entierProche = (x: number) => Math.floor(x + 0.5);

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
 * Le créneau que l'écran déclare — ou rien : sans ce `null`, le premier
 * enregistrement venu graverait « 08:00 » sur des journées dont personne n'a
 * jamais dit l'heure.
 */
export function creneauDeclare(heure: string | null | undefined, duree: number | string | null | undefined): Creneau | null {
  const debut = normaliserHeure(heure);
  const heures = Number(duree);
  const dureeDite = Number.isFinite(heures) && heures > 0;
  if (!debut && !dureeDite) return null;
  return {
    heure: debut || HEURE_DEFAUT,
    duree: dureeDite ? Math.min(DUREE_MAX_H, Math.max(DUREE_MIN_H, entierProche(heures))) : DUREE_DEFAUT_H,
  };
}

/**
 * La fin d'un créneau : son début plus sa durée. La pause de midi n'est PAS
 * déduite (la grille compte déjà sa case) ; bornée à la fin de journée.
 */
export function finDuCreneau(heure: string, duree: number): string {
  const debut = normaliserHeure(heure) || HEURE_DEFAUT;
  const fin = minutesDe(debut) + Math.max(DUREE_MIN_H, duree) * 60;
  const borne = Math.min(fin, 23 * 60 + 59);
  return `${String(Math.floor(borne / 60)).padStart(2, "0")}:${String(borne % 60).padStart(2, "0")}`;
}

export function colonnesDuCreneau(creneau: Creneau): { heure_debut: string; heure_fin: string } {
  return { heure_debut: normaliserHeure(creneau.heure) || HEURE_DEFAUT, heure_fin: finDuCreneau(creneau.heure, creneau.duree) };
}

export function creneauDeLaTache(tache: PlageTache): Creneau | null {
  const debut = normaliserHeure(tache?.heure_debut);
  const fin = normaliserHeure(tache?.heure_fin);
  if (!debut) return null;
  if (!fin) return { heure: debut, duree: DUREE_DEFAUT_H };
  const heures = entierProche((minutesDe(fin) - minutesDe(debut)) / 60);
  if (heures <= 0) return null;
  return { heure: debut, duree: Math.min(DUREE_MAX_H, heures) };
}

export function memeCreneau(a: Creneau | null, b: Creneau | null): boolean {
  if (!a || !b) return a === b;
  return (normaliserHeure(a.heure) || HEURE_DEFAUT) === (normaliserHeure(b.heure) || HEURE_DEFAUT) && a.duree === b.duree;
}

/** Une journée pointée raconte ce qui s'est passé : en réécrire l'horaire falsifierait un constat. */
export function creneauModifiable(statut: string | null | undefined): boolean {
  const etat = statutDe(statut);
  return etat === "planifiee" || etat === "refusee";
}

/** Pourquoi le bon ne peut pas retourner au planning — miroir de la garde de `bc_piece_recue`. */
export function refusRetourAuPlanning(taches: readonly { metier?: string | null; date_tache?: string | null; statut: string | null }[]): string | null {
  const arbitrees = taches.filter((t) => statutDe(t.statut) === "validee");
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
