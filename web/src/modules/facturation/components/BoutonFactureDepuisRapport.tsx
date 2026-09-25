import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { useFactureDepuisIntervention } from "../hooks/useFactures";

/**
 * « Créer la facture » sur un rapport d'intervention (FAC-15). Le module des
 * rapports le monte sur sa fiche ; la facture naît brouillon, préconisations en
 * lignes à chiffrer.
 */
export function BoutonFactureDepuisRapport({ interventionId }: { interventionId: string }) {
  const navigate = useNavigate();
  const reglages = useReglages();
  const creer = useFactureDepuisIntervention();
  return (
    <Can module="factures" action="creer">
      <Button
        variant="outline"
        disabled={creer.isPending}
        onClick={() =>
          creer.mutate(
            { interventionId, tvaDefaut: (reglages.data ?? REGLAGES_DEFAUT).tvaDefaut },
            { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Facture créée en brouillon depuis le rapport : chiffrez les lignes." } }) }
          )
        }
      >
        Créer la facture
      </Button>
      {creer.isError && <Alert variant="erreur">{messageErreur(creer.error)}</Alert>}
    </Can>
  );
}
