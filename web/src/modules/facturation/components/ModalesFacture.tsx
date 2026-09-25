import { useState } from "react";
import { Modale } from "@/components/ui/modale";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant, type Montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { showToast } from "@/modules/documents/impression/zone";
import { DUREE_AVIS } from "../domain/avis";
import { MOTIFS_AVOIR, refusAvoir, refusImputationAvoir } from "../domain/avoir";
import { avoirsImputables, montantImputable } from "../domain/lettrage";
import type { Solde } from "../domain/solde";
import { useEtablirAvoir, useImputerAvoir } from "../hooks/useFactures";

const LIBRE = "__libre__";

/**
 * « Établir un avoir » (`#avoirModal` d'index.html, `etablirAvoirPour`,
 * `confirmerAvoir` — app.js l. 6399) : le motif d'abord, choisi dans la liste
 * ou écrit ; il s'imprime sur l'avoir. Mêmes libellés, même bouton qui dit
 * « Établissement… » pendant l'écriture.
 */
export function ModaleAvoir({ facture, ttc, fermer, etabli }: { facture: { id: string; numero: string | null; type_document: string; client_nom: string }; ttc: Montant; fermer: () => void; etabli: () => void }) {
  useModeDiscret();
  const etablir = useEtablirAvoir();
  const [choix, setChoix] = useState<string>(MOTIFS_AVOIR[0]);
  const [libre, setLibre] = useState("");

  function confirmer() {
    const motif = (choix === LIBRE ? libre : choix).trim();
    const refus = refusAvoir(facture, motif);
    if (refus) {
      showToast(refus);
      return;
    }
    etablir.mutate(
      { factureId: facture.id, motif },
      {
        onSuccess: () => {
          fermer();
          showToast("Avoir établi.", "success");
          etabli();
        },
        onError: (err) => {
          console.error("Avoir non établi", err);
          showToast(messageErreur(err) || "L'avoir n'a pas pu être établi.", "danger", DUREE_AVIS.echec);
        },
      }
    );
  }

  return (
    <Modale titre="Établir un avoir" onFermer={fermer} largeurMax="460px">
      <p className="card-sub">{`Facture ${facture.numero ?? ""} — ${facture.client_nom} — ${formatEurosEcran(ttc.abs())} TTC`}</p>
      <div className="field">
        <label htmlFor="avoirMotifPreset">Motif de la rectification</label>
        <select id="avoirMotifPreset" value={choix} onChange={(e) => setChoix(e.target.value)}>
          {MOTIFS_AVOIR.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value={LIBRE}>Autre motif (préciser)…</option>
        </select>
      </div>
      {choix === LIBRE && (
        <div className="field" id="avoirMotifLibreZone">
          <label htmlFor="avoirMotifLibre">Préciser</label>
          <input type="text" id="avoirMotifLibre" autoFocus placeholder="Ex : métré erroné sur le lot 2" maxLength={180} value={libre} onChange={(e) => setLibre(e.target.value)} />
        </div>
      )}
      <p className="card-sub">Ce motif s'imprime sur l'avoir et part avec la facture électronique. L'avoir reprend toutes les lignes de la facture et reçoit un numéro de la série « AV ». La facture, elle, ne bouge pas.</p>
      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button type="button" className="btn primary" id="avoirConfirmerBtn" disabled={etablir.isPending} onClick={confirmer}>{etablir.isPending ? "Établissement…" : "✓ Établir l'avoir"}</button>
        <button type="button" className="btn ghost" onClick={fermer}>Annuler</button>
      </div>
    </Modale>
  );
}

/**
 * « Régler par un avoir » (`#imputationModal`, `reglerParAvoir`,
 * `majAideImputation`, `confirmerImputation` — app.js l. 6515) : l'avoir, le
 * montant proposé (le plus petit des deux restes), et l'effet annoncé avant de
 * valider. Le refus se lit sous le montant, en rouge, et grise le bouton.
 */
export function ModaleImputation({ facture, soldes, fermer }: { facture: Solde; soldes: readonly Solde[]; fermer: () => void }) {
  useModeDiscret();
  const avoirs = avoirsImputables(facture, soldes);
  const imputer = useImputerAvoir();
  const [avoirId, setAvoirId] = useState(avoirs[0]?.facture_id ?? "");
  const avoir = avoirs.find((a) => a.facture_id === avoirId) ?? null;
  const propose = (a: Solde | null) => (a ? montantImputable(facture.reste, a.reste).toFixed(2) : "");
  const [saisie, setSaisie] = useState(() => propose(avoir));
  const m = montant(Number.parseFloat(saisie) || 0);
  const refus = refusImputationAvoir({
    avoir: avoir && { numero: avoir.numero, type_document: avoir.type_document, client_nom: avoir.client_nom },
    facture: { numero: facture.numero, type_document: facture.type_document, client_nom: facture.client_nom },
    montant: m,
    resteFacture: facture.reste,
    resteAvoir: avoir?.reste ?? 0,
  });
  const aide = refus ?? `Après imputation : facture ${formatEurosEcran(montant(facture.reste).minus(m))} restant dû, avoir ${formatEurosEcran(montant(avoir?.reste ?? 0).minus(m))} disponible.`;

  function confirmer() {
    if (!avoir || refus) return;
    imputer.mutate(
      { avoirId: avoir.facture_id, factureId: facture.facture_id, montant: m.toNumber(), date: todayISO() },
      {
        onSuccess: () => {
          fermer();
          showToast("Avoir imputé.", "success");
        },
        onError: (err) => {
          console.error("Imputation refusée", err);
          showToast(messageErreur(err) || "L'avoir n'a pas pu être imputé.", "danger", DUREE_AVIS.echec);
        },
      }
    );
  }

  return (
    <Modale titre="Régler par un avoir" onFermer={fermer} largeurMax="460px">
      <p className="card-sub">{`Facture ${facture.numero ?? ""} — ${facture.client_nom} — reste ${formatEurosEcran(montant(facture.reste))}`}</p>
      <div className="field">
        <label htmlFor="imputationAvoir">Avoir à imputer</label>
        <select id="imputationAvoir" value={avoirId} onChange={(e) => { const a = avoirs.find((x) => x.facture_id === e.target.value) ?? null; setAvoirId(e.target.value); setSaisie(propose(a)); }}>
          {avoirs.map((a) => <option key={a.facture_id} value={a.facture_id}>{`${a.numero ?? ""} — ${formatEurosEcran(montant(a.reste))} disponible`}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="imputationMontant">Montant imputé</label>
        <input type="number" step="0.01" min="0" id="imputationMontant" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
      </div>
      <div className="field full">
        <small id="imputationAide" className="card-sub" style={refus ? { color: "var(--danger)" } : undefined}>{aide}</small>
      </div>
      <p className="card-sub">L'avoir éteint la créance, il ne s'encaisse pas : deux règlements liés sont écrits — l'un solde la facture, l'autre consomme l'avoir.</p>
      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button type="button" className="btn primary" id="imputationConfirmerBtn" disabled={!!refus || imputer.isPending} onClick={confirmer}>{imputer.isPending ? "Imputation…" : "✓ Imputer"}</button>
        <button type="button" className="btn ghost" onClick={fermer}>Annuler</button>
      </div>
    </Modale>
  );
}
