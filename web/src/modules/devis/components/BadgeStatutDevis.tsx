import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LIBELLES_STATUT, type StatutDevis } from "../domain/devis";

const VARIANTE: Record<StatutDevis, BadgeVariant> = { brouillon: "neutre", envoyé: "default", accepté: "succes", refusé: "danger" };

export function BadgeStatutDevis({ statut }: { statut: StatutDevis }) {
  return <Badge variant={VARIANTE[statut]}>{LIBELLES_STATUT[statut]}</Badge>;
}
