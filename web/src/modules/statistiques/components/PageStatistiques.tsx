import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Icone } from "@/components/ui/icones";
import { todayISO } from "@/lib/dates";
import { useModeDiscret } from "@/lib/modeDiscret";
import { bornesStats, PERIODES_STATS, refusPlage, type Bornes, type PeriodeStats } from "../domain/periodes";
import { useParClient, useParConducteur } from "../hooks/useStatistiques";
import { GraphiquesConducteurs, TableauConducteurs } from "./Barres";
import { StatsClients, StatsEquipes, StatsMetiers } from "./SectionsStatistiques";

/**
 * Statistiques, au HTML de `renderStatistiques` (app.js l. 12168) : en-tête et
 * période, trois tuiles, les graphiques et le tableau par conducteur, puis le
 * chiffre d'affaires par équipe et par mois. Toujours par la RÉFÉRENCE du
 * conducteur, jamais par son nom (D-STA-05). En plus de l'ancien (décidés) :
 * une plage de dates libre, et les vues par métier et par client, repliées au
 * bas de l'écran (D-ECR-PAR-13).
 */
export function PageStatistiques() {
  useModeDiscret();
  const jour = todayISO();
  const [periode, setPeriode] = useState<PeriodeStats>("tout");
  const [plage, setPlage] = useState<Bornes>({ du: null, au: null });
  const refus = periode === "plage" ? refusPlage(plage.du ?? "", plage.au ?? "") : null;
  const bornes = bornesStats(periode, jour, plage);

  return (
    <>
      <div className="page-head">
        <h1>Statistiques par conducteur de travaux</h1>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {periode === "plage" && (
            <>
              <input type="date" aria-label="Du" value={plage.du ?? ""} onChange={(e) => setPlage((p) => ({ ...p, du: e.target.value || null }))} style={{ width: "auto" }} />
              <input type="date" aria-label="Au" value={plage.au ?? ""} onChange={(e) => setPlage((p) => ({ ...p, au: e.target.value || null }))} style={{ width: "auto" }} />
            </>
          )}
          <select aria-label="Période" style={{ width: "auto", minWidth: "170px" }} value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeStats)}>
            {Object.entries(PERIODES_STATS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="card-sub" style={{ marginBottom: "14px", marginTop: "-8px" }}>
        Période affichée : <strong>{PERIODES_STATS[periode].toLowerCase()}</strong>. « Travaux supplémentaires » = part des bons de commande ayant eu au moins un travail signalé en plus (par le technicien, le conducteur ou le directeur), leur nombre, et leur montant une fois chiffrés en pré-facture.
      </div>
      {refus ? <div className="empty">{refus}</div> : <Contenu bornes={bornes} jour={jour} />}
    </>
  );
}

function Tuile({ icone, fond, couleur, libelle, valeur }: { icone: "devis" | "factures" | "bonsCommande"; fond: string; couleur: string; libelle: string; valeur: number }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-icon" style={{ background: fond, color: couleur }}>
          <Icone nom={icone} />
        </span>
      </div>
      <div className="stat-label">{libelle}</div>
      <div className="stat-num">{valeur}</div>
    </div>
  );
}

function Contenu({ bornes, jour }: { bornes: Bornes; jour: string }) {
  const q = useParConducteur(bornes, jour);
  const clients = useParClient(bornes, null);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  const stats = q.data;
  const nbFactures = (clients.data ?? []).reduce((n, c) => n + c.nb_factures, 0);
  return (
    <>
      <div className="grid-stats" style={{ marginBottom: "18px" }}>
        <Tuile icone="devis" fond="var(--info-soft)" couleur="var(--info)" libelle="Devis effectués" valeur={stats.reduce((n, s) => n + s.devis, 0)} />
        <Tuile icone="factures" fond="var(--success-soft)" couleur="var(--success)" libelle="Factures effectuées" valeur={nbFactures} />
        <Tuile icone="bonsCommande" fond="var(--accent-soft)" couleur="var(--accent)" libelle="Bons de commande" valeur={stats.reduce((n, s) => n + s.bons, 0)} />
      </div>
      {!stats.length ? (
        <div className="empty">Aucune donnée pour l&apos;instant — attribuez un conducteur de travaux à vos bons de commande, devis ou factures.</div>
      ) : (
        <>
          <div className="card-sub" style={{ marginBottom: "16px" }}>
            « En retard » = date de fin de travaux prévue dépassée sans que le bon de commande ait été refermé. « Taux de devis transformé » = part des devis pour lesquels une facture a été émise.
          </div>
          <GraphiquesConducteurs stats={stats} />
          <TableauConducteurs stats={stats} />
        </>
      )}
      <StatsEquipes bornes={bornes} />
      <details style={{ marginTop: "28px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Par métier</summary>
        <div style={{ marginTop: "12px" }}>
          <StatsMetiers bornes={bornes} jour={jour} />
        </div>
      </details>
      <details style={{ marginTop: "12px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Par client</summary>
        <div style={{ marginTop: "12px" }}>
          <StatsClients bornes={bornes} />
        </div>
      </details>
    </>
  );
}
