import { Badge } from "@/components/ui/badge";
import type { BonDeLaListe } from "../api/bons";
import { etapeWorkflow } from "../domain/workflow";

/** À qui c'est le tour, en un coup d'œil (BC-03, BC-40). */
export function BadgeEtape({ bon }: { bon: BonDeLaListe }) {
  const e = etapeWorkflow(bon.circuit, bon.factures.length > 0);
  return (
    <Badge variant={e.variante} title="Étape du circuit de validation">
      {e.libelle}
    </Badge>
  );
}
