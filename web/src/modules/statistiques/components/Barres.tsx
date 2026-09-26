import { somme, type Montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { pourcentage } from "../domain/indicateurs";
import { tauxConducteur, type StatConducteur } from "../domain/statistiques";

/** `STATS_PALETTE` de l'ancien écran : une couleur par conducteur, dans l'ordre du chiffre d'affaires. */
const PALETTE = ["#FF6A1A", "#2E9BF0", "#5BC97A", "#F0A82E", "#9B6EF0", "#EF5A6F", "#2EC4C4", "#8C8C8C"] as const;
const VERT = "#5BC97A";
const ROUGE = "#EF5A6F";

/** Des barres de répartition (`renderStatsCARepartitionHTML`, app.js l. 12241), réutilisées par la vue par métier. */
export function BarresRepartition({ lignes }: { lignes: readonly { libelle: string; ht: Montant }[] }) {
  useModeDiscret();
  const total = somme(lignes.map((l) => l.ht));
  if (total.lte(0)) return <div className="empty">Aucun chiffre d&apos;affaires facturé pour l&apos;instant.</div>;
  const tri = [...lignes].sort((a, b) => b.ht.cmp(a.ht));
  return (
    <>
      {tri.map((l, i) => {
        const pct = pourcentage(l.ht, total);
        const couleur = PALETTE[i % PALETTE.length];
        return (
          <div key={l.libelle} className="stats-bar-row">
            <div className="stats-bar-label">
              <span className="stats-bar-dot" style={{ background: couleur }} />
              {l.libelle}
            </div>
            <div className="stats-bar-track">
              <div className="stats-bar-fill" style={{ width: `${pct}%`, background: couleur }} />
            </div>
            <div className="stats-bar-value">
              {formatEurosEcran(l.ht)} <span className="card-sub">({pct}%)</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

function BarresRetard({ stats }: { stats: readonly StatConducteur[] }) {
  if (!stats.some((s) => s.bons > 0)) return <div className="empty">Aucun bon de commande pour l&apos;instant.</div>;
  return (
    <>
      {stats.map((s) => {
        const t = tauxConducteur(s);
        const pctOk = s.bons ? t.tauxDansLesTemps : 0;
        const pctRetard = 100 - pctOk;
        return (
          <div key={s.conducteur_id ?? "sans"} className="stats-bar-row">
            <div className="stats-bar-label">{s.nom}</div>
            <div className="stats-bar-track stats-bar-track-split">
              {pctOk > 0 && <div className="stats-bar-seg" style={{ width: `${pctOk}%`, background: VERT }} title={`${t.dansLesTemps} dans les temps`} />}
              {pctRetard > 0 && <div className="stats-bar-seg" style={{ width: `${pctRetard}%`, background: ROUGE }} title={`${s.en_retard} en retard`} />}
            </div>
            <div className="stats-bar-value">
              <span style={{ color: "#2E9B4F" }}>{t.dansLesTemps}</span> / <span style={{ color: ROUGE }}>{s.en_retard}</span>
            </div>
          </div>
        );
      })}
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
export function GraphiquesConducteurs({ stats }: { stats: readonly StatConducteur[] }) {
  return (
    <div className="stats-charts-grid">
      <div className="card stats-chart-card">
        <div className="card-title">Répartition du chiffre d&apos;affaires</div>
        <div className="stats-ca-bars">
          <BarresRepartition lignes={stats.map((s) => ({ libelle: s.nom, ht: s.ht }))} />
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
          {stats.map((s) => {
            const t = tauxConducteur(s);
            return (
              <div key={s.conducteur_id ?? "sans"} className="stats-taux-bloc">
                <div className="stats-bar-label" style={{ marginBottom: "8px" }}>
                  {s.nom}
                </div>
                <MiniBarre libelle="Taux de SAV" taux={t.tauxSav} couleur="#F0A82E" />
                <MiniBarre libelle="Devis → facture" taux={t.tauxDevisTransformes} couleur="#9B6EF0" />
                <MiniBarre libelle="Travaux suppl." taux={t.tauxTravaux} couleur={ROUGE} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Le tableau par conducteur (app.js l. 12219), mêmes neuf colonnes. */
export function TableauConducteurs({ stats }: { stats: readonly StatConducteur[] }) {
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
          {stats.map((s) => {
            const t = tauxConducteur(s);
            return (
              <tr key={s.conducteur_id ?? "sans"}>
                <td>
                  <strong>{s.nom}</strong>
                </td>
                <td className="stats-num">{formatEurosEcran(s.ht)}</td>
                <td className="stats-num">{s.bons}</td>
                <td className="stats-num">
                  <span className="badge success">{t.tauxDansLesTemps}%</span> <span className="card-sub">({t.dansLesTemps})</span>
                </td>
                <td className="stats-num">
                  {s.en_retard > 0 ? <span className="badge danger">{t.tauxRetard}%</span> : <span className="badge">0%</span>} <span className="card-sub">({s.en_retard})</span>
                </td>
                <td className="stats-num">
                  {t.tauxSav}% <span className="card-sub">({s.sav})</span>
                </td>
                <td className="stats-num">{s.devis}</td>
                <td className="stats-num">
                  {t.tauxDevisTransformes}% <span className="card-sub">({s.devis_transformes})</span>
                </td>
                <td className="stats-num">
                  {t.tauxTravaux}% <span className="card-sub">({s.travaux})</span>
                  <br />
                  <span className="card-sub">{formatEurosEcran(s.travaux_ht)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
