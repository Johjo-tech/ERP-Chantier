import { useState } from "react";
import { useLocation, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { lireFichierRetenu, lirePreRemplissage } from "../domain/bon";
import { useBon } from "../hooks/useBons";
import { useDefilerVersLeFormulaire } from "../hooks/useDefilerVersLeFormulaire";
import { FormulaireBon } from "./FormulaireBon";
import { PanneauCircuit } from "./PanneauCircuit";

/** « Brouillon enregistré à 10:42 », laissé par la création d'un brouillon qui a ouvert sa fiche. */
function lireHorodatage(etat: unknown): string | null {
  return typeof etat === "object" && etat !== null && "brouillon" in etat && typeof etat.brouillon === "string" ? etat.brouillon : null;
}

/**
 * Le formulaire d'un bon, dans la page de la liste (`renderBonsCommande` quand
 * le formulaire est ouvert : l'en-tête sans ses boutons, sans les filtres),
 * puis son circuit (D-BC-03). À la création, la lecture automatique peut
 * préremplir par `location.state.prefill` et laisser le document lu dans
 * `location.state.fichier`.
 */
export function PageBonCommande({ ChampReference }: { ChampReference?: ChampReferenceLigne }) {
  const { id } = useParams();
  const location = useLocation();
  const bon = useBon(id);
  const reglages = useReglages();
  // Après un brouillon, la fiche RELUE remonte le formulaire : les lignes insérées prennent leur uuid (relecture 3, M12).
  // La relecture est attendue ICI, dans le parent qui ne se démonte pas (relecture 4, B1).
  const [generation, setGeneration] = useState<{ n: number; horodatage: string | null }>({ n: 0, horodatage: null });
  useDefilerVersLeFormulaire(id, !(id && bon.isPending) && !reglages.isPending);
  if ((id && bon.isPending) || reglages.isPending) return <Chargement />;
  if (id && bon.isError) return <Erreur erreur={bon.error} reessayer={() => void bon.refetch()} />;
  return (
    <>
      <EnTetePage titre="Bons de commande" />
      <div id="formZoneBonCommande">
        <FormulaireBon
          key={`${id ?? "nouveau"}-${generation.n}`}
          bon={bon.data ?? null}
          prefill={id ? null : lirePreRemplissage(location.state)}
          fichierLu={id ? null : lireFichierRetenu(location.state)}
          reglages={reglages.data ?? REGLAGES_DEFAUT}
          ChampReference={ChampReference}
          horodatage={generation.horodatage ?? lireHorodatage(location.state)}
          onBrouillon={async (h) => {
            await bon.refetch();
            setGeneration((g) => ({ n: g.n + 1, horodatage: h }));
          }}
        />
      </div>
      {bon.data && <PanneauCircuit bon={bon.data} />}
    </>
  );
}
