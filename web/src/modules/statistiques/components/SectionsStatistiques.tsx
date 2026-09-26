import { useModeDiscret } from "@/lib/modeDiscret";
import { moisLabelCourt, totalEquipe, type TableauEquipesAncien } from "../domain/ancien/statistiques";
import { formatEurosEcranAncien } from "./format";

/**
 * Chiffre d'affaires par équipe et par mois (`renderStatsBinomesHTML`,
 * app.js l. 12146) : rien d'affiché sans facture ; une case à zéro (un avoir
 * qui annule une facture du même mois) s'écrit « — », comme l'ancien.
 */
export function StatsEquipes({ t }: { t: TableauEquipesAncien }) {
  useModeDiscret();
  if (!t.binomes.length) return null;
  return (
    <>
      <div className="page-head" style={{ marginTop: "28px" }}>
        <h1 style={{ fontSize: "19px" }}>Chiffre d&apos;affaires par équipe et par mois</h1>
      </div>
      <div className="card-sub" style={{ marginBottom: "12px" }}>
        Basé sur la date des factures émises, rattachées au technicien (seul, binôme ou trinôme) du bon de commande d&apos;origine.
      </div>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Équipe</th>
              {t.mois.map((m) => (
                <th key={m} className="stats-num">
                  {moisLabelCourt(m)}
                </th>
              ))}
              <th className="stats-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {t.binomes.map((b) => (
              <tr key={b}>
                <td>
                  <strong>{b}</strong>
                </td>
                {t.mois.map((m) => {
                  const v = t.parBinome[b]?.[m];
                  return (
                    <td key={m} className="stats-num">
                      {v ? formatEurosEcranAncien(v) : <span className="card-sub">—</span>}
                    </td>
                  );
                })}
                <td className="stats-num">
                  <strong>{formatEurosEcranAncien(totalEquipe(t, b))}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
