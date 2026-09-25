import { ChampTexte } from "@/components/formulaire/Champ";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import type { LigneEdition } from "@/modules/documents/domain/lignes";
import { MIN_METIERS_VENTILES } from "../domain/enregistrement";
import { lignesOntDuContenu, montantDuBon } from "../domain/regles";

interface Props {
  lignes: readonly LigneEdition[];
  montant: string;
  onMontant: (v: string) => void;
  metiers: readonly string[];
  montantsParMetier: Readonly<Record<string, string>>;
  onMontantMetier: (metier: string, v: string) => void;
  /** Métiers qu'aucun chapitre du devis lié ne désigne : leur montant reste à saisir. */
  sansChapitre: readonly string[];
  erreur?: string | undefined;
  lectureSeule: boolean;
}

function NoteLignes({ lignes, ventile }: { lignes: readonly LigneEdition[]; ventile: boolean }) {
  useModeDiscret();
  return (
    <p className="text-sm" aria-live="polite">
      Montant du bon (HT, d'après les lignes) : <strong className="tabular-nums">{formatEurosEcran(montantDuBon(lignes, 0))}</strong>
      {ventile && <span className="block text-xs text-muted-foreground">Le total enregistré est celui des lignes ; la répartition par métier ne sert qu'à ventiler.</span>}
    </p>
  );
}

/**
 * Le montant du bon (BC-11, BC-33) : global, ou ventilé par métier dès deux
 * métiers — prérempli par les chapitres du devis lié. Dès qu'une ligne a du
 * contenu, ce sont les lignes qui font foi et le montant global n'est plus
 * qu'un affichage ; la ventilation, elle, reste saisissable.
 */
export function BlocMontantBon({ lignes, montant, onMontant, metiers, montantsParMetier, onMontantMetier, sansChapitre, erreur, lectureSeule }: Props) {
  useModeDiscret();
  const parLignes = lignesOntDuContenu(lignes);
  const ventile = metiers.length >= MIN_METIERS_VENTILES;
  if (!ventile) {
    if (parLignes) return <NoteLignes lignes={lignes} ventile={false} />;
    return (
      <div className="max-w-xs">
        <ChampTexte libelle="Montant global HT" inputMode="decimal" valeur={montant} erreur={erreur} aide="Sans ligne chiffrée, c'est ce montant qui vaut pour le bon." onChange={onMontant} desactive={lectureSeule} />
      </div>
    );
  }
  return (
    <fieldset className="flex max-w-md flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">Montant des travaux (HT) — par métier</legend>
      {metiers.map((m) => (
        <div key={m}>
          <ChampTexte libelle={`Montant HT — ${m}`} inputMode="decimal" valeur={montantsParMetier[m] ?? ""} onChange={(v) => onMontantMetier(m, v)} desactive={lectureSeule} />
          {sansChapitre.includes(m) && <p className="text-xs text-amber-700">⚠ Aucun chapitre « {m} » trouvé dans le devis lié — montant à saisir manuellement.</p>}
        </div>
      ))}
      {erreur && <p className="text-xs text-destructive">{erreur}</p>}
      {parLignes && <NoteLignes lignes={lignes} ventile />}
    </fieldset>
  );
}
