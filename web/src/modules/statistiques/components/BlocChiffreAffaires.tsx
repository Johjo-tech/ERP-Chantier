import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modale } from "@/components/ui/modale";
import { formatDateFr, partiesIso } from "@/lib/dates";
import { useModeDiscret } from "@/lib/modeDiscret";
import { revenuPeriode, revenuPlage, type FacturePilotage } from "../domain/ancien/pilotage";
import { moisGlissants, MOIS_GRAPHIQUE, premierDuMois, refusPlage, type PeriodeGraphique } from "../domain/periodes";
import { GraphiqueCA } from "./GraphiqueCA";
import { Section } from "./Tuile";
import { formatEurosEcranAncien } from "./format";

/** Les choix de l'ancien sélecteur, dans son ordre (`.dash-period-select`) : « Depuis janvier » n'y figurait pas. */
const OPTIONS: readonly [PeriodeGraphique | "custom", string][] = [
  ["6m", "6 mois"],
  ["12m", "12 mois"],
  ["custom", "Sélectionner les dates"],
];

/**
 * « Chiffre d'affaires (HT) » (`.dash-revenue-full`) : 6 ou 12 mois face à
 * N-1, et « Sélectionner les dates » qui ouvre la fenêtre du total sur une
 * plage libre (`revenueCustomModal`). Le chiffre est celui de l'ancien :
 * toutes les factures datées, brouillons et acomptes compris, avoirs en
 * négatif (D-STA-A-01).
 */
export function BlocChiffreAffaires({ factures, jour }: { factures: readonly FacturePilotage[]; jour: string }) {
  useModeDiscret();
  const [periode, setPeriode] = useState<PeriodeGraphique>("6m");
  const [plage, setPlage] = useState(false);
  const mois = moisGlissants(MOIS_GRAPHIQUE[periode], jour);
  const serie = revenuPeriode(
    factures,
    mois.map((m) => ({ year: m.annee, month: m.mois - 1 })),
    partiesIso(jour).annee
  );
  return (
    <div className="dash-revenue-full">
      <Section
        titre="Chiffre d'affaires (HT)"
        style={{ marginTop: 0 }}
        aDroite={
          <div className="dash-revenue-controls">
            <span className="dash-revenue-total">
              Total période : <b>{formatEurosEcranAncien(serie.total)}</b>
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
          <GraphiqueCA serie={serie} mois={mois} />
        </div>
      </Section>
      {plage && <PlageLibre factures={factures} jour={jour} onFermer={() => setPlage(false)} />}
    </div>
  );
}

/** `revenueCustomModal` / `computeCustomRevenue` : le total HT entre deux dates, et le nombre de pièces. */
function PlageLibre({ factures, jour, onFermer }: { factures: readonly FacturePilotage[]; jour: string; onFermer: () => void }) {
  useModeDiscret();
  const [saisie, setSaisie] = useState({ du: premierDuMois(jour), au: jour });
  const [retenue, setRetenue] = useState<{ du: string; au: string } | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const calculer = () => {
    const r = refusPlage(saisie.du, saisie.au);
    setRefus(r);
    setRetenue(r ? null : { ...saisie });
  };
  const total = retenue ? revenuPlage(factures, retenue.du, retenue.au) : null;
  return (
    <Modale titre="Chiffre d'affaires — période personnalisée" onFermer={onFermer} largeurMax="380px">
      <div className="field">
        <label htmlFor="revenue_date_from">Du</label>
        <input type="date" id="revenue_date_from" value={saisie.du} onChange={(e) => setSaisie((s) => ({ ...s, du: e.target.value }))} />
      </div>
      <div className="field" style={{ marginTop: "10px" }}>
        <label htmlFor="revenue_date_to">Au</label>
        <input type="date" id="revenue_date_to" value={saisie.au} onChange={(e) => setSaisie((s) => ({ ...s, au: e.target.value }))} />
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
        {retenue && total && (
          <>
            <div className="summary-row" style={{ marginTop: "18px" }}>
              <span>
                Du {formatDateFr(retenue.du)} au {formatDateFr(retenue.au)}
              </span>
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text)", fontFamily: "'JetBrains Mono',monospace", marginTop: "6px" }}>{formatEurosEcranAncien(total.total)}</div>
            <div className="card-sub" style={{ marginTop: "4px" }}>
              {total.nombre} facture{total.nombre > 1 ? "s" : ""}
            </div>
          </>
        )}
      </div>
    </Modale>
  );
}
