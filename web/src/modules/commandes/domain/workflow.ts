import { z } from "zod";

/**
 * Le circuit d'un bon, tel que l'écran le lit.
 *
 * La base porte le circuit sur `planning_taches` (planifiee → realisee →
 * validee) et `bons_commande.statut_workflow` ; l'écran raisonne sur des
 * champs dérivés, recalculés À CHAQUE CHARGEMENT depuis les tâches (port de
 * `html-adapter.ts#reconstituerWorkflow`, BC-43). Écrire une tâche ne les met
 * donc pas à jour : il faut recharger — c'est ce qui faisait « mentir »
 * Facturation › Validation dans l'ancienne app (BC-70).
 */
export const schemaTacheBon = z.object({
  id: z.string(),
  bon_commande_id: z.string().nullable(),
  libelle: z.string().nullable(),
  metier: z.string().nullable(),
  statut: z.string().nullable(),
  date_tache: z.string().nullable(),
  commentaire: z.string().nullable(),
  refus_motif: z.string().nullable(),
  realisee_le: z.string().nullable(),
  validee_le: z.string().nullable(),
  piece_a_commander: z.boolean().nullable(),
  piece_description: z.string().nullable(),
  piece_fournisseur: z.string().nullable(),
  piece_date_commande: z.string().nullable(),
  piece_recue_le: z.string().nullable(),
});
export type TacheBon = z.infer<typeof schemaTacheBon>;

export interface EtatPiece {
  pieceACommander: boolean;
  description: string;
  fournisseur: string;
  dateCommande: string;
  recueLe: string;
}

/**
 * L'état de la pièce, vu du bon (`etatPieceDuBon`). Le drapeau dit l'ATTENTE :
 * une seule tâche suffit à mettre le bon entier en commande. Description,
 * fournisseur et dates disent l'HISTOIRE et lui survivent.
 */
export function etatPieceDuBon(taches: readonly TacheBon[]): EtatPiece {
  const enAttente = taches.find((t) => t.piece_a_commander);
  const trace = enAttente ?? taches.find((t) => t.piece_description || t.piece_recue_le);
  return {
    pieceACommander: !!enAttente,
    description: trace?.piece_description ?? "",
    fournisseur: trace?.piece_fournisseur ?? "",
    dateCommande: trace?.piece_date_commande ?? "",
    recueLe: trace?.piece_recue_le ?? "",
  };
}

export interface CircuitDuBon {
  nbTaches: number;
  /** Tâches ni réalisées ni validées, désignées par leur métier ou leur date. */
  tachesNonPointees: string[];
  metiersFait: Record<string, boolean>;
  dateOrigineFait: boolean;
  /** Toutes les tâches validées, et au moins une. */
  valideConducteur: boolean;
  /** Le chiffrage est arrêté : `statut_workflow` vaut « chiffre » ou « facture ». */
  valideDirecteur: boolean;
  piece: EtatPiece;
}

const faite = (t: TacheBon) => t.statut === "realisee" || t.statut === "validee";

export function circuitDuBon(taches: readonly TacheBon[], statutWorkflow: string | null): CircuitDuBon {
  const metiersFait: Record<string, boolean> = {};
  for (const t of taches) if (t.metier) metiersFait[t.metier] = faite(t);
  return {
    nbTaches: taches.length,
    tachesNonPointees: taches.filter((t) => !faite(t)).map((t) => t.metier || t.date_tache || "tâche non planifiée"),
    metiersFait,
    // Sans tâche rattachée, le bon n'a simplement pas encore été planifié.
    dateOrigineFait: taches.length > 0 && taches.every(faite),
    valideConducteur: taches.length > 0 && taches.every((t) => t.statut === "validee"),
    valideDirecteur: statutWorkflow === "chiffre" || statutWorkflow === "facture",
    piece: etatPieceDuBon(taches),
  };
}

type EnFile = Pick<CircuitDuBon, "nbTaches" | "tachesNonPointees" | "valideConducteur" | "valideDirecteur">;

/**
 * L'affaire est-elle entièrement pointée par le terrain (`bcTachesTerminees`) ?
 * Un bon SANS tâche n'est pas terminé, il n'est pas commencé (BC-41). Seule la
 * branche « tâches relues » est portée : le repli de l'ancien écran sur les
 * cases par métier servait aux bons jamais rechargés, ce qui n'arrive pas ici.
 */
export function tachesTerminees(b: EnFile): boolean {
  return b.nbTaches > 0 && b.tachesNonPointees.length === 0;
}

export type EtapeValidation = "pret" | "travaux_en_cours" | "hors_file";

/** Où se situe le bon dans la file de validation (regles-bc.ts#etapeValidation, BC-42). */
export function etapeValidation(b: EnFile): EtapeValidation {
  if (b.valideDirecteur) return "hors_file";
  if (b.nbTaches === 0) return "hors_file";
  if (b.valideConducteur) return "pret";
  // Au moins une tâche déclarée faite : les travaux ont commencé.
  return b.nbTaches > b.tachesNonPointees.length ? "travaux_en_cours" : "hors_file";
}

export type CleEtape = "facture" | "aFacturer" | "directeur" | "conducteur" | "terrain";

export interface Etape {
  cle: CleEtape;
  libelle: string;
  court: string;
  variante: "succes" | "alerte" | "default" | "danger";
}

/**
 * La pastille d'étape (`etapeWorkflow`, app.js l. 7082, BC-40) : à qui c'est le
 * tour. Une facture liée l'emporte sur tout, brouillon compris — comme l'ancien.
 */
export function etapeWorkflow(b: EnFile, factureLiee: boolean): Etape {
  if (factureLiee) return { cle: "facture", libelle: "Facturé", court: "Facturé", variante: "succes" };
  if (b.valideDirecteur) return { cle: "aFacturer", libelle: "À facturer", court: "À facturer", variante: "succes" };
  if (b.valideConducteur) return { cle: "directeur", libelle: "À valider — directeur", court: "Directeur", variante: "alerte" };
  if (tachesTerminees(b)) return { cle: "conducteur", libelle: "À valider — conducteur", court: "Conducteur", variante: "default" };
  return { cle: "terrain", libelle: "Travaux à pointer", court: "À pointer", variante: "danger" };
}

/**
 * Les quatre étapes du stepper (bcWorkflowStepperHTML, app.js l. 7100, BC-03) :
 * terrain, conducteur, directeur, facturé. L'étape courante est la première
 * non franchie.
 */
export function etapesDuCircuit(b: EnFile, factureLiee: boolean): { libelle: string; faite: boolean }[] {
  return [
    { libelle: "Métiers (technicien)", faite: tachesTerminees(b) },
    { libelle: "Conducteur", faite: b.valideConducteur },
    { libelle: "Directeur", faite: b.valideDirecteur },
    { libelle: "Facturé (secrétariat)", faite: factureLiee },
  ];
}
