import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import type { ModeleDocument } from "../domain/modele";
import { useTelechargerPdf } from "../hooks/useIdentiteDocument";

interface Props {
  modele: ModeleDocument | null;
  avant?: () => Promise<void>;
  /** Transforme le PDF rendu avant sa remise (Factur-X d'une facture émise). */
  apres?: (pdf: Blob) => Promise<Blob>;
  libelle?: string;
}

/** « Télécharger le PDF » ; en cas d'échec, l'impression du navigateur reste le recours. */
export function BoutonPdf({ modele, avant, apres, libelle = "Télécharger le PDF" }: Props) {
  const pdf = useTelechargerPdf();
  return (
    <>
      <Button variant="outline" disabled={!modele || pdf.isPending} onClick={() => modele && pdf.mutate({ modele, avant, apres })}>
        {pdf.isPending ? "Préparation du PDF…" : libelle}
      </Button>
      {pdf.isError && (
        <Alert variant="erreur">
          Impossible de produire le PDF ({messageErreur(pdf.error)}). Utilisez « Imprimer » (Ctrl+P / Cmd+P) pour l'enregistrer depuis le navigateur.
        </Alert>
      )}
    </>
  );
}
