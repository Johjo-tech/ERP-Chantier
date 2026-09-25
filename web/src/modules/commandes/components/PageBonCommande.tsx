import { useState } from "react";
import { useLocation, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { lireFichierRetenu, lirePreRemplissage } from "../domain/bon";
import { useBon } from "../hooks/useBons";
import { FormulaireBon } from "./FormulaireBon";
import { PanneauCircuit } from "./PanneauCircuit";

/** Le message laissé par l'écran précédent (création réussie, ou enregistrement partiel à signaler). */
function lireMessage(etat: unknown): { texte: string; alerte: boolean } | null {
  if (typeof etat !== "object" || etat === null || !("message" in etat) || typeof etat.message !== "string") return null;
  return { texte: etat.message, alerte: "alerte" in etat && etat.alerte === true };
}

/**
 * Fiche et formulaire d'un bon, puis son circuit. À la création, la lecture
 * automatique peut préremplir par `location.state.prefill` et laisser le
 * document lu dans `location.state.fichier`.
 */
export function PageBonCommande({ ChampReference }: { ChampReference?: ChampReferenceLigne }) {
  const { id } = useParams();
  const location = useLocation();
  const bon = useBon(id);
  const reglages = useReglages();
  // Après un enregistrement, la fiche RELUE remonte le formulaire : les lignes insérées prennent leur uuid (relecture 3, M12).
  // La relecture est attendue ICI, dans le parent qui ne se démonte pas, et non dans la mutation : remonter
  // le formulaire avant son retour le reconstruirait sur l'état d'AVANT, qu'un second « Enregistrer »
  // réécrirait par-dessus (relecture 4, B1).
  const [generation, setGeneration] = useState<{ n: number; message: string | null }>({ n: 0, message: null });
  if ((id && bon.isPending) || reglages.isPending) return <Chargement />;
  if (id && bon.isError) return <Erreur erreur={bon.error} reessayer={() => void bon.refetch()} />;
  const prefill = id ? null : lirePreRemplissage(location.state);
  const message = generation.message ? { texte: generation.message, alerte: false } : lireMessage(location.state);
  return (
    <div className="flex flex-col gap-4">
      <FormulaireBon
        key={`${id ?? "nouveau"}-${generation.n}`}
        bon={bon.data ?? null}
        prefill={prefill}
        fichierLu={id ? null : lireFichierRetenu(location.state)}
        reglages={reglages.data ?? REGLAGES_DEFAUT}
        ChampReference={ChampReference}
        messageInitial={message}
        onEnregistre={async (m) => {
          await bon.refetch();
          setGeneration((g) => ({ n: g.n + 1, message: m }));
        }}
      />
      {bon.data && <PanneauCircuit bon={bon.data} />}
    </div>
  );
}
