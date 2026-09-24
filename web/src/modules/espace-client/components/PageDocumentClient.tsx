import { Link, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { lireDevis } from "@/modules/devis/api/devis";
import { DocumentImprimable } from "@/modules/documents/components/DocumentImprimable";
import { depuisBase } from "@/modules/documents/domain/lignes";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { lireFacture } from "@/modules/facturation/api/factures";
import { libelleDocument } from "@/modules/facturation/domain/avoir";
import { useQuery } from "@tanstack/react-query";
import { useAccesClients } from "../hooks/useEspaceClient";

/** Un devis ou une facture du client, en consultation : les mêmes pièces que celles qu'il reçoit. */
export function PageDocumentClient({ nature }: { nature: "devis" | "facture" }) {
  const { id } = useParams();
  const acces = useAccesClients();
  const doc = useQuery({
    queryKey: ["espace-client", nature, id],
    queryFn: async () => {
      if (nature === "devis") {
        const d = await lireDevis(id as string);
        return { titre: "DEVIS", numero: d.numero, date: d.date, client: d.client_nom, lignes: d.lignes, remise: d.remise_pourcentage, emetteur: null, signe: 1 as const, societeId: d.societe_id };
      }
      const f = await lireFacture(id as string);
      return { titre: libelleDocument(f.type_document), numero: f.numero ?? "", date: f.date, client: f.client_nom, lignes: f.lignes, remise: f.remise_pourcentage, emetteur: f.emetteur_nom, signe: estAvoir(f.type_document) ? (-1 as const) : (1 as const), societeId: f.societe_id };
    },
    enabled: !!id,
  });
  if (doc.isPending) return <Chargement />;
  if (doc.isError) return <Erreur erreur={doc.error} reessayer={() => void doc.refetch()} />;
  const d = doc.data;
  const societe = acces.find((a) => a.societeId === d.societeId)?.societeNom ?? "";
  return (
    <>
      <div className="mb-4 flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimer / enregistrer en PDF</Button>
        <Button variant="ghost" asChild><Link to="/espace-client">Retour</Link></Button>
      </div>
      <DocumentImprimable
        titre={d.titre}
        numero={d.numero}
        date={d.date}
        emetteur={{ nom: d.emetteur ?? societe, lignes: [] }}
        destinataire={{ nom: d.client, lignes: [] }}
        lignes={d.lignes.map(depuisBase)}
        remise={String(d.remise)}
        signe={d.signe}
      />
    </>
  );
}
