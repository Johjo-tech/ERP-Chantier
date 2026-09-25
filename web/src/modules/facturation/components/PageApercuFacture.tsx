import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { ApercuModele } from "@/modules/documents/components/ApercuModele";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useCadenas, useFacture } from "../hooks/useFactures";
import { useModeleFacture } from "../hooks/useImpression";
import { ActionsDocumentFacture } from "./ActionsDocumentFacture";

/**
 * La facture imprimable — le MÊME modèle que le PDF (FAC-10) : émetteur figé
 * prioritaire, devis d'origine, facture rectifiée, IBAN/BIC selon le réglage,
 * mentions légales sur facture seulement, pied légal.
 */
export function PageApercuFacture() {
  const { id } = useParams();
  const facture = useFacture(id);
  const { modele, erreur } = useModeleFacture(facture.data ?? null);
  const { poser } = useCadenas(id ?? "");
  if (facture.isPending) return <Chargement />;
  if (facture.isError) return <Erreur erreur={facture.error} reessayer={() => void facture.refetch()} />;
  const f = facture.data;

  return (
    <GardeSociete societeId={f.societe_id} retour="/factures">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button
          disabled={!modele}
          onClick={() => {
            // Imprimer un brouillon, c'est le remettre : il reçoit son cadenas d'abord (FAC-12).
            if (!f.numero && !f.verrouillee) poser.mutate(f.client_id, { onSuccess: () => window.print() });
            else window.print();
          }}
        >
          Imprimer
        </Button>
        <ActionsDocumentFacture facture={f} />
        <Button variant="ghost" asChild><Link to={`/factures/${f.id}`}>Retour à la facture</Link></Button>
      </div>
      {poser.isError && <Alert variant="erreur">{messageErreur(poser.error)}</Alert>}
      {erreur ? <Erreur erreur={erreur} /> : modele ? <ApercuModele m={modele} /> : <Chargement />}
    </GardeSociete>
  );
}
