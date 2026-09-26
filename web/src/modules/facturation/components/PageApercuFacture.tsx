import { useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ApercuPiece } from "@/modules/documents/components/ApercuPiece";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import type { Facture } from "../domain/facture";
import { useFacture } from "../hooks/useFactures";
import { useModeleFacture, useOptionsPdfFacture } from "../hooks/useImpression";

/**
 * La facture telle que l'ancien l'ouvrait (`openViewDoc('facture')`) : la pièce
 * même du PDF (FAC-10) — émetteur figé prioritaire, devis d'origine, facture
 * rectifiée, IBAN/BIC selon le réglage, mentions sur facture seulement — avec
 * « Imprimer » et « Enregistrer ». L'e-mail et la plateforme restent sur la
 * fiche de la facture, comme dans l'ancien (D-PDF-06).
 */
export function PageApercuFacture() {
  const { id } = useParams();
  const navigate = useNavigate();
  const facture = useFacture(id);
  if (facture.isPending) return <Chargement />;
  if (facture.isError) return <Erreur erreur={facture.error} reessayer={() => void facture.refetch()} />;
  const f = facture.data;
  return (
    <GardeSociete societeId={f.societe_id} retour="/factures">
      <Apercu facture={f} fermer={() => void navigate(`/factures/${f.id}`)} />
    </GardeSociete>
  );
}

/** L'aperçu ouvert depuis une carte de la liste, par-dessus elle (`cardRowClick` → `openViewDoc`). */
export function ApercuFactureParId({ id, fermer }: { id: string; fermer: () => void }) {
  const facture = useFacture(id);
  if (facture.isPending) return <Chargement />;
  if (facture.isError) return <Erreur erreur={facture.error} reessayer={() => void facture.refetch()} />;
  return <Apercu facture={facture.data} fermer={fermer} />;
}

function Apercu({ facture, fermer }: { facture: Facture; fermer: () => void }) {
  const { modele, erreur } = useModeleFacture(facture);
  const options = useOptionsPdfFacture(facture);
  if (erreur) return <Erreur erreur={erreur} />;
  if (!modele) return <Chargement />;
  return <ApercuPiece piece={modele} fermer={fermer} options={options} />;
}
