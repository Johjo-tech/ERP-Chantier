import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { blocagesValidationConducteur, messageBlocages } from "../domain/circuit";
import { metiersDuBon } from "../domain/metiers";
import type { TacheBon } from "../domain/workflow";
import type { Bon } from "../api/bons";
import { useValiderConducteur } from "../hooks/useBons";

interface Props {
  bon: Bon;
  taches: readonly TacheBon[];
  onResultat: (m: string, e?: unknown) => void;
}

/**
 * La validation conducteur (BC-16, BC-38) : sur les tâches RÉELLES, pas sur
 * la liste des métiers. Ce qui bloque se voit ; le bouton ne s'ouvre qu'une
 * fois tout pointé — et la base redira non si quelque chose a bougé entre-temps.
 */
export function ValidationConducteur({ bon, taches, onResultat }: Props) {
  const valider = useValiderConducteur();
  const blocages = blocagesValidationConducteur(taches, metiersDuBon(bon));
  return (
    <section aria-labelledby="titre-validation-conducteur" className="flex flex-col gap-2 rounded-md border p-3">
      <h3 id="titre-validation-conducteur" className="text-sm font-semibold">Validation conducteur</h3>
      {blocages.length ? (
        <Alert>
          <span className="whitespace-pre-line">⚠ {messageBlocages(blocages)}</span>
        </Alert>
      ) : (
        <Alert variant="succes">✓ Toutes les tâches sont pointées : l'affaire peut être validée.</Alert>
      )}
      <Button
        className="self-start"
        disabled={blocages.length > 0 || valider.isPending}
        onClick={() => valider.mutate(bon, { onSuccess: () => onResultat("Affaire validée par le conducteur — elle passe à la pré-facture."), onError: (e) => onResultat("", e) })}
      >
        {valider.isPending ? "Validation…" : "Valider l'affaire (conducteur)"}
      </Button>
    </section>
  );
}
