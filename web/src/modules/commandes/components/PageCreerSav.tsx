import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { estSav } from "../domain/bon";
import { savDuBon } from "../domain/sav";
import { useBon, useBons } from "../hooks/useBons";
import { useDefilerVersLeFormulaire } from "../hooks/useDefilerVersLeFormulaire";
import { FormulaireBon } from "./FormulaireBon";

/**
 * Créer le SAV d'un bon (`transformerBonCommandeEnSAV`, BC-13) : le formulaire
 * du bon, titré « Nouveau SAV », qui en reprend client, lieu, logement,
 * conducteur et métier ; « Ce qui ne va pas » et cinq photos au plus. Le SAV
 * prend un numéro de notre série. Un seul SAV par bon : s'il existe, on le dit.
 */
export function PageCreerSav() {
  const { id } = useParams();
  const origine = useBon(id);
  const bons = useBons();
  const reglages = useReglages();
  useDefilerVersLeFormulaire(id, !origine.isPending && !bons.isPending && !reglages.isPending);
  if (origine.isPending || bons.isPending || reglages.isPending) return <Chargement />;
  if (origine.isError) return <Erreur erreur={origine.error} reessayer={() => void origine.refetch()} />;
  const bon = origine.data;
  const existant = savDuBon(bon.id, bons.data ?? []);
  const refus = estSav(bon) ? (
    <>Un SAV ne se rattache pas à un autre SAV : ouvrez le bon de commande d&apos;origine.</>
  ) : existant ? (
    <>Un SAV a déjà été créé pour ce bon de commande (<Link to={`/commandes/${existant.id}`}>{existant.numero_bc ?? existant.numero_interne}</Link>). Ouvrez-le directement pour le modifier.</>
  ) : null;
  return (
    <>
      <EnTetePage titre="Bons de commande" />
      {refus ? (
        <div className="wf-banner alerte" role="alert">{refus}</div>
      ) : (
        <div id="formZoneBonCommande">
          <FormulaireBon bon={null} savDe={bon} prefill={null} fichierLu={null} reglages={reglages.data ?? REGLAGES_DEFAUT} horodatage={null} onBrouillon={async () => undefined} />
        </div>
      )}
    </>
  );
}
