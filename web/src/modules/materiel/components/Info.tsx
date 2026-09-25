import type { ReactNode } from "react";

/** Une donnée de fiche : son libellé, sa valeur (le « — » d'une valeur absente est à l'appelant). */
export function Info({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
