import type { BonDeLaListe } from "../api/bons";
import { etapesDuCircuit } from "../domain/workflow";

/** Le circuit en quatre étapes (BC-03) : où en est le dossier, d'un coup d'œil. */
export function StepperBon({ bon }: { bon: BonDeLaListe }) {
  const etapes = etapesDuCircuit(bon.circuit, bon.factures.length > 0);
  const courante = etapes.findIndex((e) => !e.faite);
  return (
    <ol aria-label="Circuit du bon" className="flex flex-wrap items-center gap-2 text-sm">
      {etapes.map((e, i) => (
        <li key={e.libelle} aria-current={i === courante ? "step" : undefined} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${e.faite ? "border-success bg-success/15 text-success" : i === courante ? "border-primary font-semibold text-primary" : "text-muted-foreground"}`}
          >
            {e.faite ? "✓" : i + 1}
          </span>
          <span className={i === courante ? "font-medium" : e.faite ? "" : "text-muted-foreground"}>
            {e.libelle}
            <span className="sr-only">{e.faite ? " — franchie" : i === courante ? " — en cours" : " — à venir"}</span>
          </span>
          {i < etapes.length - 1 && <span aria-hidden="true" className="text-muted-foreground">—</span>}
        </li>
      ))}
    </ol>
  );
}
