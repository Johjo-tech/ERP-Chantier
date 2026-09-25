import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { lireDevis } from "@/modules/devis/api/devis";
import { pieceDeDevis } from "@/modules/devis/domain/impression";
import { ApercuModele } from "@/modules/documents/components/ApercuModele";
import { BoutonPdf } from "@/modules/documents/components/BoutonPdf";
import { REGLAGES_IMPRESSION_DEFAUT } from "@/modules/documents/domain/identite";
import { construireModele } from "@/modules/documents/domain/modele";
import { lireFacture } from "@/modules/facturation/api/factures";
import { pieceDeFacture } from "@/modules/facturation/domain/impression";
import { mentionsLegales } from "@/modules/facturation/domain/mentions";
import { useEmetteurClient } from "../hooks/useEspaceClient";

/**
 * Un devis ou une facture du client : la MÊME pièce que celle qu'il reçoit
 * (même modèle que le PDF interne), téléchargeable. Pour une facture,
 * l'identité figée à l'émission fait foi (IBAN compris) ; la validité d'un
 * devis n'est pas imprimée ici — le réglage de la société ne lui est pas lisible (D-FAC-10).
 */
export function PageDocumentClient({ nature }: { nature: "devis" | "facture" }) {
  const { id } = useParams();
  const doc = useQuery({
    queryKey: ["espace-client", nature, id],
    queryFn: async () => {
      if (nature === "devis") {
        const d = await lireDevis(id as string);
        return { societeId: d.societe_id, piece: pieceDeDevis(d, 0), facture: false };
      }
      const f = await lireFacture(id as string);
      return { societeId: f.societe_id, piece: pieceDeFacture(f, { devisNumero: null, rectifiee: null }), facture: true };
    },
    enabled: !!id,
  });
  const emetteur = useEmetteurClient(doc.data?.societeId);
  if (doc.isPending || (doc.isSuccess && emetteur.isPending)) return <Chargement />;
  if (doc.isError) return <Erreur erreur={doc.error} reessayer={() => void doc.refetch()} />;
  if (emetteur.isError) return <Erreur erreur={emetteur.error} reessayer={() => void emetteur.refetch()} />;
  const e = emetteur.data;
  const modele = e ? construireModele(doc.data.piece, e.identite, REGLAGES_IMPRESSION_DEFAUT, doc.data.facture ? mentionsLegales(e.mentions) : []) : null;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimer</Button>
        <BoutonPdf modele={modele} />
        <Button variant="ghost" asChild><Link to="/espace-client">Retour</Link></Button>
      </div>
      {modele && <ApercuModele m={modele} />}
    </>
  );
}
