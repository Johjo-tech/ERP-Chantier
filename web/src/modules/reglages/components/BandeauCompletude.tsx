import { Alert } from "@/components/ui/alert";
import { completudeSociete, messageManques, recommandationsSociete, type ValeursSociete } from "@/modules/societes/domain/societe";

/**
 * Ce qui manque à la fiche, recalculé à chaque frappe (SOC-06). Obligatoire et
 * recommandé restent séparés : les confondre, c'est ne plus savoir par quoi
 * commencer. L'ancienne fonction existait mais n'était appelée nulle part.
 */
export function BandeauCompletude({ valeurs, piedDePage }: { valeurs: ValeursSociete; piedDePage: string }) {
  const manques = completudeSociete(valeurs);
  const conseils = recommandationsSociete(valeurs);
  return (
    <div className="flex flex-col gap-1">
      {manques.length ? (
        <Alert variant="erreur">{messageManques(manques)}</Alert>
      ) : (
        <Alert variant="succes">Les mentions obligatoires de vos documents sont au complet.</Alert>
      )}
      {conseils.length > 0 && (
        <p className="text-xs text-muted-foreground">Recommandé, sans être obligatoire : {conseils.map((c) => c.libelle).join(", ")}.</p>
      )}
      {/* Un pied de page personnalisé remplace l'identité légale : à dire quand elle est incomplète. */}
      {piedDePage.trim() !== "" && manques.length > 0 && (
        <p className="text-xs text-destructive">
          Votre pied de page personnalisé remplace l'identité légale sur les documents : les mentions ci-dessus n'y figureront pas.
        </p>
      )}
    </div>
  );
}
