import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { Modale } from "@/components/ui/modale";
import { formatDateFr } from "@/lib/dates";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { serieComparee, totalDesMois } from "../domain/indicateurs";
import { bornesComparaison, bornesDuMois, moisDeLaPeriode, refusPlage, type Bornes } from "../domain/periodes";
import { useCaParMois } from "../hooks/useStatistiques";
import { GraphiqueCA } from "./GraphiqueCA";
import { Section } from "./Tuile";

/** Les choix de l'ancien sélecteur, dans son ordre (`.dash-period-select`) : « Depuis janvier » n'y figurait pas. */
type Periode = "6m" | "12m";
const OPTIONS: readonly [Periode | "custom", string][] = [
  ["6m", "6 mois"],
  ["12m", "12 mois"],
  ["custom", "Sélectionner les dates"],
];

/**
 * « Chiffre d'affaires (HT) » (`.dash-revenue-full`) : 6 ou 12 mois face à
 * N-1, et « Sélectionner les dates » qui ouvre la fenêtre du total sur une
 * plage libre (`revenueCustomModal`). La définition du chiffre (factures
 * émises, avoirs déduits, acomptes exclus — D-STA-02) est dans l'infobulle du
 * titre : l'ancien écran n'avait pas de place pour elle.
 */
export function BlocChiffreAffaires({ jour }: { jour: string }) {
  useModeDiscret();
  const [periode, setPeriode] = useState<Periode>("6m");
  const [plage, setPlage] = useState(false);
  const mois = moisDeLaPeriode(periode, jour);
  const ca = useCaParMois(bornesComparaison(mois));
  const serie = ca.isSuccess ? serieComparee(ca.data, mois) : null;
  return (
    <div className="dash-revenue-full">
      <Section
        titre={<span title="Factures émises à leur date, avoirs en déduction ; ni brouillons ni factures d'acompte (déjà comprises dans la facture de solde).">Chiffre d'affaires (HT)</span>}
        style={{ marginTop: 0 }}
        aDroite={
          <div className="dash-revenue-controls">
            <span className="dash-revenue-total">
              Total période : <b>{serie ? formatEurosEcran(serie.total) : "…"}</b>
            </span>
            <select
              className="dash-period-select"
              aria-label="Période"
              value={periode}
              onChange={(e) => {
                if (e.target.value === "custom") setPlage(true);
                else setPeriode(e.target.value === "12m" ? "12m" : "6m");
              }}
            >
              {OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="card dash-revenue-card">
          {ca.isPending ? <Chargement /> : ca.isError ? <Erreur erreur={ca.error} reessayer={() => void ca.refetch()} /> : serie && <GraphiqueCA serie={serie} />}
        </div>
      </Section>
      {plage && <PlageLibre jour={jour} onFermer={() => setPlage(false)} />}
    </div>
  );
}

/** `revenueCustomModal` / `computeCustomRevenue` : le total HT entre deux dates, et le nombre de pièces. */
function PlageLibre({ jour, onFermer }: { jour: string; onFermer: () => void }) {
  useModeDiscret();
  const [saisie, setSaisie] = useState<Bornes>(() => ({ du: bornesDuMois(jour).du, au: jour }));
  const [retenue, setRetenue] = useState<Bornes | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const ca = useCaParMois(retenue ?? { du: null, au: null }, !!retenue);
  const calculer = () => {
    const r = refusPlage(saisie.du ?? "", saisie.au ?? "");
    setRefus(r);
    setRetenue(r ? null : { ...saisie });
  };
  const total = ca.isSuccess ? totalDesMois(ca.data) : null;
  return (
    <Modale titre="Chiffre d'affaires — période personnalisée" onFermer={onFermer} largeurMax="380px">
      <div className="field">
        <label htmlFor="revenue_date_from">Du</label>
        <input type="date" id="revenue_date_from" value={saisie.du ?? ""} onChange={(e) => setSaisie((s) => ({ ...s, du: e.target.value }))} />
      </div>
      <div className="field" style={{ marginTop: "10px" }}>
        <label htmlFor="revenue_date_to">Au</label>
        <input type="date" id="revenue_date_to" value={saisie.au ?? ""} onChange={(e) => setSaisie((s) => ({ ...s, au: e.target.value }))} />
      </div>
      <Button style={{ marginTop: "14px", width: "100%", justifyContent: "center" }} onClick={calculer}>
        Voir le chiffre d'affaires
      </Button>
      <div id="revenueCustomResult" aria-live="polite">
        {refus && (
          <div className="card-sub" role="alert" style={{ marginTop: "12px", color: "var(--danger)" }}>
            {refus}
          </div>
        )}
        {retenue && ca.isPending && <Chargement />}
        {retenue && ca.isError && <Erreur erreur={ca.error} reessayer={() => void ca.refetch()} />}
        {retenue && total && (
          <>
            <div className="summary-row" style={{ marginTop: "18px" }}>
              <span>
                Du {formatDateFr(retenue.du)} au {formatDateFr(retenue.au)}
              </span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text)", fontFamily: "'JetBrains Mono',monospace", marginTop: "6px" }}>{formatEurosEcran(total.ht)}</div>
            <div className="card-sub" style={{ marginTop: "4px" }}>
              {total.nb} facture{total.nb > 1 ? "s" : ""}
            </div>
          </>
        )}
      </div>
    </Modale>
  );
}
