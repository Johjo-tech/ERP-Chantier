import { useNavigate, useParams } from "react-router";
import { Alert } from "@/components/ui/alert";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { actionsFacturation } from "../domain/circuit";
import { PageBonsCommande } from "./PageBonsCommande";

/**
 * L'adresse d'une pré-facture : la liste des bons, la fenêtre de pré-facture
 * ouverte par-dessus (D-ECR-BC-11) — comme l'ancien, qui ne l'ouvrait que
 * depuis une carte. La refermer rend la liste.
 */
export function PagePrefacture() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { roleEffectif } = useSession();
  const prix = useVoitLesPrix();
  if (!prix || !actionsFacturation(roleEffectif).peutModifierPrefacture) return <Alert>La pré-facture se chiffre depuis un compte administrateur ou secrétariat.</Alert>;
  return <PageBonsCommande prefacture={id ?? null} onFermerPrefacture={() => void navigate("/commandes", { replace: true })} />;
}
