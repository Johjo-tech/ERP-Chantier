import { Navigate, useParams } from "react-router";
import { Chargement } from "@/components/etats/Etats";
import { useClient } from "../hooks/useClients";

/**
 * `/clients/:id` : l'ancien n'avait pas de fiche client à part — un client se
 * voit dans sa carte, dans la liste. L'adresse reste (liens, favoris) mais
 * ramène à la liste, filtrée sur ce client : sa carte, et elle seule
 * (D-ECR-CHA-13). Un client introuvable ramène à la liste entière.
 */
export function PageFicheClient() {
  const { id } = useParams();
  const client = useClient(id);
  if (client.isPending) return <Chargement />;
  if (client.isError) {
    console.error("Client introuvable, retour à la liste :", client.error);
    return <Navigate to="/clients" replace />;
  }
  return <Navigate to="/clients" replace state={{ recherche: client.data.nom }} />;
}
