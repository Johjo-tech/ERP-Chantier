import { FRAICHEUR_REFERENCE_MS } from "@/lib/durees";
import { useQuery } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { listerConducteurs, type Conducteur } from "../api/conducteurs";

export function useConducteurs() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["conducteurs", societe.id], queryFn: () => listerConducteurs(societe.id), staleTime: FRAICHEUR_REFERENCE_MS });
}

/**
 * Options d'un sélecteur de conducteur : les actifs, plus celui déjà attribué
 * même s'il a été retiré — marqué « (retiré) », comme dans l'ancien écran.
 */
export function optionsConducteurs(liste: readonly Conducteur[], courant: string | null) {
  return liste
    .filter((c) => c.actif || c.id === courant)
    .map((c) => ({ valeur: c.id, libelle: c.actif ? c.nom : `${c.nom} (retiré)` }));
}
