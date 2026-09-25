import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";

/**
 * Le circuit d'un bon : tâches du terrain, validation conducteur, chiffrage
 * directeur. Ports de `src/api/regles-taches.ts` et de `src/api/regles-bc.ts`
 * (blocages), parité : tests/parite/circuit.essai.ts.
 *
 * Ce ne sont que des MIROIRS : la base garde les transitions
 * (`tache_marquer_realisee`, `tache_valider`, `bc_*`). Ils servent à ne pas
 * proposer un geste qui serait refusé, et à dire pourquoi avant l'aller-retour.
 */
import { statutDe, type StatutTache } from "@/modules/auth-roles/domain/actions";

// Les gestes par rôle (tâche, pré-facture) vivent dans auth-roles : une seule
// règle pour le planning et le circuit (AUTH-36, AUTH-37).
export { actionsFacturation, actionsTache, statutDe, transitionPermise } from "@/modules/auth-roles/domain/actions";
export type { ActionsFacturation, ActionsTache, GesteTache, StatutTache } from "@/modules/auth-roles/domain/actions";

export const ETATS_TACHE: Record<StatutTache, { libelle: string; variante: "default" | "succes" | "alerte" | "danger" }> = {
  planifiee: { libelle: "à pointer par le technicien", variante: "default" },
  realisee: { libelle: "pointée — à arbitrer", variante: "alerte" },
  validee: { libelle: "validée", variante: "succes" },
  refusee: { libelle: "refusée — à reprendre", variante: "danger" },
};

// ---------- Blocages (regles-bc.ts) ----------

export type CodeBlocage =
  | "deja_facture"
  | "deja_chiffre"
  | "cloture_gratuit"
  | "aucune_tache"
  | "metiers_sans_tache"
  | "taches_non_pointees"
  | "taches_non_validees"
  | "travaux_non_chiffres"
  | "lignes_sans_prix";

export interface Blocage {
  code: CodeBlocage;
  libelle: string;
  details: string[];
}

export interface TacheArbitrable {
  statut?: string | null;
  libelle?: string | null;
  metier?: string | null;
}
export interface TravailChiffrable {
  statut?: string | null;
  libelle?: string | null;
}
export interface LigneChiffrable {
  type?: string | null;
  designation?: string | null;
  prixUnitaire?: number | null;
}

const DETAILS_CITES = 5;
const nommerTache = (t: TacheArbitrable) => t.libelle || t.metier || "tâche sans libellé";

export const tachesNonValidees = (taches: readonly TacheArbitrable[]) => taches.filter((t) => statutDe(t.statut) !== "validee");
/** Une tâche refusée attend une reprise : elle n'est pas pointée. */
export const tachesNonPointees = (taches: readonly TacheArbitrable[]) => taches.filter((t) => !["realisee", "validee"].includes(statutDe(t.statut)));
export const travauxNonChiffres = (travaux: readonly TravailChiffrable[]) => travaux.filter((t) => t.statut === "a_chiffrer");
/** Une ligne à 0 € est retenue : la gratuité assumée passe par la clôture, pas par un prix oublié. */
export const lignesSansPrix = (lignes: readonly LigneChiffrable[]) => lignes.filter((l) => (l.type ?? "ligne") === "ligne" && !(Number(l.prixUnitaire) > 0));

/** Ce qui empêche le conducteur de clore l'affaire (BC-38) : toutes les tâches, et tous les métiers annoncés. */
export function blocagesValidationConducteur(taches: readonly TacheArbitrable[], metiersDuBon: readonly string[] = []): Blocage[] {
  if (!taches.length) return [{ code: "aucune_tache", libelle: "Aucune tâche n'a été planifiée : il n'y a rien à valider sur cette affaire.", details: [] }];
  const blocages: Blocage[] = [];
  const planifies = new Set(taches.map((t) => t.metier).filter((m): m is string => !!m));
  const sansTache = metiersDuBon.filter((m) => m && !planifies.has(m));
  if (sansTache.length) blocages.push({ code: "metiers_sans_tache", libelle: `${sansTache.length} métier(s) du bon n'ont encore aucune tâche planifiée.`, details: sansTache });
  const enAttente = tachesNonPointees(taches);
  if (enAttente.length) blocages.push({ code: "taches_non_pointees", libelle: `${enAttente.length} tâche(s) n'ont pas encore été pointées par le terrain.`, details: enAttente.map(nommerTache) });
  return blocages;
}

export interface DossierChiffrage {
  statutWorkflow?: string | null;
  taches: readonly TacheArbitrable[];
  travaux: readonly TravailChiffrable[];
  lignes: readonly LigneChiffrable[];
}

/**
 * Tout ce qui empêche de valider le chiffrage, dans l'ordre où l'on doit le
 * traiter (BC-39). Hors circuit, seules tombent les exigences du TERRAIN ; ce
 * qui touche au montant reste exigé.
 */
export function blocagesChiffrage(d: DossierChiffrage, options: { horsCircuit?: boolean } = {}): Blocage[] {
  if (d.statutWorkflow === "facture") return [{ code: "deja_facture", libelle: "Ce bon de commande a déjà été facturé.", details: [] }];
  if (d.statutWorkflow === "cloture_gratuit") {
    return [{ code: "cloture_gratuit", libelle: "Ce bon de commande a été clôturé sans suite facturable : il ne peut plus être facturé.", details: [] }];
  }
  if (d.statutWorkflow === "chiffre") return [{ code: "deja_chiffre", libelle: "Le chiffrage de ce bon de commande est déjà validé.", details: [] }];
  const blocages: Blocage[] = [];
  if (!options.horsCircuit) {
    if (!d.taches.length) {
      blocages.push({ code: "aucune_tache", libelle: "Aucune tâche n'a été planifiée : rien n'atteste que les travaux ont été réalisés.", details: [] });
    } else {
      const enAttente = tachesNonValidees(d.taches);
      if (enAttente.length) blocages.push({ code: "taches_non_validees", libelle: `${enAttente.length} tâche(s) ne sont pas encore validées par le conducteur.`, details: enAttente.map(nommerTache) });
    }
  }
  const aChiffrer = travauxNonChiffres(d.travaux);
  if (aChiffrer.length) {
    blocages.push({ code: "travaux_non_chiffres", libelle: `${aChiffrer.length} travail(aux) supplémentaire(s) restent à chiffrer.`, details: aChiffrer.map((t) => t.libelle || "travail sans libellé") });
  }
  const sansPrix = lignesSansPrix(d.lignes);
  if (sansPrix.length) blocages.push({ code: "lignes_sans_prix", libelle: `${sansPrix.length} ligne(s) n'ont pas de prix.`, details: sansPrix.map((l) => l.designation || "ligne sans désignation") });
  return blocages;
}

/** « Déjà chiffré » et « déjà facturé » sont des gestes accomplis, pas des points à traiter (app.js l. 7480). */
export const BLOCAGES_ACCOMPLIS: readonly CodeBlocage[] = ["deja_chiffre", "deja_facture"];

function resumerDetails(details: readonly string[]): string {
  if (!details.length) return "";
  const cites = details.slice(0, DETAILS_CITES).join(", ");
  const reste = details.length - DETAILS_CITES;
  return reste > 0 ? ` (${cites}, et ${reste} autre(s))` : ` (${cites})`;
}

/** Cinq détails, puis « et N autre(s) » : une liste de quarante lignes ne se lit pas. */
export function messageBlocages(blocages: readonly Blocage[]): string {
  return blocages.map((b) => b.libelle + resumerDetails(b.details)).join("\n");
}

// ---------- File de validation et circuit clos ----------

const CIRCUIT_CLOS: readonly string[] = ["chiffre", "facture", "cloture_gratuit"];

/**
 * Ce bon attend-il encore quelqu'un (circuitTermine, app.js l. 1629) ? Un bon
 * chiffré, facturé ou clos n'attend plus personne, QUOI QUE DISENT SES TÂCHES :
 * sans cela un bon sans tâche revenait éternellement « à valider » (BC-44, BC-79).
 */
export function circuitTermine(b: { statut_workflow: string | null }, factureLiee: boolean): boolean {
  return CIRCUIT_CLOS.includes(b.statut_workflow ?? "") || factureLiee;
}

/** « En attente planning » (renderPlanningEnAttente) : pas un SAV, circuit ouvert, pas encore validé par le conducteur. */
export function enAttentePlanning(b: { statut_workflow: string | null; bon_commande_parent_id: string | null }, valideConducteur: boolean, factureLiee: boolean): boolean {
  return b.bon_commande_parent_id === null && !circuitTermine(b, factureLiee) && !valideConducteur;
}

/** Pourquoi le bon n'est pas encore chiffrable, en clair ; `null` quand il l'est (attenteAvantChiffrage). */
export function attenteAvantChiffrage(etape: "pret" | "travaux_en_cours" | "hors_file", tachesNonPointeesNommees: readonly string[]): string | null {
  if (etape !== "travaux_en_cours") return null;
  const restantes = tachesNonPointeesNommees.length;
  if (restantes > 0) {
    const quoi = tachesNonPointeesNommees.slice(0, 2).join(", ");
    return restantes === 1 ? `Travaux non terminés — reste ${quoi}` : `Travaux non terminés — reste ${restantes} tâches (${quoi}…)`;
  }
  return "Travaux déclarés faits — en attente d'arbitrage du conducteur";
}


/**
 * Miroir de `peut_ecrire()` (admin, conducteur, technicien) : c'est lui que
 * lisent les politiques des travaux supplémentaires, des tâches, des photos et
 * du bucket `terrain`. La secrétaire modifie le bon mais la base lui refuse ces
 * écritures-là — l'écran ne les lui propose donc pas (D-BC-06).
 */
export const peutEcrireTerrain = (role: RoleMembre | null) => role === "admin" || role === "conducteur" || role === "technicien";

/** L'origine d'un travail constaté : l'encadrement le déclare « conducteur », le terrain « technicien » (BC-46). */
export const origineDuTravail = (role: RoleMembre | null): "conducteur" | "technicien" => (role === "conducteur" || role === "admin" ? "conducteur" : "technicien");

/** Seul l'administrateur clôt une affaire sans facturation (bc_cloturer_gratuit), et jamais une affaire déjà facturée. */
export function peutCloturerSansFacturation(role: RoleMembre | null, b: { statut_workflow: string | null }, factureLiee: boolean): boolean {
  return role === "admin" && !circuitTermine(b, factureLiee);
}

/** Le motif proposé à la clôture sans facturation : un SAV est une reprise sous garantie (app.js l. 4895). */
export const MOTIF_CLOTURE_DEFAUT = "Reprise sous garantie";
