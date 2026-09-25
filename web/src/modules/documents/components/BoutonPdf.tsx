import { Button } from "@/components/ui/button";
import type { PieceImprimee } from "../impression/zone";
import { useImprimerPiece } from "../hooks/useIdentiteDocument";

interface Props {
  piece: PieceImprimee | null;
  avant?: (() => Promise<void>) | undefined;
  /** Transforme le PDF rendu avant sa remise (Factur-X d'une facture émise). */
  apres?: ((pdf: Blob) => Promise<Blob>) | undefined;
  libelle?: string;
}

/**
 * « Imprimer / PDF » des listes de l'ancien (app.js l. 4578, 5827) : le PDF
 * s'enregistre (`printDocument(…, 'save')`). L'avancement et l'échec se disent
 * par l'avis de l'ancien (`#toastBox`), mot pour mot.
 */
export function BoutonPdf({ piece, avant, apres, libelle = "Imprimer / PDF" }: Props) {
  const imprimer = useImprimerPiece();
  return (
    <Button variant="outline" disabled={!piece || imprimer.isPending} onClick={() => piece && imprimer.mutate({ piece, action: "save", avant, apres })}>
      {libelle}
    </Button>
  );
}
