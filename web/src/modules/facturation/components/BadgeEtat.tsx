import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { EtatPiece } from "../domain/etat";

const VARIANTES: Record<string, BadgeVariant> = {
  brouillon: "neutre",
  reprise: "succes",
  reglee: "succes",
  partiellement_reglee: "alerte",
  non_reglee: "danger",
  disponible: "default",
  partiellement_impute: "alerte",
  impute: "succes",
};

export function BadgeEtat({ etat }: { etat: EtatPiece }) {
  if (etat.nature === "brouillon") return <Badge variant="neutre">Brouillon</Badge>;
  if (etat.nature === "reprise") return <Badge variant="succes">{etat.libelle}</Badge>;
  return <Badge variant={VARIANTES[etat.cle] ?? "neutre"}>{etat.libelle}</Badge>;
}
