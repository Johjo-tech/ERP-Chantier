import { correspond } from "@/lib/recherche";
import type { EnteteBon } from "./bon";
import { modeDuBon, type ModeBon } from "./regles";

export interface FiltresBons {
  recherche: string;
  type: "" | "bc" | "sav";
  mode: "" | ModeBon;
  conducteurId: string;
}

export const FILTRES_VIDES: FiltresBons = { recherche: "", type: "", mode: "", conducteurId: "" };

/** Filtres de la liste (BC-01) : un SAV est un bon qui a un bon d'origine. */
export function filtrerBons<B extends EnteteBon>(bons: readonly B[], f: FiltresBons): B[] {
  return bons.filter(
    (b) =>
      correspond(f.recherche, b.numero_interne, b.numero_bc, b.client_nom, b.interlocuteur, b.adresse, b.ville, b.nature_travaux, b.reference_chantier, b.conducteur) &&
      (!f.type || (f.type === "sav") === (b.bon_commande_parent_id !== null)) &&
      (!f.mode || modeDuBon(b) === f.mode) &&
      (!f.conducteurId || b.conducteur_id === f.conducteurId)
  );
}

/** Les conducteurs présents sur les bons, pour le filtre : on ne propose que ce qui peut répondre. */
export function conducteursDesBons(bons: readonly EnteteBon[]): { id: string; nom: string }[] {
  const vus = new Map<string, string>();
  for (const b of bons) if (b.conducteur_id) vus.set(b.conducteur_id, b.conducteur ?? "Conducteur sans nom");
  return [...vus.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
