import { useQuery } from "@tanstack/react-query";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { listerBons } from "@/modules/commandes/api/bons";
import { aFacturer, fileValidation } from "@/modules/commandes/domain/files";
import { clesBons } from "@/modules/commandes/hooks/useBons";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { useFacturesEcran } from "./useEcranFactures";

/**
 * Les comptes des sous-onglets de Facturation, et `pret` quand ils sont
 * arrivés : leurs libellés allongés font passer la barre à la ligne sur
 * téléphone, ce qui déplace tout ce qui est dessous (la fiche facture attend
 * ce moment pour défiler jusqu'au formulaire). `isLoading`, pas `isPending` :
 * la requête des bons, que certains rôles ne lancent pas, resterait sinon
 * « en attente ».
 */
export function useComptesFacturation() {
  const s = useSocieteActive();
  const voitBons = usePermission("bons_commande", "voir");
  const voitReglements = usePermission("reglements", "voir");
  const factures = useFacturesEcran();
  const bons = useQuery({ queryKey: clesBons.liste(s.id), queryFn: () => listerBons(s.id), enabled: voitBons });
  return {
    voitBons,
    voitReglements,
    avoirs: (factures.data ?? []).filter((f) => estAvoir(f.type_document)).length,
    enValidation: fileValidation(bons.data ?? []).length,
    aFacturer: aFacturer(bons.data ?? []).length,
    pret: !factures.isLoading && !bons.isLoading,
  };
}
