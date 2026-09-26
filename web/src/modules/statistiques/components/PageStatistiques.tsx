import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Icone } from "@/components/ui/icones";
import { todayISO } from "@/lib/dates";
import { useModeDiscret } from "@/lib/modeDiscret";
import { equipesParMois, periodeLabel, PERIODES_STATS, statsParConducteur, totauxStats, type PeriodeStats } from "../domain/ancien/statistiques";
import { useDonneesStatistiques, type DonneesStatistiques } from "../hooks/useStatistiques";
import { GraphiquesConducteurs, TableauConducteurs } from "./Barres";
import { StatsEquipes } from "./SectionsStatistiques";

/**
 * Statistiques, au HTML et aux calculs de `renderStatistiques` (app.js
 * l. 12168) : en-tête et période, trois tuiles, les graphiques et le tableau
 * par conducteur, puis le chiffre d'affaires par équipe et par mois. Par
 * l'ÉTIQUETTE du conducteur portée par les pièces, comme l'ancien (D-STA-A-01).
 */
export function PageStatistiques() {
  useModeDiscret();
  const [periode, setPeriode] = useState<PeriodeStats>("tout");
  const { donnees, erreur, reessayer } = useDonneesStatistiques();
  const jour = todayISO();
  const maintenant = new Date();
  return (
    <>
      <div className="page-head">
        <h1>Statistiques par conducteur de travaux</h1>
        <select aria-label="Période" style={{ width: "auto", minWidth: "170px" }} value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeStats)}>
          {Object.entries(PERIODES_STATS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="card-sub" style={{ marginBottom: "14px", marginTop: "-8px" }}>
        Période affichée : <strong>{periodeLabel(periode, jour, maintenant)}</strong>. « Travaux supplémentaires » = part des bons de commande ayant eu au moins un travail signalé en plus (par le technicien, le conducteur ou le directeur), leur nombre, et leur montant une fois chiffrés en pré-facture.
      </div>
      {erreur ? <Erreur erreur={erreur} reessayer={reessayer} /> : !donnees ? <Chargement /> : <Contenu d={donnees} periode={periode} jour={jour} maintenant={maintenant} />}
    </>
  );
}

function Tuile({ icone, fond, couleur, libelle, valeur }: { icone: "devis" | "factures" | "bonsCommande"; fond: string; couleur: string; libelle: string; valeur: number }) {
  useModeDiscret();
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

function Contenu({ d, periode, jour, maintenant }: { d: DonneesStatistiques; periode: PeriodeStats; jour: string; maintenant: Date }) {
  useModeDiscret();
  const stats = statsParConducteur(d, periode, jour, maintenant);
  const totaux = totauxStats(d, periode, maintenant);
  return (
    <>
      <div className="grid-stats" style={{ marginBottom: "18px" }}>
        <Tuile icone="devis" fond="var(--info-soft)" couleur="var(--info)" libelle="Devis effectués" valeur={totaux.devis} />
        <Tuile icone="factures" fond="var(--success-soft)" couleur="var(--success)" libelle="Factures effectuées" valeur={totaux.factures} />
        <Tuile icone="bonsCommande" fond="var(--accent-soft)" couleur="var(--accent)" libelle="Bons de commande" valeur={totaux.bons} />
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
      <StatsEquipes t={equipesParMois(d.factures, d.bons, d.equipes, periode, maintenant)} />
    </>
  );
}
