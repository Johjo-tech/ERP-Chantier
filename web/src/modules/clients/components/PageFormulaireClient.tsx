import { useParams } from "react-router";
import { PageClients } from "./PageClients";

/**
 * `/clients/nouveau` et `/clients/:id/modifier` : l'écran Clients, formulaire
 * ouvert au-dessus de la liste — l'ancien n'avait pas d'écran de fiche à part.
 */
export function PageFormulaireClient() {
  const { id } = useParams();
  return <PageClients key={id ?? "nouveau"} formulaire={id ?? null} />;
}
