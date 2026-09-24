import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import { DocumentImprimable } from "@/modules/documents/components/DocumentImprimable";
import { depuisBase } from "@/modules/documents/domain/lignes";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useIdentite } from "@/modules/societes/hooks/useIdentite";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { finDeValidite } from "../domain/validite";
import { useDevis } from "../hooks/useDevis";

export function PageApercuDevis() {
  const { id } = useParams();
  const devis = useDevis(id);
  const identite = useIdentite();
  const reglages = useReglages();
  if (devis.isPending || identite.isPending) return <Chargement />;
  if (devis.isError) return <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />;
  if (identite.isError) return <Erreur erreur={identite.error} reessayer={() => void identite.refetch()} />;
  const d = devis.data;
  const s = identite.data;
  const validite = finDeValidite(d.date, (reglages.data ?? REGLAGES_DEFAUT).validiteDevisJours);

  return (
    <GardeSociete societeId={d.societe_id} retour="/devis">
      <div className="mb-4 flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimer / enregistrer en PDF</Button>
        <Button variant="ghost" asChild>
          <Link to={`/devis/${d.id}`}>Retour au devis</Link>
        </Button>
      </div>
      <DocumentImprimable
        titre="DEVIS"
        numero={d.numero}
        date={d.date}
        emetteur={{
          nom: s.raison_sociale_legale || s.nom,
          lignes: [s.adresse, [s.code_postal, s.ville].filter(Boolean).join(" "), s.telephone, s.email, s.siret && `SIRET ${s.siret}`, s.tva_intracom && `TVA ${s.tva_intracom}`],
        }}
        destinataire={{ nom: d.client_nom, lignes: [d.interlocuteur && `À l'attention de ${d.interlocuteur}`, d.adresse] }}
        meta={[
          ...(validite ? [{ libelle: "Valable jusqu'au", valeur: formatDateFr(validite) }] : []),
          ...(d.adresse_locataire ? [{ libelle: "Lieu :", valeur: [d.adresse_locataire, d.code_postal, d.ville].filter(Boolean).join(" ") }] : []),
        ]}
        lignes={d.lignes.map(depuisBase)}
        remise={String(d.remise_pourcentage)}
        pied={
          // Devis : seul le client signe (« Bon pour accord ») ; pas de mentions légales de facture.
          <div className="ml-auto mt-6 h-28 w-72 rounded border border-gray-400 p-2 text-xs">Bon pour accord — date et signature du client</div>
        }
      />
    </GardeSociete>
  );
}
