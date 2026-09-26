import { useParams } from "react-router";
import { PageChantiers } from "./PageChantiers";
import { PageFicheChantier } from "./PageFicheChantier";

/**
 * `/chantiers/nouveau` et `/chantiers/:id/modifier` : l'ancien n'avait pas
 * d'écran de formulaire à part. Nouveau : au-dessus des cartes ; modifier : à
 * la place du bandeau de la fiche.
 */
export function PageFormulaireChantier() {
  const { id } = useParams();
  return id ? <PageFicheChantier edition /> : <PageChantiers formulaire={null} />;
}
