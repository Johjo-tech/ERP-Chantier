import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { ApercuModele } from "@/modules/documents/components/ApercuModele";
import { BoutonPdf } from "@/modules/documents/components/BoutonPdf";
import { useIdentiteDocument } from "@/modules/documents/hooks/useIdentiteDocument";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { useDevis, useModeleDevis } from "../hooks/useDevis";

/**
 * Le devis imprimable — le MÊME modèle que le PDF (DEV-15) : « Valable
 * jusqu'au » et sa durée, signature « Bon pour accord » du client seul, aucune
 * mention légale de facture.
 */
export function PageApercuDevis() {
  const { id } = useParams();
  const devis = useDevis(id);
  const reglages = useReglages();
  const identite = useIdentiteDocument();
  const modele = useModeleDevis(devis.data ?? null, (reglages.data ?? REGLAGES_DEFAUT).validiteDevisJours);
  if (devis.isPending || identite.isPending) return <Chargement />;
  if (devis.isError) return <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />;
  if (identite.isError) return <Erreur erreur={identite.error} reessayer={() => void identite.refetch()} />;
  const d = devis.data;

  return (
    <GardeSociete societeId={d.societe_id} retour="/devis">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimer</Button>
        <BoutonPdf modele={modele} />
        <Button variant="ghost" asChild>
          <Link to={`/devis/${d.id}`}>Retour au devis</Link>
        </Button>
      </div>
      {modele ? <ApercuModele m={modele} /> : <Chargement />}
    </GardeSociete>
  );
}
