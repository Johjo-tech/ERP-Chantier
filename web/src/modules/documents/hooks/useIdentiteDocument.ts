import { FRAICHEUR_REFERENCE_MS } from "@/lib/durees";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { lireIdentiteDocument } from "../api/identite";
import type { ModeleDocument } from "../domain/modele";
import { genererPdf } from "../pdf/rendu";
import { telechargerBlob } from "../pdf/telecharger";

export function useIdentiteDocument() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["identite-document", societe.id], queryFn: () => lireIdentiteDocument(societe.id), staleTime: FRAICHEUR_REFERENCE_MS });
}

/**
 * Fabrique et remet le PDF. `avant` passe d'abord — c'est là qu'une facture
 * brouillon reçoit son cadenas (FAC-12) : le document ne part pas si le
 * cadenas n'a pas pu être posé. `apres` transforme le fichier rendu avant sa
 * remise — une facture numérotée y reçoit son XML Factur-X (EFA-04).
 */
export function useTelechargerPdf() {
  return useMutation({
    mutationFn: async ({ modele, avant, apres }: { modele: ModeleDocument; avant?: (() => Promise<void>) | undefined; apres?: ((pdf: Blob) => Promise<Blob>) | undefined }) => {
      if (avant) await avant();
      const pdf = await genererPdf(modele);
      telechargerBlob(apres ? await apres(pdf) : pdf, modele.nomFichier);
    },
  });
}
