import { Link, useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import type { Rapport } from "../api/rapports";
import { useTransformer } from "../hooks/useRapports";

/**
 * Rapport → devis ou facture : les MÊMES boutons sur la carte de la liste et
 * sur l'aperçu du rapport, par la seule voie `api/transformations.ts`
 * (D-CLI-09). `rapport` peut être l'identifiant : il est alors relu juste
 * avant, ce qui vaut pour l'aperçu comme pour un rapport qu'on vient
 * d'enregistrer. Un rapport lié à un bon se facture par le bon.
 */
export function ActionsTransformation({
  rapport,
  bonId,
  devisPossible = true,
  facturePossible = true,
  taille = "sm",
}: {
  rapport: Rapport | string;
  bonId: string | null;
  devisPossible?: boolean;
  facturePossible?: boolean;
  taille?: "sm" | "default";
}) {
  const navigate = useNavigate();
  const transformer = useTransformer();
  const transformerEn = (type: "devis" | "facture") =>
    transformer.mutate(
      { type, rapport },
      { onSuccess: (id) => void navigate(type === "devis" ? `/devis/${id}` : `/factures/${id}`, { state: { message: `Rapport transformé en ${type} — vérifiez les lignes et saisissez les prix.` } }) }
    );
  return (
    <>
      {devisPossible && (
        <Can module="devis" action="creer">
          <Button size={taille} variant="outline" disabled={transformer.isPending} onClick={() => transformerEn("devis")}>Transformer en devis</Button>
        </Can>
      )}
      {facturePossible && (
        <Can module="factures" action="creer">
          {bonId ? (
            <Button asChild size={taille} variant="outline"><Link to={`/commandes/${bonId}`}>Facturer le bon lié</Link></Button>
          ) : (
            <Button size={taille} variant="outline" disabled={transformer.isPending} onClick={() => transformerEn("facture")}>Transformer en facture</Button>
          )}
        </Can>
      )}
      {transformer.isError && <Alert variant="erreur" className="w-full">{messageErreur(transformer.error)}</Alert>}
    </>
  );
}
