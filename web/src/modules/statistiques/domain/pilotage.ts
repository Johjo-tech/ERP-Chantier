import { jourIso } from "@/lib/dates";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import type { Activite } from "./ancien/pilotage";

/**
 * Ce qui entoure les chiffres des tableaux de bord : quel tableau pour quel
 * rôle, où mène chaque tuile, le temps relatif. Les chiffres eux-mêmes sont
 * calculés dans `ancien/`, comme l'ancien écran (D-STA-A-01).
 */

export type GenreTableau = "technicien" | "sous_traitant" | "conducteur" | "pilotage";

/**
 * Un tableau de bord par métier (`renderDashboard`) : le sous-traitant a le
 * sien (factures prêtes, devis, impayés), le technicien sa journée, le
 * conducteur ses affaires ; le pilotage reste celui de l'administrateur, de
 * la secrétaire et de la lecture seule.
 */
export function genreDuTableau(role: RoleMembre | null): GenreTableau {
  if (role === "sous_traitant") return "sous_traitant";
  if (role === "technicien") return "technicien";
  if (role === "conducteur") return "conducteur";
  return "pilotage";
}

// ---------- Activité récente ----------

/** Où mène une ligne du fil : la pièce, ou la facture qu'un paiement règle ; rien pour un paiement sans facture retrouvée. */
export function lienActivite(a: Pick<Activite, "nature" | "id" | "factureId">): string | null {
  if (a.nature === "devis") return `/devis/${a.id}`;
  if (a.nature === "rapport") return `/rapports/${a.id}`;
  return a.factureId ? `/factures/${a.factureId}` : null;
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

/**
 * Un client du classement ouvre son dossier de règlements (`ouvrirClientDepuisDashboard`) :
 * c'est ce qu'il doit qu'on vient de regarder. Le dossier se désigne par le nom
 * porté sur les pièces, comme dans le module de facturation.
 */
export function lienClient(nom: string): string {
  return nom ? `/factures/reglements/dossier?client=${encodeURIComponent(nom)}` : "/factures/reglements";
}

// ---------- Destinations des tuiles ----------

/**
 * `DESTINATIONS_DASHBOARD` : chaque chiffre ouvre l'écran filtré comme il
 * l'annonce, et chaque destination n'est décrite qu'une fois.
 */
export const DESTINATIONS = {
  caEncaisse: "/factures/reglements/tous",
  // Les listes lisent leurs filtres dans l'adresse (D-CLI-10) : la tuile ouvre ce qu'elle compte.
  devisEnAttente: "/devis?statut=envoy%C3%A9",
  impayees: "/factures/reglements/par-facture?tri=reste",
  echues: "/factures/reglements/par-facture?etat=en_retard",
  aFacturer: "/facturation/a-facturer",
  aValiderDirecteur: "/facturation/validation",
  reglements: "/factures/reglements",
  aValiderConducteur: "/planning",
  planning: "/planning",
  maJournee: "/planning/ma-journee",
  pieces: "/pieces",
  sav: "/commandes?type=sav",
  nouveauRapport: "/rapports/nouveau",
  nouveauDevis: "/devis/nouveau",
  nouvelleFacture: "/factures/nouvelle",
} as const;
export type Destination = keyof typeof DESTINATIONS;

/**
 * Le tableau de bord d'un conducteur rattaché à sa fiche ouvre SES bons (par son id
 * sur la liste des bons, par son nom sur le planning, qui filtre ainsi) :
 * le filtre de conducteur s'ajoute à la destination. Sans fiche, l'écran
 * entier — le tableau le dit déjà (« toute la société »).
 */
export function pourLeConducteur(destination: string, valeur: string | null | undefined, cle: "conducteur" | "conducteurId"): string {
  if (!valeur) return destination;
  const [chemin, requete = ""] = destination.split("?");
  const params = new URLSearchParams(requete);
  params.set(cle, valeur);
  return `${chemin}?${params.toString()}`;
}
