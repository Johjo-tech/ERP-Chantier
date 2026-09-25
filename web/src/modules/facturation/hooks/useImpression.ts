import { useClients } from "@/modules/clients/hooks/useClients";
import { useIdentiteDocument } from "@/modules/documents/hooks/useIdentiteDocument";
import { pieceImprimee } from "@/modules/documents/impression/pieces";
import { showToast, type OptionsPiece, type PieceImprimee } from "@/modules/documents/impression/zone";
import { passeParUnePlateforme } from "@/modules/efacture/domain/cadre";
import { enrichirFacturX } from "@/modules/efacture/hooks/useEfacture";
import { useIdentite } from "@/modules/societes/hooks/useIdentite";
import type { Facture } from "../domain/facture";
import { contexteFacture } from "../domain/impression";
import { mentionsLegales } from "../domain/mentions";
import { useCadenas, useContexteImpression } from "./useFactures";

/**
 * La pièce imprimée d'une facture — le HTML de l'ancien gabarit : UNE seule
 * pour l'aperçu, le PDF et l'e-mail, ce qu'on voit est ce qui part.
 */
export function useModeleFacture(facture: Facture | null): { modele: PieceImprimee | null; erreur: unknown; chargement: boolean } {
  const doc = useIdentiteDocument();
  const mentions = useIdentite();
  const contexte = useContexteImpression(facture);
  const erreur = doc.error ?? mentions.error ?? contexte.error;
  if (!facture || !doc.data || !mentions.data || !contexte.data) return { modele: null, erreur, chargement: !erreur };
  const e = doc.data.imprimable;
  return {
    modele: pieceImprimee(contexteFacture(facture, contexte.data, e, mentionsLegales(mentions.data)), e.variables),
    erreur: null,
    chargement: false,
  };
}

/**
 * Ce qui entoure le PDF d'une facture, dans l'ordre de l'ancien (`printDocument`,
 * `lancerGenerationPdf`) : un brouillon reçoit d'abord son cadenas et l'identité
 * figée des deux parties (FAC-12) ; une facture numérotée emporte sa facture
 * structurée (Factur-X, EFA-04). Un manque n'empêche pas le téléchargement, il
 * se dit — et seulement si la pièce RELÈVE de la facture électronique : pour un
 * particulier, le PDF simple est le document normal (app.js l. 3887).
 */
export function useOptionsPdfFacture(facture: Facture): OptionsPiece {
  const clients = useClients();
  const { poser } = useCadenas(facture.id);
  const fiche = clients.data?.find((c) => c.id === facture.client_id);
  // Le cadre de la FICHE d'abord : la colonne de la facture vaut « entreprise » par défaut (app.js l. 304).
  const cadre = fiche?.cadre_facturation ?? facture.cadre_facturation;
  return {
    avant:
      !facture.numero && !facture.verrouillee
        ? async () => {
            await poser.mutateAsync(facture.client_id);
          }
        : undefined,
    apres: facture.numero
      ? async (pdf: Blob) => {
          const r = await enrichirFacturX(pdf, facture.id);
          if (!r.structuree && r.manques.length && passeParUnePlateforme({ legacy_id: facture.legacy_id, cadre_facturation: cadre })) showToast(`PDF simple : ${r.manques[0]}`);
          return r.fichier;
        }
      : undefined,
  };
}
