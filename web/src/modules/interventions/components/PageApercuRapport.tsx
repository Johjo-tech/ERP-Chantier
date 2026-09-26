import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApercuPiece } from "@/modules/documents/components/ApercuPiece";
import { useIdentiteDocument } from "@/modules/documents/hooks/useIdentiteDocument";
import type { RapportComplet } from "../api/rapports";
import { pieceRapport } from "../domain/impression";
import { courrielDuRapport } from "../domain/rapport";
import { useBonsLiables, useCourrielClient, useRapport } from "../hooks/useRapports";
import { ActionsTransformation } from "./ActionsTransformation";

function Envoi({ complet }: { complet: RapportComplet }) {
  const r = complet.rapport;
  const courriel = useCourrielClient(r.client_id);
  const [copie, setCopie] = useState<string | null>(null);
  const { objet, corps } = courrielDuRapport(r);
  const dest = courriel.data ?? "";
  return (
    <>
      <Button asChild variant="outline"><a href={`mailto:${dest}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`}>Envoyer par e-mail</a></Button>
      <Button
        variant="ghost"
        onClick={() =>
          void navigator.clipboard.writeText(`À : ${dest}\nObjet : ${objet}\n\n${corps}`).then(
            () => setCopie("Texte copié — collez-le dans votre messagerie, et joignez le PDF imprimé."),
            (e: unknown) => {
              console.warn("Copie impossible", e);
              setCopie("Impossible de copier automatiquement : sélectionnez le texte à la main.");
            }
          )
        }
      >
        Copier le texte
      </Button>
      {copie && <Alert className="w-full">{copie}</Alert>}
    </>
  );
}

/**
 * Le rapport tel que l'ancien l'ouvrait (`openViewIntervention`) : la pièce
 * même du PDF (`renderPrintIntervention`), « Imprimer » et « Enregistrer ».
 * L'envoi et la transformation en devis ou facture, propres à web/ sur cette
 * page (PLN-20, D-CLI-09), se posent devant (D-PDF-06).
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
          <Envoi complet={complet} />
          {/* La voie de la carte, relue par son id (D-CLI-09) ; lié à un bon, le rapport se facture par le bon (PLN-20). */}
          <ActionsTransformation rapport={r.id} bonId={r.bon_commande_id} taille="default" />
        </>
      }
    />
  );
}
