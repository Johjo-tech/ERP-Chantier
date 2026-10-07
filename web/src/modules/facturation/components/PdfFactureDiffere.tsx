import { useEffect, useRef } from "react";
import { useImprimerPiece } from "@/modules/documents/hooks/useIdentiteDocument";
import { showToast } from "@/modules/documents/impression/zone";
import { messageErreur } from "@/lib/erreurs";
import { DUREE_AVIS } from "../domain/avis";
import type { Facture } from "../domain/facture";
import { useFacture } from "../hooks/useFactures";
import { useModeleFacture, useOptionsPdfFacture } from "../hooks/useImpression";

/**
 * « Imprimer / PDF » depuis une CARTE (`printDocument('facture', id, 'save')`) :
 * la liste ne porte pas les lignes, la pièce se lit au clic, puis le PDF part
 * — le même gabarit, les mêmes options (cadenas, Factur-X) que depuis la fiche.
 * Monté le temps d'un téléchargement, il se démonte par `fini`.
 */
export function PdfFactureDiffere({ id, fini }: { id: string; fini: () => void }) {
  const facture = useFacture(id);
  useEffect(() => {
    if (!facture.isError) return;
    showToast(messageErreur(facture.error), "danger", DUREE_AVIS.refus);
    fini();
  }, [facture.isError, facture.error, fini]);
  return facture.data ? <Impression facture={facture.data} fini={fini} /> : null;
}

function Impression({ facture, fini }: { facture: Facture; fini: () => void }) {
  const { modele, erreur } = useModeleFacture(facture);
  const options = useOptionsPdfFacture(facture);
  const imprimer = useImprimerPiece();
  const parti = useRef(false);
  useEffect(() => {
    if (erreur) {
      showToast(messageErreur(erreur), "danger", DUREE_AVIS.refus);
      fini();
      return;
    }
    if (!modele || parti.current) return;
    parti.current = true;
    imprimer.mutate({ piece: modele, action: "save", avant: options.avant, apres: options.apres }, { onSettled: fini });
  }, [modele, erreur, options.avant, options.apres, imprimer, fini]);
  return null;
}
