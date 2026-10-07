import type { PropsReferenceLigne } from "@/modules/documents/components/reference";
import { memeMetier, METIER_AUCUN, metierAffiche, metierChoisi, type LigneChapitrable } from "../domain/metiers";
import { useMetiersDisponibles } from "../hooks/useBons";

/** Le texte de l'infobulle dit d'où vient la valeur : une déduction fausse doit se voir avant d'engager une équipe. */
function titreDuChoix(devine: boolean, valeur: string): string {
  if (!devine) return "Métier choisi pour ce chapitre";
  return valeur ? "Lu sur le titre du chapitre — choisissez pour le figer" : "Aucun métier reconnu dans ce titre";
}

interface Props {
  ligne: LigneChapitrable;
  connus: readonly string[];
  onChange: (metier: string | null) => void;
  desactive?: boolean;
}

/**
 * La liste « métier du chapitre » de l'ancien écran (`chapitreMetierHTML`, `metierPrefactureHTML`,
 * `metierChapitreOptions`) : même `<select class="chapitre-metier">`, mêmes options, même infobulle.
 * La valeur affichée est celle de `metierAffiche` — le métier LU sur le titre reste sélectionné, en
 * retrait (`est-deduit`), tant que personne n'a tranché. « — Déduit du titre — » écrit `null`, jamais
 * `""` : sinon le refus (`METIER_AUCUN`) et l'absence se confondraient à l'enregistrement.
 */
export function SelectMetierChapitre({ ligne, connus, onChange, desactive = false }: Props) {
  const vu = metierAffiche(ligne, connus);
  const choisi = vu.valeur.trim();
  // Un choix hérité, retiré depuis des réglages, reste proposé en tête — comme `noms.unshift(choisi)`.
  const noms = choisi && !memeMetier(choisi, METIER_AUCUN) && !connus.some((n) => memeMetier(n, choisi)) ? [choisi, ...connus] : connus;
  const classes = ["chapitre-metier", vu.devine ? "est-deduit" : "", vu.certitude === "approchant" ? "est-approchant" : ""].filter(Boolean).join(" ");
  // L'ancien sélectionne l'option qui désigne le même métier (`memeMetier`), casse et accents ignorés :
  // un « plomberie » écrit à la main sélectionne « Plomberie », pas la première option.
  const selection = choisi === "" ? "" : memeMetier(choisi, METIER_AUCUN) ? METIER_AUCUN : (noms.find((n) => memeMetier(n, choisi)) ?? choisi);
  return (
    <select className={classes} title={titreDuChoix(vu.devine, vu.valeur)} aria-label="Métier du chapitre" value={selection} disabled={desactive} onChange={(e) => onChange(metierChoisi(e.target.value))}>
      <option value="">— Déduit du titre —</option>
      <option value={METIER_AUCUN}>— Aucun métier —</option>
      {noms.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

/**
 * Le même champ, branché dans l'éditeur de lignes des devis et des factures (`LignesAncien`) : l'ancien
 * le montrait sur tout chapitre, quel que soit le document (`chapitreRow`). Les métiers proposés sont
 * ceux de `metiersDisponibles` — déclarés aux réglages, puis employés par les bons.
 */
export function ChampMetierAncien({ ligne, remplacer, desactive }: PropsReferenceLigne) {
  const connus = useMetiersDisponibles();
  return <SelectMetierChapitre ligne={ligne} connus={connus} desactive={desactive} onChange={(metier) => remplacer({ ...ligne, metier })} />;
}
