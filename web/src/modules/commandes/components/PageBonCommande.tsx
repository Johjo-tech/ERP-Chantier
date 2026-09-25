import { useLocation, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { lirePreRemplissage } from "../domain/bon";
import { useBon } from "../hooks/useBons";
import { FormulaireBon } from "./FormulaireBon";

/** Le message laissé par l'écran précédent (création réussie, ou enregistrement partiel à signaler). */
function lireMessage(etat: unknown): { texte: string; alerte: boolean } | null {
  if (typeof etat !== "object" || etat === null || !("message" in etat) || typeof etat.message !== "string") return null;
  return { texte: etat.message, alerte: "alerte" in etat && etat.alerte === true };
}

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
      messageInitial={lireMessage(location.state)}
    />
  );
}
