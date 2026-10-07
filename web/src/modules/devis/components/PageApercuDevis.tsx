import { useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ApercuPiece } from "@/modules/documents/components/ApercuPiece";
import { useIdentiteDocument } from "@/modules/documents/hooks/useIdentiteDocument";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { useDevis, useModeleDevis } from "../hooks/useDevis";

/**
 * Le devis tel que l'ancien l'ouvrait (`openViewDoc('devis')`) : la pièce même
 * du PDF — « Valable jusqu'au » et sa durée, « Bon pour accord » du client
 * seul, aucune mention de facture — avec « Imprimer » et « Enregistrer ».
 */
/** L'aperçu ouvert depuis une carte de la liste, par-dessus elle (`cardRowClick` → `openViewDoc`). */
export function ApercuDevisParId({ id, fermer }: { id: string; fermer: () => void }) {
  const devis = useDevis(id);
  const reglages = useReglages();
  const piece = useModeleDevis(devis.data ?? null, (reglages.data ?? REGLAGES_DEFAUT).validiteDevisJours);
  if (devis.isError) return <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />;
  return piece ? <ApercuPiece piece={piece} fermer={fermer} /> : <Chargement />;
}

export function PageApercuDevis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const devis = useDevis(id);
  const reglages = useReglages();
  const identite = useIdentiteDocument();
  const piece = useModeleDevis(devis.data ?? null, (reglages.data ?? REGLAGES_DEFAUT).validiteDevisJours);
  if (devis.isPending || identite.isPending) return <Chargement />;
  if (devis.isError) return <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />;
  if (identite.isError) return <Erreur erreur={identite.error} reessayer={() => void identite.refetch()} />;
  const d = devis.data;

  return (
    <GardeSociete societeId={d.societe_id} retour="/devis">
      {piece ? <ApercuPiece piece={piece} fermer={() => void navigate(`/devis/${d.id}`)} /> : <Chargement />}
    </GardeSociete>
  );
}
