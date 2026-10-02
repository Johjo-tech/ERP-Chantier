import { FRAICHEUR_REFERENCE_MS } from "@/lib/durees";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { lireIdentiteDocument } from "../api/identite";
import type { ActionPdf } from "../impression/pdf";
import { imprimerPiece, type PieceImprimee } from "../impression/zone";

export function useIdentiteDocument() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["identite-document", societe.id], queryFn: () => lireIdentiteDocument(societe.id), staleTime: FRAICHEUR_REFERENCE_MS });
}

/**
 * Fabrique et remet le PDF, comme l'ancien (`printDocument`). `avant` passe
 * d'abord — c'est là qu'une facture brouillon reçoit son cadenas (FAC-12) : le
 * document ne part pas si le cadenas n'a pas pu être posé. `apres` transforme
 * le fichier rendu avant sa remise — une facture numérotée y reçoit son XML
 * Factur-X (EFA-04).
 */
export function useImprimerPiece() {
  return useMutation({
    mutationFn: ({ piece, action, avant, apres }: { piece: PieceImprimee; action: ActionPdf; avant?: (() => Promise<void>) | undefined; apres?: ((pdf: Blob) => Promise<Blob>) | undefined }) =>
      imprimerPiece(piece, action, { avant, apres }),
    // L'échec est déjà dit par l'avis de l'ancien ; la trace reste pour qui cherche.
    onError: (e) => console.error("Pièce non imprimée", e),
  });
}
