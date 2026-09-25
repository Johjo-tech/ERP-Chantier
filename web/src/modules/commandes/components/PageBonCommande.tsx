import { useLocation, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { lirePreRemplissage } from "../domain/bon";
import { useBon } from "../hooks/useBons";
import { FormulaireBon } from "./FormulaireBon";

/**
 * Fiche et formulaire d'un bon. À la création, un autre écran (lecture
 * automatique d'un bon) peut préremplir par `location.state.prefill`.
 */
export function PageBonCommande({ ChampReference }: { ChampReference?: ChampReferenceLigne }) {
  const { id } = useParams();
  const location = useLocation();
  const bon = useBon(id);
  const reglages = useReglages();
  if ((id && bon.isPending) || reglages.isPending) return <Chargement />;
  if (id && bon.isError) return <Erreur erreur={bon.error} reessayer={() => void bon.refetch()} />;
  const prefill = id ? null : lirePreRemplissage(location.state);
  return (
    <FormulaireBon
      key={id ?? "nouveau"}
      bon={bon.data ?? null}
      prefill={prefill}
      reglages={reglages.data ?? REGLAGES_DEFAUT}
      ChampReference={ChampReference}
      messageInitial={(location.state as { message?: string } | null)?.message ?? null}
    />
  );
}
