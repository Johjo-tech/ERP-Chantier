import { useListeDevis } from "@/modules/devis/hooks/useDevis";
import { useRapports } from "@/modules/interventions/hooks/useRapports";
import type { BonDeLaListe } from "../api/bons";
import type { LiensDuBon } from "../components/CarteBon";

/**
 * Les documents que cite chaque carte, retrouvés une fois pour toute la liste :
 * bon d'origine et SAV lié parmi les bons, devis et rapport par leurs listes.
 */
export function useLiensDesBons(bons: readonly BonDeLaListe[]): (b: BonDeLaListe) => LiensDuBon {
  const devis = useListeDevis();
  const rapports = useRapports();
  const parId = new Map(bons.map((b) => [b.id, b]));
  const savPar = new Map(bons.filter((b) => b.bon_commande_parent_id).map((b) => [b.bon_commande_parent_id as string, b]));
  const devisPar = new Map((devis.data ?? []).map((d) => [d.id, d]));
  const rapportPar = new Map((rapports.data ?? []).filter((r) => r.bon_commande_id).map((r) => [r.bon_commande_id as string, r]));
  return (b) => ({
    origine: (b.bon_commande_parent_id && parId.get(b.bon_commande_parent_id)) || null,
    savLie: savPar.get(b.id) ?? null,
    devis: (b.devis_id && devisPar.get(b.devis_id)) || null,
    rapport: rapportPar.get(b.id) ?? null,
  });
}

