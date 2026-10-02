import { useState } from "react";
import { formatEuros, formatTaux, type Montant } from "@/lib/money";
import type { LigneEdition } from "../domain/lignes";
import { remiseDepuisCible, totauxDocument } from "../domain/totaux";

interface Props {
  lignes: readonly LigneEdition[];
  /** Le taux saisi, tel qu'il s'écrit (« 10 », « 5,5 »). */
  remise: string;
  onRemise: (pct: string) => void;
}

/**
 * « Remise & totaux » de l'ancien écran (`remiseAndTotalsHTML`,
 * `totalsBoxInnerHTML`, app.js l. 3252) : la boîte des totaux — le détail par
 * taux dès qu'il y en a deux —, puis la remise saisie en taux, ou déduite d'un
 * montant HT ou TTC visé. Le calcul est celui de la règle des totaux.
 */
export function TotauxAncien({ lignes, remise, onRemise }: Props) {
  const lu = lignes.map((l) => ({ type: l.type, quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva: l.tva }));
  const t = totauxDocument(lu, remise);
  // Le champ qu'on tape garde sa saisie ; les deux autres suivent le taux (`refreshRemiseUI`).
  const [enSaisie, setEnSaisie] = useState<{ champ: "pct" | "ht" | "ttc"; valeur: string } | null>(null);
  const avecRemise = t.remisePct.gt(0);
  const valeur = (champ: "pct" | "ht" | "ttc", calculee: string) => (enSaisie?.champ === champ ? enSaisie.valeur : calculee);
  const ligne = (libelle: string, m: Montant) => <div key={libelle}>{libelle} <b>{formatEuros(m)}</b></div>;
  const tva =
    t.ventilation.length > 1
      ? [...t.ventilation.map((p) => ligne(`TVA ${formatTaux(p.taux)} sur ${formatEuros(p.base)}`, p.montant)), ligne("Total TVA", t.tva)]
      : [ligne(t.ventilation[0] ? `TVA ${formatTaux(t.ventilation[0].taux)}` : "TVA", t.tva)];

  function saisirMontant(v: string, sur: "ht" | "ttc") {
    setEnSaisie({ champ: sur, valeur: v });
    if (v.trim() === "" || !Number.isFinite(Number(v))) return;
    const pct = remiseDepuisCible(lu, v, sur);
    if (pct) onRemise(pct.toString().replace(".", ","));
  }

  return (
    <>
      <div className="totals-box" id="totalsBoxContent" aria-label="Totaux du document">
        {ligne("Total HT", t.htAvant)}
        {avecRemise && (
          <>
            <div>Remise ({t.remisePct.toString()}%) <b>-{formatEuros(t.remiseMontantHT)}</b></div>
            {ligne("Total HT net", t.ht)}
          </>
        )}
        {tva}
        {ligne("Total TTC", t.ttc)}
      </div>
      <div className="remise-box" style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed var(--border)" }}>
        <div className="section-title" style={{ marginTop: 0 }}>Remise</div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="f_remisePct">Taux de remise (%)</label>
            <input type="number" step="0.01" min="0" max="100" id="f_remisePct" placeholder="Ex : 10" value={valeur("pct", avecRemise ? t.remisePct.toString() : "")} onChange={(e) => { setEnSaisie({ champ: "pct", valeur: e.target.value }); onRemise(e.target.value); }} onBlur={() => setEnSaisie(null)} />
          </div>
          <div className="field">
            <label htmlFor="f_remiseHT">Montant HT après remise</label>
            <input type="number" step="0.01" id="f_remiseHT" placeholder="Ex : 500" value={valeur("ht", avecRemise ? t.ht.toFixed(2) : "")} onChange={(e) => saisirMontant(e.target.value, "ht")} onBlur={() => setEnSaisie(null)} />
          </div>
          <div className="field">
            <label htmlFor="f_remiseTTC">Montant TTC après remise</label>
            <input type="number" step="0.01" id="f_remiseTTC" placeholder="Ex : 550" value={valeur("ttc", avecRemise ? t.ttc.toFixed(2) : "")} onChange={(e) => saisirMontant(e.target.value, "ttc")} onBlur={() => setEnSaisie(null)} />
          </div>
        </div>
      </div>
    </>
  );
}
