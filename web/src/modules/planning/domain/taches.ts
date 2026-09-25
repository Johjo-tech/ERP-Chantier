/**
 * Machine à états d'une tâche de planning, et créneau d'une journée.
 *
 * Port de `src/api/regles-taches.ts` (parité : tests/parite/planning.essai.ts).
 * L'autorité reste la base : `tache_marquer_realisee`, `tache_valider` et le
 * déclencheur `circuit_etat_reserve` gardent transitions et rôles. Ce miroir
 * sert à ne pas proposer un geste qui serait refusé, et à dire pourquoi avant
 * l'aller-retour.
 */
import { MINUTES_PAR_HEURE } from "@/lib/durees";
import { entierLePlusProche } from "@/lib/nombres";
import { statutDe, TRANSITIONS, type AppartenanceTache, type GesteTache, type StatutTache } from "@/modules/auth-roles/domain/actions";

// États, transitions et gestes par rôle vivent dans auth-roles, partagés avec
// le circuit des bons (AUTH-37) : une seule règle, une seule parité.
export { actionsTache, motifLectureSeule, STATUT_INITIAL, statutDe, transitionPermise, TRANSITIONS } from "@/modules/auth-roles/domain/actions";
export type { ActionsTache, AppartenanceTache, GesteTache, StatutTache } from "@/modules/auth-roles/domain/actions";

export const LIBELLES_STATUT: Record<StatutTache, string> = {
  planifiee: "Planifiée",
  realisee: "Travaux déclarés faits",
  validee: "Validée",
  refusee: "Refusée",
};

/** Le message nomme l'état de départ et ceux qui auraient convenu : « impossible » seul n'apprend rien. */
export function motifTransitionRefusee(geste: GesteTache, statut: string | null, libelle: string): string {
  return `${libelle} : impossible depuis l'état « ${statutDe(statut)} » (attendu : ${TRANSITIONS[geste].join(" ou ")}).`;
}

/**
 * À qui la tâche est confiée, vu du compte : son équipe (compte → salarié →
 * équipe) ou son entreprise sous-traitante (contact du sous-traitant) — les
 * deux chaînes que suit `est_de_l_equipe` (proposition 20260926050000).
 */
export function appartenanceDe(
  t: { technicien_id: string | null; sous_traitant_id: string | null },
  monEquipeId: string | null,
  monSousTraitantId: string | null
): AppartenanceTache {
  const parEquipe = !!t.technicien_id && t.technicien_id === monEquipeId;
  const parSousTraitant = !!t.sous_traitant_id && t.sous_traitant_id === monSousTraitantId;
  return { aUneEquipe: !!t.technicien_id || !!t.sous_traitant_id, enFaitPartie: parEquipe || parSousTraitant };
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

/** Arrondi à l'entier le plus proche, demi vers le haut (l'argent n'est pas en jeu : des heures). */
const entierProche = entierLePlusProche;

/** Bornes d'une heure « HH:MM » dans la journée : un créneau ne déborde jamais sur le lendemain. */
const DERNIERE_HEURE = 23;
const DERNIERE_MINUTE = MINUTES_PAR_HEURE - 1;

function normaliserHeure(brut: string | null | undefined): string {
  const [h, m] = String(brut ?? "").split(":");
  const heures = Number(h);
  const minutes = Number(m ?? 0);
  if (!Number.isFinite(heures) || heures < 0 || heures > DERNIERE_HEURE) return "";
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > DERNIERE_MINUTE) return "";
  return `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function minutesDe(heure: string): number {
  const [h, m] = heure.split(":");
  return Number(h) * MINUTES_PAR_HEURE + Number(m);
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
  const fin = minutesDe(debut) + Math.max(DUREE_MIN_H, duree) * MINUTES_PAR_HEURE;
  const borne = Math.min(fin, DERNIERE_HEURE * MINUTES_PAR_HEURE + DERNIERE_MINUTE);
  return `${String(Math.floor(borne / MINUTES_PAR_HEURE)).padStart(2, "0")}:${String(borne % MINUTES_PAR_HEURE).padStart(2, "0")}`;
}

export function colonnesDuCreneau(creneau: Creneau): { heure_debut: string; heure_fin: string } {
  return { heure_debut: normaliserHeure(creneau.heure) || HEURE_DEFAUT, heure_fin: finDuCreneau(creneau.heure, creneau.duree) };
}

export function creneauDeLaTache(tache: PlageTache): Creneau | null {
  const debut = normaliserHeure(tache?.heure_debut);
  const fin = normaliserHeure(tache?.heure_fin);
  if (!debut) return null;
  if (!fin) return { heure: debut, duree: DUREE_DEFAUT_H };
  const heures = entierProche((minutesDe(fin) - minutesDe(debut)) / MINUTES_PAR_HEURE);
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
