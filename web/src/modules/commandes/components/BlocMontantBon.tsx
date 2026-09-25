import { ChampTexte } from "@/components/formulaire/Champ";
import { formatEuros } from "@/lib/money";
import type { LigneEdition } from "@/modules/documents/domain/lignes";
import { lignesOntDuContenu, montantDuBon } from "../domain/regles";

interface Props {
  lignes: readonly LigneEdition[];
  montant: string;
  onMontant: (v: string) => void;
  erreur?: string | undefined;
  lectureSeule: boolean;
}

/**
 * Le montant global ne se saisit que si aucune ligne n'est renseignée (BC-11,
 * BC-33) : dès qu'une ligne a du contenu, ce sont les lignes qui font foi.
 */
export function BlocMontantBon({ lignes, montant, onMontant, erreur, lectureSeule }: Props) {
  if (lignesOntDuContenu(lignes)) {
    return (
      <p className="text-sm" aria-live="polite">
        Montant du bon (HT, d'après les lignes) : <strong className="tabular-nums">{formatEuros(montantDuBon(lignes, montant))}</strong>
      </p>
    );
  }
  return (
    <div className="max-w-xs">
      <ChampTexte
        libelle="Montant global HT"
        inputMode="decimal"
        valeur={montant}
        erreur={erreur}
        aide="Sans ligne chiffrée, c'est ce montant qui vaut pour le bon."
        onChange={onMontant}
        desactive={lectureSeule}
      />
    </div>
  );
}
