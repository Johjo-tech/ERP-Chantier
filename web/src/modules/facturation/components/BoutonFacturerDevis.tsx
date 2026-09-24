import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { useFactureDepuisDevis } from "../hooks/useFactures";

/** Devis → facture brouillon préremplie (refusée si le devis est déjà facturé). */
export function BoutonFacturerDevis({ devisId }: { devisId: string }) {
  const navigate = useNavigate();
  const facturer = useFactureDepuisDevis();
  return (
    <Can module="factures" action="creer">
      <Button
        variant="outline"
        disabled={facturer.isPending}
        onClick={() => facturer.mutate(devisId, { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Facture créée en brouillon depuis le devis." } }) })}
      >
        Créer la facture
      </Button>
      {facturer.isError && <Alert variant="erreur">{messageErreur(facturer.error)}</Alert>}
    </Can>
  );
}
