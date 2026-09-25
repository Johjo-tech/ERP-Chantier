import { useMemo } from "react";
import type { CartePlanning } from "../domain/cartes";
import { metiersDuBon } from "../domain/cartes";
import { referentielMetiers, travauxDeLaCarte } from "../domain/metiers";
import { useLignesDuBon } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

const quantiteLisible = (q: number | string | null, unite: string | null) => (q === null || q === "" ? "" : `${String(q).replace(".", ",")}${unite ? ` ${unite}` : ""}`);

/**
 * Les travaux du bon qui reviennent à cette carte, groupés par chapitre (le
 * titre nomme la pièce), SANS AUCUN PRIX — même pour qui les verrait :
 * le pointage se fait à la journée. Le métier de chaque chapitre se lit par
 * `metierDeLaLigne`, la règle même de l'écran du bon.
 */
export function TravauxPrevus({ carte }: { carte: CartePlanning }) {
  const { donnees } = usePlanningContexte();
  const lignes = useLignesDuBon(carte.bcId);
  const connus = useMemo(() => referentielMetiers(donnees.metiers.map((m) => m.libelle), donnees.bons.flatMap((b) => metiersDuBon(b))), [donnees]);
  const blocs = useMemo(
    () =>
      travauxDeLaCarte(
        (lignes.data ?? []).map((l) => ({ type: l.type, designation: l.designation, metier: l.metier, qte: l.quantite, unite: l.unite })),
        connus,
        carte.metier,
        metiersDuBon(carte.bon)[0] ?? null
      ),
    [lignes.data, connus, carte]
  );
  const total = blocs.reduce((n, b) => n + b.lignes.length, 0);
  if (!total) return null;
  return (
    <section aria-label="Travaux prévus au bon" className="rounded-md border bg-muted/30 p-2 text-sm">
      <h3 className="mb-1 font-semibold">📋 Travaux prévus au bon — {total} ligne{total > 1 ? "s" : ""}</h3>
      {blocs.map((bloc, i) => (
        <div key={`${bloc.chapitre ?? ""}-${i}`}>
          {bloc.chapitre && <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">{bloc.chapitre}</p>}
          <ul className="ml-3 list-disc">
            {bloc.lignes.map((l, j) => (
              <li key={j} className={l.type === "commentaire" ? "italic text-muted-foreground" : undefined}>
                {l.designation}
                {quantiteLisible(l.qte ?? null, l.unite ?? null) && <span className="ml-2 text-xs text-muted-foreground">{quantiteLisible(l.qte ?? null, l.unite ?? null)}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
