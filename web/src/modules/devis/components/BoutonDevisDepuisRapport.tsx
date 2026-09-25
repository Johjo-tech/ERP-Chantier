import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { useDevisDepuisIntervention } from "../hooks/useDevis";

/**
 * « Créer le devis » sur un rapport d'intervention (DEV-17). Le module des
 * rapports le monte sur sa fiche ; le devis naît brouillon et s'ouvre pour
 * être chiffré.
 */
export function BoutonDevisDepuisRapport({ interventionId }: { interventionId: string }) {
  const navigate = useNavigate();
  const reglages = useReglages();
  const creer = useDevisDepuisIntervention();
  return (
    <Can module="devis" action="creer">
      <Button
        variant="outline"
        disabled={creer.isPending}
        onClick={() =>
          creer.mutate(
            { interventionId, tvaDefaut: (reglages.data ?? REGLAGES_DEFAUT).tvaDefaut },
            { onSuccess: (id) => void navigate(`/devis/${id}`, { state: { message: "Devis créé depuis le rapport : chiffrez les lignes." } }) }
          )
        }
      >
        Créer le devis
      </Button>
      {creer.isError && <Alert variant="erreur">{messageErreur(creer.error)}</Alert>}
    </Can>
  );
}
