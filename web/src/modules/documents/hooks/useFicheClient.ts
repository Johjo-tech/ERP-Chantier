import { useClients } from "@/modules/clients/hooks/useClients";
import type { FicheClientImprimable } from "../impression/gabarit";
import { ficheClientDuDocument } from "../impression/pieces";

/**
 * La fiche que le bloc « Client » d'une pièce imprimée lit (2c21745) : le code
 * postal et la ville n'étant pas figés sur la pièce, on attend la liste avant
 * de rendre — sinon le PDF partirait sans commune. Une liste illisible ne
 * bloque pas l'impression : la pièce sort avec sa rue seule, comme l'ancien
 * quand `state.clients` ne portait pas le client.
 */
export function useFicheClientImprimable(nom: string | null | undefined): { fiche: FicheClientImprimable | null; pret: boolean } {
  const clients = useClients();
  return { fiche: ficheClientDuDocument(clients.data, nom), pret: !clients.isPending };
}
