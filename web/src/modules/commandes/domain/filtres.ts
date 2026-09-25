import { correspond } from "@/lib/recherche";
import type { StatutLogement } from "@/modules/documents/domain/logement";
import type { EnteteBon } from "./bon";
import { memeMetier, metiersDuBon, referentielMetiers } from "./metiers";
import { modeDuBon, type ModeBon } from "./regles";

export interface FiltresBons {
  recherche: string;
  type: "" | "bc" | "sav";
  mode: "" | ModeBon;
  conducteurId: string;
  logement: "" | StatutLogement;
  metier: string;
  client: string;
  interlocuteur: string;
}

export const FILTRES_VIDES: FiltresBons = { recherche: "", type: "", mode: "", conducteurId: "", logement: "", metier: "", client: "", interlocuteur: "" };

/** Ce que la ligne d'un bon porte elle-même, pour la recherche et pour dire d'où vient une correspondance. */
export function champsCherchesDuBon(b: EnteteBon): (string | null)[] {
  return [b.numero_interne, b.numero_bc, b.client_nom, b.interlocuteur, b.adresse, b.ville, b.nature_travaux, b.reference_chantier, b.conducteur, b.occupant, b.numero_logement, ...metiersDuBon(b)];
}

/**
 * Les huit filtres de la liste (BC-01, bonCommandeItemRetenu) : un SAV est un bon qui a un bon d'origine.
 * `apports` : ce que le bon ne porte pas mais qu'on tape pour le retrouver — son montant, ses factures (TRV-06, TRV-07).
 */
export function filtrerBons<B extends EnteteBon>(bons: readonly B[], f: FiltresBons, apports: (b: B) => readonly string[] = () => []): B[] {
  return bons.filter(
    (b) =>
      correspond(f.recherche, ...champsCherchesDuBon(b), ...apports(b)) &&
      (!f.type || (f.type === "sav") === (b.bon_commande_parent_id !== null)) &&
      (!f.mode || modeDuBon(b) === f.mode) &&
      (!f.conducteurId || b.conducteur_id === f.conducteurId) &&
      (!f.logement || b.logement_statut === f.logement) &&
      (!f.metier || metiersDuBon(b).some((m) => memeMetier(m, f.metier))) &&
      (!f.client || b.client_nom === f.client) &&
      (!f.interlocuteur || b.interlocuteur === f.interlocuteur)
  );
}

/** Les conducteurs présents sur les bons, pour le filtre : on ne propose que ce qui peut répondre. */
export function conducteursDesBons(bons: readonly EnteteBon[]): { id: string; nom: string }[] {
  const vus = new Map<string, string>();
  for (const b of bons) if (b.conducteur_id) vus.set(b.conducteur_id, b.conducteur ?? "Conducteur sans nom");
  return [...vus.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

const distincts = (valeurs: readonly (string | null)[]) => [...new Set(valeurs.filter((v): v is string => !!v && v.trim() !== ""))].sort((a, b) => a.localeCompare(b, "fr"));

/** Les valeurs proposées par les filtres : celles que portent les bons, jamais une liste qui ne trouverait rien. */
export function valeursDeFiltre(bons: readonly EnteteBon[]) {
  return {
    metiers: referentielMetiers([], bons.flatMap((b) => metiersDuBon(b))),
    clients: distincts(bons.map((b) => b.client_nom)),
    interlocuteurs: distincts(bons.map((b) => b.interlocuteur)),
  };
}
