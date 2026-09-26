import { Fragment, type ReactNode } from "react";
import type { BonDeLaListe } from "../api/bons";
import { etapesDuCircuit } from "../domain/workflow";

/**
 * Le circuit en quatre étapes (`bcWorkflowStepperHTML`, BC-03), au balisage de
 * l'ancien. Une étape est « en cours » dès que la précédente est franchie —
 * règle recopiée telle quelle, y compris quand deux étapes le sont à la fois.
 * `actions` remplit `.bc-step-actions`, comme le contexte « attente » de l'ancien.
 */
export function StepperBon({ bon, actions }: { bon: BonDeLaListe; actions?: ReactNode }) {
  const etapes = etapesDuCircuit(bon.circuit, bon.factures.length > 0);
  return (
    <div className="bc-stepper" role="group" aria-label="Circuit du bon">
      {etapes.map((e, i) => {
        const courante = !e.faite && (i === 0 || etapes[i - 1]?.faite === true);
        return (
          <Fragment key={e.libelle}>
            <div className={`bc-step${e.faite ? " is-done" : ""}${courante ? " is-current" : ""}`} aria-current={courante ? "step" : undefined}>
              <div className="bc-step-dot" aria-hidden="true">{e.faite ? "✓" : i + 1}</div>
              <div className="bc-step-label">
                {e.libelle}
                <span className="sr-only">{e.faite ? " — franchie" : courante ? " — en cours" : " — à venir"}</span>
              </div>
            </div>
            {i < etapes.length - 1 && <div className={`bc-step-line${e.faite ? " is-done" : ""}`} aria-hidden="true" />}
          </Fragment>
        );
      })}
      <div className="bc-step-actions">{actions}</div>
    </div>
  );
}
