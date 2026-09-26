import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ZERO } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { pourcentage } from "../domain/indicateurs";
import type { Bornes } from "../domain/periodes";
import { moisLabelCourt } from "../domain/periodes";
import { lienClient } from "../domain/pilotage";
import { tableauEquipes } from "../domain/statistiques";
import { useCaParEquipe, useParClient, useParMetier } from "../hooks/useStatistiques";
import { BarresRepartition } from "./Barres";

/**
 * Par métier (ajout décidé, D-STA-05) : un bon compte dans chacun de ses
 * métiers ; son chiffre d'affaires, seulement s'il n'en a qu'un.
 */
export function StatsMetiers({ bornes, jour }: { bornes: Bornes; jour: string }) {
  useModeDiscret();
  const q = useParMetier(bornes, jour);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  if (!q.data.length) return <div className="empty">Aucun bon de commande ni facture sur cette période.</div>;
  return (
    <>
      <div className="card stats-chart-card" style={{ marginBottom: "12px" }}>
        <div className="card-title">Chiffre d&apos;affaires par métier</div>
        <div className="stats-ca-bars">
          <BarresRepartition lignes={q.data.map((m) => ({ libelle: m.metier, ht: m.ht }))} />
        </div>
      </div>
      <div className="card-sub" style={{ marginBottom: "8px" }}>
        Le chiffre d&apos;affaires d&apos;un bon multi-métiers n&apos;est pas ventilé : il figure sous « Plusieurs métiers ». Une facture sans bon d&apos;origine figure sous « Hors bon de commande ».
      </div>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Métier</th>
              <th>Chiffre d&apos;affaires (HT)</th>
              <th>Bons de commande</th>
              <th>Taux de SAV</th>
              <th>En retard</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((m) => (
              <tr key={m.metier}>
                <td>
                  <strong>{m.metier}</strong>
                </td>
                <td className="stats-num">{formatEurosEcran(m.ht)}</td>
                <td className="stats-num">{m.bons}</td>
                <td className="stats-num">
                  {pourcentage(m.sav, m.bons)}% <span className="card-sub">({m.sav})</span>
                </td>
                <td className="stats-num">
                  {pourcentage(m.en_retard, m.bons)}% <span className="card-sub">({m.en_retard})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Par client (ajout décidé, D-STA-05) : chiffre d'affaires, restant dû, devis — le dossier de règlements à un clic. */
export function StatsClients({ bornes }: { bornes: Bornes }) {
  useModeDiscret();
  const q = useParClient(bornes, null);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  if (!q.data.length) return <div className="empty">Aucune facture ni aucun devis sur cette période.</div>;
  return (
    <>
      <div className="card-sub" style={{ marginBottom: "8px" }}>
        Restant dû : ce que doivent encore les factures de la période (avoirs non compris).
      </div>
      <div className="stats-table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Chiffre d&apos;affaires (HT)</th>
              <th>Factures</th>
              <th>Restant dû</th>
              <th>Devis émis</th>
              <th>Devis acceptés</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((c, i) => (
              <tr key={c.client_id ?? c.client_nom ?? i}>
                <td>
                  <Link to={lienClient(c)}>
                    <strong>{c.client_nom ?? "Client sans nom"}</strong>
                  </Link>
                </td>
                <td className="stats-num">{formatEurosEcran(c.ht)}</td>
                <td className="stats-num">{c.nb_factures}</td>
                <td className="stats-num">{formatEurosEcran(c.du)}</td>
                <td className="stats-num">{c.nb_devis}</td>
                <td className="stats-num">
                  {pourcentage(c.devis_acceptes, c.nb_devis)}% <span className="card-sub">({c.devis_acceptes})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Chiffre d'affaires par équipe et par mois (`renderStatsBinomesHTML`, app.js l. 12146) : rien d'affiché sans facture. */
export function StatsEquipes({ bornes }: { bornes: Bornes }) {
  useModeDiscret();
  const q = useCaParEquipe(bornes);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  const t = tableauEquipes(q.data);
  if (!t.equipes.length) return null;
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
            {t.equipes.map((e) => (
              <tr key={e.nom}>
                <td>
                  <strong>{e.nom}</strong>
                </td>
                {t.mois.map((m) => (
                  <td key={m} className="stats-num">
                    {e.parMois.has(m) ? formatEurosEcran(e.parMois.get(m) ?? ZERO) : <span className="card-sub">—</span>}
                  </td>
                ))}
                <td className="stats-num">
                  <strong>{formatEurosEcran(e.total)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
