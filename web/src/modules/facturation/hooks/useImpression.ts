import { construireModele, type ModeleDocument } from "@/modules/documents/domain/modele";
import { useIdentiteDocument } from "@/modules/documents/hooks/useIdentiteDocument";
import { useIdentite } from "@/modules/societes/hooks/useIdentite";
import type { Facture } from "../domain/facture";
import { pieceDeFacture } from "../domain/impression";
import { mentionsLegales } from "../domain/mentions";
import { useContexteImpression } from "./useFactures";

/**
 * Le modèle imprimable d'une facture : UN seul pour l'aperçu, le PDF et
 * l'e-mail — ce qu'on voit est ce qui part.
 */
export function useModeleFacture(facture: Facture | null): { modele: ModeleDocument | null; erreur: unknown; chargement: boolean } {
  const doc = useIdentiteDocument();
  const mentions = useIdentite();
  const contexte = useContexteImpression(facture);
  const erreur = doc.error ?? mentions.error ?? contexte.error;
  if (!facture || !doc.data || !mentions.data || !contexte.data) return { modele: null, erreur, chargement: !erreur };
  return {
    modele: construireModele(pieceDeFacture(facture, contexte.data), doc.data.identite, doc.data.reglages, mentionsLegales(mentions.data)),
    erreur: null,
    chargement: false,
  };
}
