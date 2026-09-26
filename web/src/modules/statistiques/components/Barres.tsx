import { useModeDiscret } from "@/lib/modeDiscret";
import { repartitionCA, retardParConducteur, type StatConducteurAncien } from "../domain/ancien/statistiques";
import { formatEurosEcranAncien } from "./format";

/** `STATS_PALETTE` de l'ancien écran : une couleur par conducteur, dans l'ordre du chiffre d'affaires. */
const PALETTE = ["#FF6A1A", "#2E9BF0", "#5BC97A", "#F0A82E", "#9B6EF0", "#EF5A6F", "#2EC4C4", "#8C8C8C"] as const;
const VERT = "#5BC97A";
const ROUGE = "#EF5A6F";

/** `renderStatsCARepartitionHTML` (app.js l. 12241) : sans chiffre d'affaires au total, le message vide. */
function BarresRepartition({ stats }: { stats: readonly StatConducteurAncien[] }) {
  useModeDiscret();
  const lignes = repartitionCA(stats);
  if (!lignes) return <div className="empty">Aucun chiffre d&apos;affaires facturé pour l&apos;instant.</div>;
  return (
    <>
      {lignes.map(({ stat, part }, i) => {
        const couleur = PALETTE[i % PALETTE.length];
        return (
          <div key={stat.nom} className="stats-bar-row">
            <div className="stats-bar-label">
              <span className="stats-bar-dot" style={{ background: couleur }} />
              {stat.nom}
            </div>
            <div className="stats-bar-track">
              <div className="stats-bar-fill" style={{ width: `${part}%`, background: couleur }} />
            </div>
            <div className="stats-bar-value">
              {formatEurosEcranAncien(stat.ca)} <span className="card-sub">({part}%)</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** `renderStatsRetardHTML` (app.js l. 12255). */
function BarresRetard({ stats }: { stats: readonly StatConducteurAncien[] }) {
  useModeDiscret();
  const lignes = retardParConducteur(stats);
  if (!lignes) return <div className="empty">Aucun bon de commande pour l&apos;instant.</div>;
  return (
    <>
      {lignes.map(({ stat, pctOk, pctRetard }) => (
        <div key={stat.nom} className="stats-bar-row">
          <div className="stats-bar-label">{stat.nom}</div>
          <div className="stats-bar-track stats-bar-track-split">
            {pctOk > 0 && <div className="stats-bar-seg" style={{ width: `${pctOk}%`, background: VERT }} title={`${stat.bcDansLesTemps} dans les temps`} />}
            {pctRetard > 0 && <div className="stats-bar-seg" style={{ width: `${pctRetard}%`, background: ROUGE }} title={`${stat.bcEnRetard} en retard`} />}
          </div>
          <div className="stats-bar-value">
            <span style={{ color: "#2E9B4F" }}>{stat.bcDansLesTemps}</span> / <span style={{ color: ROUGE }}>{stat.bcEnRetard}</span>
          </div>
        </div>
      ))}
      <div className="stats-legend">
        <span>
          <i style={{ background: VERT }} /> Dans les temps
        </span>
        <span>
          <i style={{ background: ROUGE }} /> En retard
        </span>
      </div>
    </>
  );
}

function MiniBarre({ libelle, taux, couleur }: { libelle: string; taux: number; couleur: string }) {
  useModeDiscret();
  return (
    <div className="stats-mini-bar-row">
      <span className="stats-mini-label">{libelle}</span>
      <div className="stats-bar-track">
        <div className="stats-bar-fill" style={{ width: `${taux}%`, background: couleur }} />
      </div>
      <span className="stats-mini-value">{taux}%</span>
    </div>
  );
}

/** Les trois cartes de `.stats-charts-grid` (app.js l. 12205). */
export function GraphiquesConducteurs({ stats }: { stats: readonly StatConducteurAncien[] }) {
  useModeDiscret();
  return (
    <div className="stats-charts-grid">
      <div className="card stats-chart-card">
        <div className="card-title">Répartition du chiffre d&apos;affaires</div>
        <div className="stats-ca-bars">
          <BarresRepartition stats={stats} />
        </div>
      </div>
      <div className="card stats-chart-card">
        <div className="card-title">Bons de commande — dans les temps / en retard</div>
        <div className="stats-retard-bars">
          <BarresRetard stats={stats} />
        </div>
      </div>
      <div className="card stats-chart-card stats-chart-card-wide">
        <div className="card-title">Taux comparés (SAV, devis transformés, travaux suppl.)</div>
        <div className="stats-taux-bars">
          {!stats.length ? (
            <div className="empty">Aucune donnée pour l&apos;instant.</div>
          ) : (
            stats.map((s) => (
              <div key={s.nom} className="stats-taux-bloc">
                <div className="stats-bar-label" style={{ marginBottom: "8px" }}>
                  {s.nom}
                </div>
                <MiniBarre libelle="Taux de SAV" taux={s.tauxSAV} couleur="#F0A82E" />
                <MiniBarre libelle="Devis → facture" taux={s.tauxDevisTransforme} couleur="#9B6EF0" />
                <MiniBarre libelle="Travaux suppl." taux={s.tauxTravSup} couleur={ROUGE} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Le tableau par conducteur (app.js l. 12219), mêmes neuf colonnes. */
export function TableauConducteurs({ stats }: { stats: readonly StatConducteurAncien[] }) {
  useModeDiscret();
  return (
    <div className="stats-table-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Conducteur</th>
            <th>Chiffre d&apos;affaires (HT)</th>
            <th>Bons de commande</th>
            <th>Dans les temps</th>
            <th>En retard</th>
            <th>Taux de SAV</th>
            <th>Devis émis</th>
            <th>Taux devis → facture</th>
            <th>Travaux supplémentaires</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.nom}>
              <td>
                <strong>{s.nom}</strong>
              </td>
              <td className="stats-num">{formatEurosEcranAncien(s.ca)}</td>
              <td className="stats-num">{s.bcTotal}</td>
              <td className="stats-num">
                <span className="badge success">{s.tauxDansLesTemps}%</span> <span className="card-sub">({s.bcDansLesTemps})</span>
              </td>
              <td className="stats-num">
                {s.bcEnRetard > 0 ? <span className="badge danger">{100 - s.tauxDansLesTemps}%</span> : <span className="badge">0%</span>} <span className="card-sub">({s.bcEnRetard})</span>
              </td>
              <td className="stats-num">
                {s.tauxSAV}% <span className="card-sub">({s.bcSAV})</span>
              </td>
              <td className="stats-num">{s.devisTotal}</td>
              <td className="stats-num">
                {s.tauxDevisTransforme}% <span className="card-sub">({s.devisTransformes})</span>
              </td>
              <td className="stats-num">
                {s.tauxTravSup}% <span className="card-sub">({s.nbTravSup})</span>
                <br />
                <span className="card-sub">{formatEurosEcranAncien(s.montantTravSup)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
