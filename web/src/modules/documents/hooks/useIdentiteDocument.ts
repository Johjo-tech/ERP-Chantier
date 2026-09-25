import { useMutation, useQuery } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { lireIdentiteDocument } from "../api/identite";
import type { ModeleDocument } from "../domain/modele";
import { genererPdf } from "../pdf/rendu";
import { telechargerBlob } from "../pdf/telecharger";

export function useIdentiteDocument() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["identite-document", societe.id], queryFn: () => lireIdentiteDocument(societe.id), staleTime: 5 * 60_000 });
}

/**
 * Fabrique et remet le PDF. `avant` passe d'abord — c'est là qu'une facture
 * brouillon reçoit son cadenas (FAC-12) : le document ne part pas si le
 * cadenas n'a pas pu être posé.
 */
export function useTelechargerPdf() {
  return useMutation({
    mutationFn: async ({ modele, avant }: { modele: ModeleDocument; avant?: (() => Promise<void>) | undefined }) => {
      if (avant) await avant();
      telechargerBlob(await genererPdf(modele), modele.nomFichier);
    },
  });
}
