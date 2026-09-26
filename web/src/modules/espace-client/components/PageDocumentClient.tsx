import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { lireDevis } from "@/modules/devis/api/devis";
import { contexteDevis } from "@/modules/devis/domain/impression";
import { ApercuPiece } from "@/modules/documents/components/ApercuPiece";
import { emetteurDepuisIdentite, pieceImprimee } from "@/modules/documents/impression/pieces";
import { lireFacture } from "@/modules/facturation/api/factures";
import { contexteFacture } from "@/modules/facturation/domain/impression";
import { mentionsLegales } from "@/modules/facturation/domain/mentions";
import { useEmetteurClient } from "../hooks/useEspaceClient";

/**
 * Un devis ou une facture du client : la MÊME pièce que celle qu'il reçoit
 * (le gabarit de l'ancien, D-PDF-01), dans la fenêtre d'aperçu de l'ancien.
 * Pour une facture, l'identité figée à l'émission fait foi (IBAN compris) ; la
 * validité d'un devis n'est pas imprimée ici — le réglage de la société ne lui
 * est pas lisible (D-FAC-10).
 */
export function PageDocumentClient({ nature }: { nature: "devis" | "facture" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = useQuery({
    queryKey: ["espace-client", nature, id],
    queryFn: async () => {
      if (nature === "devis") return { devis: await lireDevis(id as string), facture: null };
      return { devis: null, facture: await lireFacture(id as string) };
    },
    enabled: !!id,
  });
  const societeId = doc.data?.devis?.societe_id ?? doc.data?.facture?.societe_id;
  const emetteur = useEmetteurClient(societeId);
  if (doc.isPending || (doc.isSuccess && emetteur.isPending)) return <Chargement />;
  if (doc.isError) return <Erreur erreur={doc.error} reessayer={() => void doc.refetch()} />;
  if (emetteur.isError) return <Erreur erreur={emetteur.error} reessayer={() => void emetteur.refetch()} />;
  const e = emetteur.data;
  if (!e) return null;
  const imprimable = emetteurDepuisIdentite(e.identite);
  const { devis, facture } = doc.data;
  const contexte = devis
    ? contexteDevis(devis, imprimable, 0)
    : facture
      ? contexteFacture(facture, { devisNumero: null, rectifiee: null }, imprimable, mentionsLegales(e.mentions))
      : null;
  if (!contexte) return null;
  return <ApercuPiece piece={pieceImprimee(contexte, imprimable.variables)} fermer={() => void navigate("/espace-client")} />;
}
