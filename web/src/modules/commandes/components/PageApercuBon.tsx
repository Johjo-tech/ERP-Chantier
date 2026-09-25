import { useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { ApercuPiece } from "@/modules/documents/components/ApercuPiece";
import { useIdentiteDocument } from "@/modules/documents/hooks/useIdentiteDocument";
import { pieceImprimee } from "@/modules/documents/impression/pieces";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { versLigneBase } from "../domain/bon";
import { contexteBon } from "../domain/impression";
import { useBon } from "../hooks/useBons";

/**
 * Le bon imprimable : la « fiche interne » que l'ancien rendait par
 * `renderPrintDoc('bonCommande', id, !avecPrix)` (app.js l. 7896) — même
 * gabarit que le devis, référence du client toujours affichée (BC-80),
 * « Validation de la pré-facture » signée des deux côtés. Sans le droit de
 * voir les prix, les montants s'écrivent « ••• », comme dans l'ancien.
 */
export function PageApercuBon() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bon = useBon(id);
  const documentaire = useIdentiteDocument();
  const prix = useVoitLesPrix();
  if (bon.isPending || documentaire.isPending) return <Chargement />;
  if (bon.isError) return <Erreur erreur={bon.error} reessayer={() => void bon.refetch()} />;
  if (documentaire.isError) return <Erreur erreur={documentaire.error} reessayer={() => void documentaire.refetch()} />;
  const b = bon.data;
  const e = documentaire.data.imprimable;
  const piece = pieceImprimee(contexteBon(b, b.lignes.map(versLigneBase), e, !prix), e.variables);
  return (
    <GardeSociete societeId={b.societe_id} retour="/commandes">
      <ApercuPiece piece={piece} fermer={() => void navigate(`/commandes/${b.id}`)} />
    </GardeSociete>
  );
}
