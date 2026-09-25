import { imprimerZonePaysage } from "@/modules/documents/impression/zone";
import { useOptionsFeries } from "@/modules/societes/hooks/useFeries";
import { dansLaPlage, estFerie, joursDeLaSemaine } from "../domain/calendrier";
import type { CartePlanning } from "../domain/cartes";
import type { Affectation } from "../domain/filtres";
import { htmlPlanningImprime } from "../domain/impression";

const NON_ASSIGNE = "Non assigné";

export interface PlanningImprimable {
  cartes: CartePlanning[];
  lundi: string;
  societe: string;
  affectation: Affectation;
  nomEquipe: (id: string | null) => string | null;
  nomSousTraitant: (id: string | null) => string | null;
}

/**
 * « 🖨️ Imprimer » du planning (PLN-11) : la semaine en paysage, une colonne
 * par équipe (ou sous-traitant) ayant du travail, une ligne par jour — le HTML
 * et la zone d'impression de l'ancien (`printPlanning`).
 */
export function useImpressionPlanning({ cartes, lundi, societe, affectation, nomEquipe, nomSousTraitant }: PlanningImprimable): () => void {
  const feries = useOptionsFeries();
  return () => {
    const jours = joursDeLaSemaine(lundi);
    const semaine = cartes.filter((c) => jours.some((j) => dansLaPlage(j.iso, c.rdv.datePlanifiee, c.rdv.datePlanifieeFin)));
    const colonneDe = (c: CartePlanning) => (affectation === "sous_traitant" ? nomSousTraitant(c.sousTraitantId) : nomEquipe(c.equipeId)) ?? NON_ASSIGNE;
    const colonnes = [...new Set(semaine.map(colonneDe))].sort((a, b) => (a === NON_ASSIGNE ? 1 : b === NON_ASSIGNE ? -1 : a.localeCompare(b, "fr")));
    if (!colonnes.length) colonnes.push(NON_ASSIGNE);
    const html = htmlPlanningImprime({
      societeNom: societe,
      sousTraitants: affectation === "sous_traitant",
      jours,
      colonnes,
      estFerie: (iso) => estFerie(iso, feries),
      travaux: (iso, col) =>
        semaine
          .filter((c) => dansLaPlage(iso, c.rdv.datePlanifiee, c.rdv.datePlanifieeFin) && colonneDe(c) === col)
          .sort((a, b) => (a.rdv.heurePlanifiee ?? "").localeCompare(b.rdv.heurePlanifiee ?? ""))
          .map((c) => ({ client: c.bon.client_nom, adresse: c.bon.adresse, codePostal: c.bon.code_postal, ville: c.bon.ville, metier: c.metier, heurePlanifiee: c.rdv.heurePlanifiee })),
    });
    void imprimerZonePaysage(html).catch((e: unknown) => console.error("Planning non imprimé", e));
  };
}
