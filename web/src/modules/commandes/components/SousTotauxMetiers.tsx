import { useContext } from "react";
import { somme } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { montantsParMetier } from "../domain/metiers";
import type { LigneDocument } from "../domain/prefacture";
import { MetiersConnus } from "./metiersConnus";

/** Ce que chaque métier pèse (`sousTotauxMetiersHTML`), sur le document fusionné, dès deux groupes. */
export function SousTotaux({ document }: { document: readonly LigneDocument[] }) {
  // Masqués en mode discret, comme tout montant à l'écran (DEF-REP-08, D-REP-08).
  useModeDiscret();
  const connus = useContext(MetiersConnus);
  const groupes = montantsParMetier(document, connus);
  if (groupes.length < 2) return null;
  const total = somme(groupes.map((g) => g.montantHt));
  return (
    <div className="pf-sous-totaux">
      <div className="section-title" style={{ margin: "14px 0 6px" }}>Sous-total par métier</div>
      <table className="lignes-table">
        <tbody>
          {groupes.map((g) => (
            <tr key={g.metier ?? "sans"}>
              <td>{g.metier ? <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-2)" }}>{g.metier}</span> : <span className="card-sub">Hors chapitre nommé</span>}</td>
              <td className="card-sub">{g.nbLignes} ligne{g.nbLignes > 1 ? "s" : ""}</td>
              <td className="num mono" style={{ fontWeight: 600 }}>{formatEurosEcran(g.montantHt)} HT</td>
            </tr>
          ))}
          <tr><td colSpan={2} style={{ fontWeight: 700 }}>Total HT</td><td className="num mono" style={{ fontWeight: 700 }}>{formatEurosEcran(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
