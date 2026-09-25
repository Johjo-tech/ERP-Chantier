import { useState } from "react";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { formatEuros, montant } from "@/lib/money";
import { useModeDiscret } from "@/lib/modeDiscret";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { showToast } from "@/modules/documents/impression/zone";
import type { ReglementEcran } from "../api/ecran";
import { DUREE_AVIS } from "../domain/avis";
import { refusReglement, resteAPayer, totalRegle } from "../domain/reglements";
import type { Solde } from "../domain/solde";
import { useAjouterReglement, useModifierReglement } from "../hooks/useFactures";

/** Le code retenu : celui de la facture, sinon le virement (`modeReglementRetenu`). */
const modeRetenu = (code: string | null | undefined) => (code ?? "").trim() || "virement";

/**
 * « Nouveau règlement » / « Modifier le règlement » (`reglementForm`, app.js
 * l. 11421) : le panneau de l'ancien, la facture au choix — jamais un avoir,
 * qui s'impute —, le montant proposé au reste, le mode de la facture, l'aide
 * « Total · déjà réglé · reste » sous le montant. Le refus vient de la règle ;
 * le dû est celui de la base (TTC − acomptes, D-FAC-01).
 */
export function FormulaireReglement({ factures, reglements, factureId, enCours, fermer }: {
  factures: readonly (Solde & { mode_paiement: string | null })[];
  reglements: readonly ReglementEcran[];
  factureId: string | null;
  enCours: ReglementEcran | null;
  fermer: () => void;
}) {
  useModeDiscret();
  const choisissables = factures.filter((f) => f.sens > 0);
  const [id, setId] = useState(enCours?.facture_id ?? factureId ?? choisissables[0]?.facture_id ?? "");
  const facture = choisissables.find((f) => f.facture_id === id) ?? null;
  const du = (f: Solde) => montant(f.ttc).minus(f.acomptes);
  const regsDe = (fid: string) => reglements.filter((r) => r.facture_id === fid);
  const sauf = enCours?.id ?? null;
  const reste = facture ? resteAPayer(du(facture), regsDe(facture.facture_id), sauf) : montant(0);
  const [saisie, setSaisie] = useState(() => ({
    date: enCours?.date ?? todayISO(),
    montant: enCours ? String(enCours.montant) : facture ? reste.toString() : "",
    mode: enCours?.mode ?? modeRetenu(facture?.mode_paiement),
    reference: enCours?.reference ?? "",
  }));
  const ajouter = useAjouterReglement(id);
  const modifier = useModifierReglement();

  function changerFacture(nouvelle: string) {
    const f = choisissables.find((x) => x.facture_id === nouvelle) ?? null;
    setId(nouvelle);
    setSaisie((s) => ({ ...s, montant: f ? resteAPayer(du(f), regsDe(f.facture_id), sauf).toString() : "", mode: f?.mode_paiement ? modeRetenu(f.mode_paiement) : s.mode }));
  }

  function enregistrer() {
    if (!facture) {
      window.alert("Sélectionnez une facture.");
      return;
    }
    const m = montant(Number.parseFloat(saisie.montant) || 0);
    const refus = refusReglement({ montant: m, ttc: du(facture), reglements: regsDe(facture.facture_id), idModifie: sauf });
    if (refus) {
      window.alert(refus);
      return;
    }
    const r = { date: saisie.date || todayISO(), montant: m.toNumber(), mode: saisie.mode, reference: saisie.reference || null };
    const apres = { onSuccess: fermer, onError: (err: unknown) => showToast(messageErreur(err), "danger", DUREE_AVIS.refus) };
    if (enCours) modifier.mutate({ id: enCours.id, ...r }, apres);
    else ajouter.mutate(r, apres);
  }

  return (
    <div className="form-panel">
      <h3>{enCours ? "Modifier le règlement" : "Nouveau règlement"}</h3>
      <div className="field-grid">
        <div className="field full">
          <label htmlFor="r_factureId">Facture</label>
          <select id="r_factureId" value={id} onChange={(e) => changerFacture(e.target.value)}>
            {choisissables.map((f) => {
              const r = resteAPayer(du(f), regsDe(f.facture_id));
              return <option key={f.facture_id} value={f.facture_id}>{`${f.numero ?? ""} — ${f.client_nom} (${formatEuros(montant(f.ttc))}${r.gt(montant("0.004")) ? ` · reste ${formatEuros(r)}` : " · soldée"})`}</option>;
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r_date">Date</label>
          <input type="date" id="r_date" value={saisie.date} onChange={(e) => setSaisie({ ...saisie, date: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="r_montant">Montant</label>
          <input type="number" step="0.01" min="0" id="r_montant" value={saisie.montant} onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="r_mode">Mode de règlement</label>
          <select id="r_mode" value={saisie.mode} onChange={(e) => setSaisie({ ...saisie, mode: e.target.value })}>
            {MODES_REGLEMENT.map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r_reference">Référence</label>
          <input type="text" id="r_reference" value={saisie.reference} placeholder="N° chèque, réf. virement…" onChange={(e) => setSaisie({ ...saisie, reference: e.target.value })} />
        </div>
        <div className="field full">
          <small id="r_aide" className="card-sub">
            {/* `money` et non `moneyDisplay` dans l'ancien : l'aide de saisie ne se masque pas. */}
            {facture ? `Total ${formatEuros(du(facture))} · déjà réglé ${formatEuros(totalRegle(regsDe(facture.facture_id), sauf))} · reste ${formatEuros(reste)}` : ""}
          </small>
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="button" className="btn primary" disabled={ajouter.isPending || modifier.isPending} onClick={enregistrer}>Enregistrer</button>
        <button type="button" className="btn ghost" onClick={fermer}>Annuler</button>
      </div>
    </div>
  );
}
