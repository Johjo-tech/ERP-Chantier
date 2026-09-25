import { jourIso } from "@/lib/dates";
import { z } from "zod";
import { montant, somme, type Montant } from "@/lib/money";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { circuitTermine } from "@/modules/commandes/domain/circuit";
import { schemaMontantBase } from "./indicateurs";

/**
 * Le tableau de bord de pilotage (admin, secrétaire, lecture) : « À traiter »,
 * activité récente, classement des clients, destinations des tuiles.
 */

export type GenreTableau = "terrain" | "conducteur" | "pilotage";

/**
 * Un tableau de bord par métier (`renderDashboard`) : les six rôles recevaient
 * autrefois le même écran, et un technicien lisait « CA encaissé » et le
 * classement des clients. Le pilotage reste celui de l'administrateur, de la
 * secrétaire et de la lecture seule.
 */
export function genreDuTableau(role: RoleMembre | null): GenreTableau {
  if (role === "technicien" || role === "sous_traitant") return "terrain";
  if (role === "conducteur") return "conducteur";
  return "pilotage";
}

/** Le bon tel que le module des commandes le lit, réduit à ce que « À traiter » regarde. */
export interface BonATraiter {
  statut_workflow: string | null;
  bon_commande_parent_id: string | null;
  rappel_date: string | null;
  /** Montant HT des lignes, enregistré sur le bon ; NULL pour qui ne voit pas les prix. */
  montant: number | null;
  circuit: { valideConducteur: boolean; valideDirecteur: boolean };
  factures: readonly unknown[];
}

export interface ATraiterPilotage {
  enAttenteConducteur: number;
  aValiderDirecteur: number;
  aFacturer: number;
  aFacturerMontant: Montant;
  rappels: number;
}

/**
 * `computeDashTraiter` (app.js l. 1655). Un bon au circuit terminé (chiffré,
 * facturé, clos, ou désigné par une facture) n'attend plus personne, quoi que
 * disent ses tâches (BC-79). Écart assumé (D-STA-06) : un rappel ne remonte que
 * sur un bon encore ouvert — l'ancien écran relançait aussi des affaires closes.
 */
export function aTraiterPilotage(bons: readonly BonATraiter[], jour: string): ATraiterPilotage {
  const ouverts = bons.filter((b) => !circuitTermine(b, b.factures.length > 0));
  // `valideDirecteur` = chiffré ou facturé : une affaire close gratuitement n'est jamais « à facturer ».
  const aFacturer = bons.filter((b) => b.circuit.valideDirecteur && b.factures.length === 0);
  return {
    enAttenteConducteur: ouverts.filter((b) => !b.circuit.valideConducteur && !b.bon_commande_parent_id).length,
    aValiderDirecteur: ouverts.filter((b) => b.circuit.valideConducteur && !b.circuit.valideDirecteur).length,
    aFacturer: aFacturer.length,
    aFacturerMontant: somme(aFacturer.map((b) => montant(b.montant))),
    rappels: ouverts.filter((b) => !!b.rappel_date && b.rappel_date <= jour).length,
  };
}

// ---------- Activité récente ----------

export const NATURES_ACTIVITE = ["devis", "facture", "rapport", "reglement"] as const;
export type NatureActivite = (typeof NATURES_ACTIVITE)[number];

export const schemaActivite = z.object({
  nature: z.enum(NATURES_ACTIVITE),
  id: z.string(),
  quand: z.string(),
  client: z.string().nullable(),
  numero: z.string().nullable(),
  montant: schemaMontantBase.nullable(),
  facture_id: z.string().nullable(),
});
export type Activite = z.infer<typeof schemaActivite>;

/** Les six dernières lignes, comme l'ancien fil (`buildActivityFeed`). */
export const ACTIVITE_VISIBLE = 6;

export const LIBELLES_ACTIVITE: Record<NatureActivite, string> = {
  devis: "Devis créé",
  facture: "Facture créée",
  rapport: "Rapport créé",
  reglement: "Paiement reçu",
};

/** Où mène une ligne du fil : la pièce, ou la facture qu'un paiement règle. */
export function lienActivite(a: Activite): string {
  if (a.nature === "devis") return `/devis/${a.id}`;
  if (a.nature === "rapport") return `/rapports/${a.id}`;
  return `/factures/${a.facture_id ?? a.id}`;
}

const MINUTE = 60_000;
const MINUTES_PAR_HEURE = 60;
const HEURES_PAR_JOUR = 24;
const JOURS_RELATIFS = 7;

/** « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 j », puis la date (`relativeTime`). */
export function tempsRelatif(quand: string, maintenant: number, dateFr: (iso: string) => string): string {
  const minutes = Math.floor((maintenant - new Date(quand).getTime()) / MINUTE);
  if (minutes < 1) return "à l'instant";
  if (minutes < MINUTES_PAR_HEURE) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / MINUTES_PAR_HEURE);
  if (heures < HEURES_PAR_JOUR) return `il y a ${heures} h`;
  const jours = Math.floor(heures / HEURES_PAR_JOUR);
  if (jours < JOURS_RELATIFS) return `il y a ${jours} j`;
  return dateFr(jourIso(quand));
}

// ---------- Clients ----------

export const schemaStatClient = z.object({
  client_id: z.string().nullable(),
  client_nom: z.string().nullable(),
  ht: schemaMontantBase,
  nb_factures: z.number(),
  du: schemaMontantBase,
  nb_devis: z.number(),
  devis_acceptes: z.number(),
});
export type StatClient = z.infer<typeof schemaStatClient>;

/** Le classement du tableau de bord : cinq clients (`computeTopClients`). */
export const TOP_CLIENTS = 5;

/**
 * Un client du classement ouvre son dossier de règlements (`ouvrirClientDepuisDashboard`) :
 * c'est ce qu'il doit qu'on vient de regarder. Le dossier se désigne par le nom
 * porté sur les pièces, comme dans le module de facturation.
 */
export function lienClient(c: Pick<StatClient, "client_nom">): string {
  return c.client_nom ? `/factures/reglements/dossier?client=${encodeURIComponent(c.client_nom)}` : "/factures/reglements";
}

// ---------- Destinations des tuiles ----------

/**
 * `DESTINATIONS_DASHBOARD` : chaque chiffre ouvre l'écran filtré comme il
 * l'annonce, et chaque destination n'est décrite qu'une fois.
 */
export const DESTINATIONS = {
  caEncaisse: "/factures/reglements/tous",
  // Ni la liste des devis, ni celle des bons, ni le planning ne lisent de filtre
  // dans l'adresse : ils s'ouvrent entiers (D-STA-07).
  devisEnAttente: "/devis",
  impayees: "/factures/reglements/par-facture?tri=reste",
  echues: "/factures/reglements/par-facture?etat=en_retard",
  aFacturer: "/facturation/a-facturer",
  aValiderDirecteur: "/facturation/validation",
  reglements: "/factures/reglements",
  aValiderConducteur: "/planning",
  planning: "/planning",
  maJournee: "/planning/ma-journee",
  pieces: "/pieces",
  sav: "/commandes",
  nouveauRapport: "/rapports/nouveau",
  nouveauDevis: "/devis/nouveau",
  nouvelleFacture: "/factures/nouvelle",
} as const;
export type Destination = keyof typeof DESTINATIONS;
