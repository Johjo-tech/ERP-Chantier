import { usePermission, useSession } from "@/modules/auth-roles/hooks/useSession";
import { ecritSurLeTerrain } from "../domain/droits";
import { usePeutVoirDpgf } from "./useChantiers";

/** Ce que la fiche montre à chacun, selon la matrice et `peut_ecrire()` (miroirs : la RLS tranche). */
export function useDroitsChantier() {
  const role = useSession().roleEffectif;
  return {
    /** DPGF, achats, devis complémentaires, affectations : « chantiers / modifier » (et les prix). */
    gere: usePeutVoirDpgf(),
    modifie: usePermission("chantiers", "modifier"),
    terrain: ecritSurLeTerrain(role),
    crCreer: usePermission("rapports", "creer"),
    crModifier: usePermission("rapports", "modifier"),
    crSupprimer: usePermission("rapports", "supprimer"),
  };
}
