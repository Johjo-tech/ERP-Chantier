import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { messageErreur } from "@/lib/erreurs";
import { deposerFacture, DepotImpossible, preparerEmission } from "../api/emission";
import { versCII } from "../domain/cii";
import { pdfFacturX } from "../pdf/facturx";

export interface ResultatFacturX {
  fichier: Blob;
  /** Vrai si la facture structurée a bien été embarquée. */
  structuree: boolean;
  /** Ce qui a empêché de le faire, en clair. */
  manques: string[];
}

/**
 * Enrichit le PDF d'une facture numérotée. **Rend toujours un fichier** : un
 * client sans SIRET ou une société sans SIREN ne doit jamais priver quelqu'un
 * de sa facture — le PDF simple part, et le motif est dit (facturx-pont.ts).
 */
export async function enrichirFacturX(pdf: Blob, factureId: string): Promise<ResultatFacturX> {
  try {
    const { charge, manques } = await preparerEmission(factureId);
    // Une facture incomplète n'est pas une facture électronique : on ne l'habille pas d'un XML qui serait rejeté.
    if (manques.length) return { fichier: pdf, structuree: false, manques: manques.map((m) => m.libelle) };
    const en = charge.en_invoice;
    const fichier = await pdfFacturX(pdf, versCII(charge), { numero: String(en.number), date: String(en.issue_date) });
    return { fichier, structuree: true, manques: [] };
  } catch (e) {
    console.error("Facture électronique non embarquée", e);
    return { fichier: pdf, structuree: false, manques: [e instanceof Error ? e.message : "erreur inconnue"] };
  }
}

/** Le refus de la plateforme est déjà rédigé pour l'écran ; le reste passe par la traduction commune. */
export function messageDepot(e: unknown): string {
  return e instanceof DepotImpossible ? e.message : messageErreur(e);
}

/** Dépose la facture sur la plateforme ; la fiche et les listes se relisent ensuite. */
export function useDeposerFacture(factureId: string) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deposerFacture(factureId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["facture", factureId] });
      void qc.invalidateQueries({ queryKey: ["factures", societe.id] });
    },
  });
}
