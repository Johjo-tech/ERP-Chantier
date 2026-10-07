import { useEffect, useRef } from "react";
import { messageErreur } from "@/lib/erreurs";
import { useImprimerPiece } from "@/modules/documents/hooks/useIdentiteDocument";
import { showToast } from "@/modules/documents/impression/zone";
import { DUREE_AVIS } from "@/modules/facturation/domain/avis";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { Devis } from "../domain/devis";
import { useDevis, useModeleDevis } from "../hooks/useDevis";

/**
 * « Imprimer / PDF » depuis une carte de devis (`printDocument('devis', id,
 * 'save')`) : la liste ne porte pas les lignes, le devis se lit au clic, puis
 * le PDF part — le même gabarit que depuis la fiche. Monté le temps d'un
 * téléchargement.
 */
export function PdfDevisDiffere({ id, fini }: { id: string; fini: () => void }) {
  const devis = useDevis(id);
  useEffect(() => {
    if (!devis.isError) return;
    showToast(messageErreur(devis.error), "danger", DUREE_AVIS.refus);
    fini();
  }, [devis.isError, devis.error, fini]);
  return devis.data ? <Impression devis={devis.data} fini={fini} /> : null;
}

function Impression({ devis, fini }: { devis: Devis; fini: () => void }) {
  const reglages = useReglages();
  const modele = useModeleDevis(devis, (reglages.data ?? REGLAGES_DEFAUT).validiteDevisJours);
  const imprimer = useImprimerPiece();
  const parti = useRef(false);
  useEffect(() => {
    if (!modele || parti.current) return;
    parti.current = true;
    imprimer.mutate({ piece: modele, action: "save" }, { onSettled: fini });
  }, [modele, imprimer, fini]);
  return null;
}
