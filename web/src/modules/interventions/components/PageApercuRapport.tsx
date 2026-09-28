import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ApercuPiece } from "@/modules/documents/components/ApercuPiece";
import { useIdentiteDocument, useImprimerPiece } from "@/modules/documents/hooks/useIdentiteDocument";
import type { PieceImprimee } from "@/modules/documents/impression/zone";
import { ModaleEmail } from "@/modules/facturation/components/ModaleEmail";
import type { RapportComplet } from "../api/rapports";
import { pieceRapport } from "../domain/impression";
import { courrielDuRapport } from "../domain/rapport";
import { useBonsLiables, useCourrielClient, useRapport } from "../hooks/useRapports";
import { ActionsTransformation } from "./ActionsTransformation";

/**
 * « Envoyer par email » comme l'ancien (`envoyerRapportEmail` → `openEmailComposeModal`) : la fenêtre
 * `#emailModal` — télécharger le PDF, destinataire, objet, message, ouvrir la messagerie ou copier le texte.
 */
function Envoi({ complet, piece }: { complet: RapportComplet; piece: PieceImprimee }) {
  const r = complet.rapport;
  const courriel = useCourrielClient(r.client_id);
  const imprimer = useImprimerPiece();
  const [ouverte, setOuverte] = useState(false);
  const { objet, corps } = courrielDuRapport(r);
  return (
    <>
      <button type="button" className="btn small" onClick={() => setOuverte(true)}>Envoyer par email</button>
      {ouverte && (
        <ModaleEmail
          brouillon={{ destinataire: courriel.data ?? "", objet, corps }}
          telecharger={() => imprimer.mutate({ piece, action: "save" })}
          fermer={() => setOuverte(false)}
        />
      )}
    </>
  );
}

/**
 * Le rapport tel que l'ancien l'ouvrait (`openViewIntervention`) : la pièce
 * même du PDF (`renderPrintIntervention`), « Imprimer » et « Enregistrer ».
 * L'envoi et la transformation en devis ou facture, propres à web/ sur cette
 * page (PLN-20, D-CLI-09), se posent sous la pièce, en `btn small` comme la
 * barre de l'ancien (D-PDF-06, D-COR2-04).
 */
export function PageApercuRapport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rapport = useRapport(id);
  const documentaire = useIdentiteDocument();
  const bons = useBonsLiables();
  if (rapport.isPending || documentaire.isPending) return <Chargement />;
  if (rapport.isError) return <Erreur erreur={rapport.error} reessayer={() => void rapport.refetch()} />;
  if (documentaire.isError) return <Erreur erreur={documentaire.error} reessayer={() => void documentaire.refetch()} />;
  const complet = rapport.data;
  const r = complet.rapport;
  // `bcNumeroDepuisId` : le n° du client, vide si le bon n'est pas (ou plus) lisible.
  const bcNumero = r.bon_commande_id ? (bons.data?.find((b) => b.id === r.bon_commande_id)?.numero_bc ?? "") : undefined;
  const piece = pieceRapport(complet, documentaire.data.imprimable, bcNumero);
  return (
    <ApercuPiece
      piece={piece}
      fermer={() => void navigate("/rapports")}
      actions={
        <>
          <Envoi complet={complet} piece={piece} />
          {/* La voie de la carte, relue par son id (D-CLI-09) ; lié à un bon, le rapport se facture par le bon (PLN-20). */}
          <ActionsTransformation rapport={r.id} bonId={r.bon_commande_id} />
        </>
      }
    />
  );
}
