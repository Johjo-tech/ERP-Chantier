import type { ComponentType } from "react";
import type { LigneEdition } from "../domain/lignes";

/**
 * Le champ « référence » d'une ligne est fourni par un autre module (le
 * catalogue d'articles) et branché dans app/ : `documents` ne dépend pas de
 * `articles`, il ne connaît que ce contrat.
 */
export interface PropsReferenceLigne {
  ligne: LigneEdition;
  index: number;
  remplacer: (ligne: LigneEdition) => void;
  desactive: boolean;
}

export type ChampReferenceLigne = ComponentType<PropsReferenceLigne>;
