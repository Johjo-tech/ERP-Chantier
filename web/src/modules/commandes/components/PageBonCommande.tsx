import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { lireFichierRetenu, lirePreRemplissage } from "../domain/bon";
import { useBon } from "../hooks/useBons";
import { useLectureDuBon } from "../hooks/useLectureDuBon";
import { EcranLecture } from "@/modules/ocr/components/EcranLecture";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import { useDefilerVersLeFormulaire } from "../hooks/useDefilerVersLeFormulaire";
import { FormulaireBon } from "./FormulaireBon";
import { PanneauCircuit } from "./PanneauCircuit";

/** Le document à lire, confié par le bouton « 📄 Importer un BC » de la liste. */
function lireFichierALire(etat: unknown): File | null {
  const f = typeof etat === "object" && etat !== null && "lire" in etat ? etat.lire : null;
  return f instanceof File ? f : null;
}

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
  const ocr = useFonctionnalite("ocr");
  const lire = useLectureDuBon();
  // Le document confié par la liste est lu UNE fois, dès l'ouverture : on ne le redemande pas.
  const confie = useRef(false);
  const aLire = id ? null : lireFichierALire(location.state);
  useEffect(() => {
    if (!aLire || confie.current || !ocr) return;
    confie.current = true;
    lire.lancer(aLire);
  }, [aLire, ocr, lire]);
  if ((id && bon.isPending) || reglages.isPending || (!id && lire.enAttenteDesClients)) return <Chargement />;
  if (id && bon.isError) return <Erreur erreur={bon.error} reessayer={() => void bon.refetch()} />;
  if (!id && (lire.enCours || lire.issue)) {
    return (
      <>
        <EnTetePage titre="Bons de commande" />
        <div id="formZoneBonCommande">
          <EcranLecture nom={lire.nom} etape={lire.etape} ecoule={lire.ecoule} issue={lire.issue} onAnnuler={lire.annuler} onReessayer={lire.lancer} onSaisirALaMain={lire.saisirALaMain} />
        </div>
      </>
    );
  }
  const lu = id ? null : lire.aboutie;
  return (
    <>
      <EnTetePage titre="Bons de commande" />
      <div id="formZoneBonCommande">
        <FormulaireBon
          key={`${id ?? "nouveau"}-${generation.n}-${lire.generation}`}
          bon={bon.data ?? null}
          prefill={id ? null : (lu?.prefill ?? lirePreRemplissage(location.state))}
          fichierLu={id ? null : (lu?.fichier ?? lire.dernier ?? lireFichierRetenu(location.state))}
          lecture={id || !ocr ? null : { onLire: lire.lancer, statut: lu?.statut ?? null }}
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
