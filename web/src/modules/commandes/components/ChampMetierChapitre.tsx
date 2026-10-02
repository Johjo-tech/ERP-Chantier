import { useContext } from "react";
import { Select } from "@/components/ui/input";
import type { PropsReferenceLigne } from "@/modules/documents/components/reference";
import { memeMetier, METIER_AUCUN, metierAffiche, metierChoisi } from "../domain/metiers";
import { MetiersConnus } from "./metiersConnus";

/**
 * Le métier d'un chapitre (BC-12, BC-53) : « Déduit du titre » (NULL),
 * « Aucun métier » (la sentinelle, un refus qui doit rester sélectionné) ou un
 * nom. Un choix hérité, retiré depuis des réglages, reste proposé.
 */
export function ChampMetierChapitre({ ligne, index, remplacer, desactive }: PropsReferenceLigne) {
  const connus = useContext(MetiersConnus);
  const affiche = metierAffiche(ligne, connus);
  const choisi = (ligne.metier ?? "").trim();
  const noms = choisi && !memeMetier(choisi, METIER_AUCUN) && !connus.some((n) => memeMetier(n, choisi)) ? [choisi, ...connus] : connus;
  const deduit = affiche.devine && affiche.valeur ? ` (lu : ${affiche.valeur})` : "";
  return (
    <div className="mt-1 flex items-center gap-2 text-xs">
      <label htmlFor={`metier-chapitre-${index}`} className="text-muted-foreground">Métier du chapitre</label>
      <Select
        id={`metier-chapitre-${index}`}
        className="h-8 max-w-56 text-xs"
        value={affiche.devine ? "" : affiche.valeur}
        disabled={desactive}
        onChange={(e) => remplacer({ ...ligne, metier: metierChoisi(e.target.value) })}
      >
        <option value="">{`— Déduit du titre —${deduit}`}</option>
        <option value={METIER_AUCUN}>— Aucun métier —</option>
        {noms.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </Select>
    </div>
  );
}
