import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import type { ModeleDocument } from "../domain/modele";
import { useTelechargerPdf } from "../hooks/useIdentiteDocument";

/** « Télécharger le PDF » ; en cas d'échec, l'impression du navigateur reste le recours. */
export function BoutonPdf({ modele, avant, libelle = "Télécharger le PDF" }: { modele: ModeleDocument | null; avant?: () => Promise<void>; libelle?: string }) {
  const pdf = useTelechargerPdf();
  return (
    <>
      <Button variant="outline" disabled={!modele || pdf.isPending} onClick={() => modele && pdf.mutate({ modele, avant })}>
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
