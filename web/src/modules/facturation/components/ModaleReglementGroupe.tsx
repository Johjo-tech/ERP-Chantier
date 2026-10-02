import { useState, type MouseEvent } from "react";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { arrondiCentimes, montant, somme, type Montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { showToast } from "@/modules/documents/impression/zone";
import { DUREE_AVIS } from "../domain/avis";
import { imputer, refusImputation, RESTE_SOLDE_EUR } from "../domain/reglements";
import { useReglementGroupe } from "../hooks/useFactures";

export interface CibleGroupe {
  id: string;
  numero: string | null;
  date: string;
  reste: Montant;
}

/**
 * Le règlement groupé (`renderBulkReglementModal`, app.js l. 11274), en
 * SURIMPRESSION comme l'ancien : montant reçu (modifiable), date, mode,
 * référence, puis la RÉPARTITION facture par facture avant de valider — de la
 * plus ancienne à la plus récente. La base refait l'imputation et écrit tout
 * ou rien (`enregistrer_reglement_groupe`).
 */
export function ModaleReglementGroupe({ cibles, modeParDefaut, fermer, enregistre }: { cibles: readonly CibleGroupe[]; modeParDefaut: string | null; fermer: () => void; enregistre: () => void }) {
  useModeDiscret();
  const total = arrondiCentimes(somme(cibles.map((c) => c.reste)));
  const [saisie, setSaisie] = useState({ montant: total.toFixed(2), date: todayISO(), mode: (modeParDefaut ?? "").trim() || "virement", reference: "" });
  const groupe = useReglementGroupe();
  const m = arrondiCentimes(montant(Number.parseFloat(saisie.montant) || 0));
  const refus = refusImputation(m, cibles);
  const parts = refus ? [] : imputer(m, cibles);
  const servies = new Set(parts.map((p) => p.id));
  const surFond = (e: MouseEvent) => {
    if (e.target === e.currentTarget) fermer();
  };

  function valider() {
    if (refus) {
      window.alert(refus);
      return;
    }
    groupe.mutate(
      { factures: cibles.map((c) => c.id), montant: m.toNumber(), date: saisie.date || todayISO(), mode: saisie.mode, reference: saisie.reference || null },
      {
        onSuccess: (faites) => {
          const soldees = faites.filter((p) => p.reste_apres <= RESTE_SOLDE_EUR).length;
          enregistre();
          showToast(`${formatEurosEcran(m)} enregistré${faites.length > 1 ? ` sur ${faites.length} factures` : ""} — ${soldees} soldée${soldees > 1 ? "s" : ""}.`, "success");
        },
        onError: (err) => showToast(messageErreur(err), "danger", DUREE_AVIS.refus),
      }
    );
  }

  return (
    <div className="view-modal" style={{ display: "flex" }} onClick={surFond} role="dialog" aria-modal="true" aria-label="Règlement groupé">
      <div className="view-modal-panel" style={{ maxWidth: "620px", padding: "22px", fontFamily: "inherit", fontSize: "14px" }}>
        <button type="button" className="view-modal-close" aria-label="Fermer" onClick={fermer}>✕</button>
        <h3 style={{ margin: "0 0 4px" }}>Règlement groupé — {cibles.length} facture{cibles.length > 1 ? "s" : ""}</h3>
        <div className="card-sub" style={{ marginBottom: "14px" }}>Total dû : <b>{formatEurosEcran(total)}</b></div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="rb_montant">Montant reçu</label>
            <input type="number" step="0.01" min="0" id="rb_montant" value={saisie.montant} onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="rb_date">Date</label>
            <input type="date" id="rb_date" value={saisie.date} onChange={(e) => setSaisie({ ...saisie, date: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="rb_mode">Mode de règlement</label>
            <select id="rb_mode" value={saisie.mode} onChange={(e) => setSaisie({ ...saisie, mode: e.target.value })}>
              {MODES_REGLEMENT.map((x) => <option key={x.code} value={x.code}>{x.libelle}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rb_reference">Référence</label>
            <input type="text" id="rb_reference" placeholder="N° chèque, réf. virement…" value={saisie.reference} onChange={(e) => setSaisie({ ...saisie, reference: e.target.value })} />
          </div>
        </div>
        <div className="section-title" style={{ marginTop: "6px" }}>Répartition</div>
        <div id="rb_repartition">
          {refus ? (
            <div className="bc-attente-message">{refus}</div>
          ) : (
            <>
              {cibles.map((c) => {
                const p = parts.find((x) => x.id === c.id);
                if (!p) return <div key={c.id} className="summary-row" style={{ opacity: 0.5 }}><span>{c.numero ?? ""} <small>— rien cette fois</small></span><b>—</b></div>;
                return (
                  <div key={c.id} className="summary-row">
                    <span>
                      {c.numero ?? ""}{" "}
                      {p.resteApres.lte(montant(RESTE_SOLDE_EUR)) ? <small style={{ color: "var(--success)" }}>soldée</small> : <small style={{ color: "var(--text-dim)" }}>reste {formatEurosEcran(p.resteApres)}</small>}
                    </span>
                    <b>{formatEurosEcran(p.montant)}</b>
                  </div>
                );
              })}
              {servies.size < cibles.length && <div className="card-sub" style={{ marginTop: "6px" }}>Les factures non servies restent dues : le virement ne va pas jusqu'à elles.</div>}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button type="button" className="btn primary" id="rb_valider" disabled={!!refus || groupe.isPending} onClick={valider}>Enregistrer le règlement</button>
          <button type="button" className="btn ghost" onClick={fermer}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
