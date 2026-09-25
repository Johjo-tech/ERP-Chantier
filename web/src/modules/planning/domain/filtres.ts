import { correspond } from "@/lib/recherche";
import { dansLaPlage, dernierJourAffiche, lundiDe } from "./calendrier";
import type { CartePlanning } from "./cartes";
import { memeMetier } from "./metiers";

/**
 * Ce que montre chaque vue du planning (`renderPlanningCalendar`,
 * `renderPlanningEnAttente`, `filterPlanningList`, app.js l. 8630-8860).
 */
export type VuePlanning = "technicien" | "sous_traitant" | "attente" | "attente_st";
export type Affectation = "equipe" | "sous_traitant";

export interface FiltresPlanning {
  recherche: string;
  conducteur: string;
  metier: string;
  /** `""`, un statut de logement, ou `probleme` (au moins une tentative de contact restée sans réponse). */
  logement: string;
  /** Équipe (vue technicien) ou sous-traitant (vue sous-traitant) : un identifiant. */
  affecte: string;
  client: string;
  interlocuteur: string;
}

export const FILTRES_VIDES: FiltresPlanning = { recherche: "", conducteur: "", metier: "", logement: "", affecte: "", client: "", interlocuteur: "" };

/** Les états où le bon a un montant engagé : il ne se replanifie plus (`CIRCUIT_CLOS`). */
export const CIRCUIT_CLOS: readonly string[] = ["chiffre", "facture", "cloture_gratuit"];

export function circuitTermine(c: Pick<CartePlanning, "bon">): boolean {
  return CIRCUIT_CLOS.includes(c.bon.statut_workflow ?? "");
}

export function aUnProbleme(c: Pick<CartePlanning, "tentatives">): boolean {
  return c.tentatives.length > 0;
}

export function correspondRecherche(c: CartePlanning, recherche: string): boolean {
  const b = c.bon;
  return correspond(recherche, b.client_nom, b.numero_bc, b.numero_interne, b.conducteur, b.adresse, b.numero_logement, b.interlocuteur);
}

function affecteA(c: CartePlanning, affectation: Affectation): string | null {
  return affectation === "sous_traitant" ? c.sousTraitantId : c.equipeId;
}

/** Le périmètre commun : conducteur, métier, logement, et aucune affectation de l'AUTRE sorte. */
function perimetre(cartes: readonly CartePlanning[], f: FiltresPlanning, affectation: Affectation): CartePlanning[] {
  const autre: Affectation = affectation === "sous_traitant" ? "equipe" : "sous_traitant";
  return cartes.filter(
    (c) =>
      (!f.conducteur || c.bon.conducteur === f.conducteur) &&
      (!f.metier || memeMetier(c.metier, f.metier)) &&
      !affecteA(c, autre) &&
      (!f.logement || (f.logement === "probleme" ? aUnProbleme(c) : c.bon.logement_statut === f.logement))
  );
}

/**
 * La colonne « Non planifiés ». Écart assumé (D-PLN-04) : un bon au circuit
 * clos (chiffré, facturé, clôturé) n'y figure plus — la base refuse de le
 * replanifier (`bc_piece_recue`), et l'ancien écran l'y laissait sans fin.
 * Les SAV passent en tête.
 */
export function nonPlanifiees(cartes: readonly CartePlanning[], f: FiltresPlanning, affectation: Affectation): CartePlanning[] {
  return perimetre(cartes, f, affectation)
    .filter(
      (c) =>
        !c.rdv.datePlanifiee &&
        !circuitTermine(c) &&
        correspondRecherche(c, f.recherche) &&
        (!f.client || c.bon.client_nom === f.client) &&
        (!f.interlocuteur || c.bon.interlocuteur === f.interlocuteur)
    )
    .sort((a, b) => Number(b.isSav) - Number(a.isSav));
}

export function cartesDuCalendrier(cartes: readonly CartePlanning[], f: FiltresPlanning, affectation: Affectation): CartePlanning[] {
  return perimetre(cartes, f, affectation).filter((c) => (!f.affecte || affecteA(c, affectation) === f.affecte) && correspondRecherche(c, f.recherche));
}

/** Les cartes posées sur ce jour : dans la plage du rendez-vous, ou sur une journée supplémentaire. */
export function cartesDuJour(cartes: readonly CartePlanning[], jour: string): CartePlanning[] {
  return cartes.filter((c) => dansLaPlage(jour, c.rdv.datePlanifiee, c.rdv.datePlanifieeFin) || c.suppl.some((d) => d.date === jour));
}

/**
 * « En attente » : les bons (pas les cartes) dont le terrain n'a pas fini, hors
 * SAV et hors circuit clos, confiés en interne ou à un sous-traitant.
 */
export function enAttente(cartes: readonly CartePlanning[], mode: Affectation, recherche: string, noms: (c: CartePlanning) => string | null): CartePlanning[] {
  const vus = new Set<string>();
  const sortie: CartePlanning[] = [];
  for (const c of cartes) {
    if (vus.has(c.bcId)) continue;
    const duBon = cartes.filter((x) => x.bcId === c.bcId);
    const tachesDuBon = [...new Map(duBon.flatMap((x) => x.taches).map((t) => [t.id, t])).values()];
    const valideConducteur = tachesDuBon.length > 0 && tachesDuBon.every((t) => t.statut === "validee");
    const avecST = duBon.some((x) => !!x.sousTraitantId);
    if (c.isSav || circuitTermine(c) || valideConducteur) continue;
    if ((mode === "sous_traitant") !== avecST) continue;
    if (!correspond(recherche, c.bon.client_nom, c.bon.numero_bc, c.bon.numero_interne, c.bon.conducteur, noms(c), c.bon.adresse, c.bon.numero_logement, c.bon.interlocuteur)) continue;
    vus.add(c.bcId);
    sortie.push(c);
  }
  return sortie;
}

/**
 * La recherche saute à la semaine du premier résultat posé hors de l'écran
 * (`filterPlanningList`). Rend le nouveau premier lundi, ou `null` s'il ne faut
 * pas bouger.
 */
export function semaineDuResultat(cartes: readonly CartePlanning[], recherche: string, premierLundi: string): string | null {
  if (!recherche.trim()) return null;
  const trouvee = cartes.find((c) => c.rdv.datePlanifiee && correspondRecherche(c, recherche));
  const date = trouvee?.rdv.datePlanifiee;
  if (!date) return null;
  if (date >= premierLundi && date <= dernierJourAffiche(premierLundi)) return null;
  return lundiDe(date);
}

/** Les valeurs proposées par un filtre : celles que portent les bons, triées, sans doublon. */
export function valeursDe(cartes: readonly CartePlanning[], lire: (c: CartePlanning) => string | null | undefined): string[] {
  return [...new Set(cartes.map(lire).filter((v): v is string => !!v && v.trim() !== ""))].sort((a, b) => a.localeCompare(b, "fr"));
}
