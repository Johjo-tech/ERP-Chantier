import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { showToast } from "@/modules/documents/impression/zone";
import { DUREE_AVIS } from "../domain/avis";
import { criteresActifs, criteresDepuisRequete, criteresVersRequete, estRapproche, filtrerReglements, totalReglements, type CriteresReglements } from "../domain/filtresReglements";
import { libelleModeReglement } from "../domain/reglements";
import { useCartesFactures } from "../hooks/useCartesFactures";
import { useNomsChantiers, useReglementsEcran } from "../hooks/useEcranFactures";
import { useSupprimerReglement } from "../hooks/useFactures";
import { FormulaireReglement } from "./FormulaireReglement";

/** Le tri par défaut de `Array.prototype.sort`, celui des listes de l'ancien. */
const ordreBrut = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * « Tous les règlements » (`renderTousLesReglements`, app.js l. 10987) : la
 * barre de filtres, le total de la liste affichée, un règlement par carte. Les
 * critères vivent dans l'adresse : un filtre se transmet en copiant le lien.
 */
export function VueTousReglements() {
  useModeDiscret();
  const location = useLocation();
  const navigate = useNavigate();
  const { cartes, soldes, chargement, erreur, reessayer } = useCartesFactures();
  const reglements = useReglementsEcran();
  const chantiers = useNomsChantiers();
  const retirer = useSupprimerReglement();
  const [enCours, setEnCours] = useState<string | null>(null);
  const c = criteresDepuisRequete(location.search);
  const poser = (cle: keyof CriteresReglements, v: string) => void navigate({ search: criteresVersRequete({ ...c, [cle]: v }) }, { replace: true });

  if (chargement || reglements.isPending) return <Chargement />;
  if (erreur || reglements.isError) return <Erreur erreur={erreur ?? reglements.error} reessayer={() => { reessayer(); void reglements.refetch(); }} />;

  const parFacture = new Map(cartes.map((x) => [x.f.id, x.f]));
  const tous = reglements.data.filter((r) => parFacture.has(r.facture_id));
  const liste = filtrerReglements(tous, (id) => (id ? parFacture.get(id) : null), c);
  const clients = [...new Set(cartes.map((x) => x.f.client_nom).filter(Boolean))].sort(ordreBrut);
  const idsChantiers = new Set(cartes.map((x) => x.f.chantier_id).filter(Boolean));
  const nomChantier = new Map((chantiers.data ?? []).map((ch) => [ch.id, ch.nom]));
  const optionsChantiers = (chantiers.data ?? []).filter((ch) => idsChantiers.has(ch.id)).sort((a, b) => a.nom.localeCompare(b.nom));
  const corrige = enCours ? reglements.data.find((r) => r.id === enCours) ?? null : null;

  function supprimer(r: { id: string; mode: string | null }) {
    if (!window.confirm("Supprimer définitivement cet élément ?")) return;
    retirer.mutate(r, { onError: (err) => showToast(messageErreur(err) || "La suppression a été refusée. Rien n'a été supprimé.", "danger", DUREE_AVIS.suppression) });
  }

  return (
    <>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <label className="card-sub" style={{ margin: 0 }}>
          Du <input type="date" style={{ width: "auto" }} value={c.du} onChange={(e) => poser("du", e.target.value)} />
        </label>
        <label className="card-sub" style={{ margin: 0 }}>
          au <input type="date" style={{ width: "auto" }} value={c.au} onChange={(e) => poser("au", e.target.value)} />
        </label>
        <select aria-label="Client" style={{ width: "auto", minWidth: "180px" }} value={c.client} onChange={(e) => poser("client", e.target.value)}>
          <option value="">Tous les clients</option>
          {clients.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select aria-label="Mode" style={{ width: "auto", minWidth: "160px" }} value={c.mode} onChange={(e) => poser("mode", e.target.value)}>
          <option value="">Tous les modes</option>
          {[...MODES_REGLEMENT, { code: "avoir", libelle: "Avoir" }].map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
        </select>
        <select aria-label="Chantier" style={{ width: "auto", minWidth: "200px" }} value={c.chantier} onChange={(e) => poser("chantier", e.target.value)}>
          <option value="">Tous les chantiers</option>
          {optionsChantiers.map((ch) => <option key={ch.id} value={ch.id}>{ch.nom}</option>)}
        </select>
        {/* Le schéma ne porte aucun pointage bancaire : ce filtre lit la présence d'une référence, et le dit. */}
        <select aria-label="Rapprochement" style={{ width: "auto", minWidth: "230px" }} value={c.rapprochement} onChange={(e) => poser("rapprochement", e.target.value)} title="Le rapprochement se lit sur la référence saisie : numéro de chèque, référence de virement…">
          <option value="">Rapproché ou non</option>
          <option value="rapproche">Rapproché (référence saisie)</option>
          <option value="non_rapproche">Non rapproché (sans référence)</option>
        </select>
        {criteresActifs(c) && <button type="button" className="btn small ghost" onClick={() => void navigate({ search: "" }, { replace: true })} title="Tout réafficher">✕ Effacer</button>}
      </div>
      {/* L'ancien ouvrait la correction sans lui donner de place sur cette vue : elle se pose ici (D-ECR-FAC-05). */}
      {corrige && <div id="formZoneReglement"><FormulaireReglement key={corrige.id} factures={soldes.map((s) => ({ ...s, mode_paiement: parFacture.get(s.facture_id)?.mode_paiement ?? null }))} reglements={reglements.data} factureId={corrige.facture_id} enCours={corrige} fermer={() => setEnCours(null)} /></div>}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <div>
          <div className="card-title">
            {liste.length} règlement{liste.length > 1 ? "s" : ""}
            {liste.length < tous.length && <> <span className="card-sub" style={{ fontWeight: 400 }}>sur {tous.length}</span></>}
          </div>
          <div className="card-sub">Total des règlements affichés</div>
        </div>
        <div className="amount">{formatEurosEcran(totalReglements(liste))}</div>
      </div>
      {liste.length ? (
        liste.map((r) => {
          const f = parFacture.get(r.facture_id);
          const chantier = f?.chantier_id ? nomChantier.get(f.chantier_id) : undefined;
          return (
            <div key={r.id} className="card">
              <div className="card-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card-title">{f ? f.client_nom : "— client inconnu —"}</div>
                  <div className="card-sub">
                    <span className="numref-lg">{f ? f.numero || "Brouillon" : "—"}</span> · {formatDateFr(r.date)} · {libelleModeReglement(r.mode)}
                    {r.reference ? ` · réf. ${r.reference}` : ""}
                  </div>
                  {chantier && <div className="card-sub">🏗️ {chantier}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="amount">{formatEurosEcran(montant(r.montant))}</div>
                  <div style={{ marginTop: "5px" }}>
                    {estRapproche(r) ? <span className="badge success" title="Une référence est saisie">Rapproché</span> : <span className="badge warn" title="Aucune référence saisie">Non rapproché</span>}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {f && <button type="button" className="btn small" onClick={() => void navigate(`/factures/reglements/dossier?client=${encodeURIComponent(f.client_nom)}`)}>Ouvrir le dossier</button>}
                <button type="button" className="btn small ghost" onClick={() => setEnCours(r.id)}>✎ Modifier</button>
                <button type="button" className="btn small danger" onClick={() => supprimer(r)}>Supprimer</button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty">Aucun règlement ne répond à ces filtres.</div>
      )}
    </>
  );
}
