import { useState, type MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { formatEuros, montant, somme } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { showToast } from "@/modules/documents/impression/zone";
import type { ReglementEcran } from "../api/ecran";
import { DUREE_AVIS } from "../domain/avis";
import { delaiBadge } from "../domain/carte";
import { lettrageDeLaSelection } from "../domain/lettrage";
import { libelleModeReglement } from "../domain/reglements";
import { cherche, compteRecherche } from "../domain/reglementsEcran";
import { useCartesFactures, type CarteFactureVue } from "../hooks/useCartesFactures";
import { useReglementsEcran } from "../hooks/useEcranFactures";
import { useImputerAvoir, useSupprimerReglement } from "../hooks/useFactures";
import { FormulaireReglement } from "./FormulaireReglement";
import { ModaleImputation } from "./ModalesFacture";
import { ModaleReglementGroupe } from "./ModaleReglementGroupe";
import { CadreReglements } from "./PageReglements";

const UN_CENTIME = montant("0.01");
type Saisie = { factureId: string | null; enCours: ReglementEcran | null } | null;

/**
 * Le dossier d'un client (`renderReglementsClientDetail`, app.js l. 11140) :
 * toutes ses pièces, les plus récentes d'abord ; cocher des factures →
 * « Règlement » groupé ; cocher UNE facture et UN avoir → « 🔗 Lettrer ». La
 * barre annonce le total de TOUTE la sélection, même ce que la recherche cache.
 */
export function PageDossierClient() {
  useModeDiscret();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nom = params.get("client") ?? "";
  const { cartes, soldes, chargement, erreur, reessayer, aujourdhui } = useCartesFactures();
  const reglements = useReglementsEcran();
  const lettrer = useImputerAvoir();
  const retirer = useSupprimerReglement();
  const [selection, setSelection] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [saisie, setSaisie] = useState<Saisie>(null);
  const [groupe, setGroupe] = useState(false);
  const [imputation, setImputation] = useState<string | null>(null);

  if (chargement || reglements.isPending) return <CadreReglements><Chargement /></CadreReglements>;
  if (erreur || reglements.isError) return <CadreReglements><Erreur erreur={erreur ?? reglements.error} reessayer={() => { reessayer(); void reglements.refetch(); }} /></CadreReglements>;

  // Tri stable par date : à égalité, l'ordre de la liste des factures (création décroissante) demeure.
  const pieces = cartes.filter((c) => c.f.client_nom === nom).sort((a, b) => b.f.date.localeCompare(a.f.date));
  const regsDe = (id: string) => reglements.data.filter((r) => r.facture_id === id).sort((a, b) => b.date.localeCompare(a.date));
  // Le montant et les règlements ne sont pas dans la facture : sans eux, « virement » ou le montant vu à l'écran ne se chercheraient pas.
  const visibles = pieces.filter((c) =>
    cherche(recherche, ...c.cherchables, formatEuros(c.ttc), formatEuros(c.etat.reste), c.etat.libelle, ...regsDe(c.f.id).map((r) => [libelleModeReglement(r.mode), r.reference, formatEuros(montant(r.montant))].filter(Boolean).join(" ")))
  );
  const compte = compteRecherche(recherche, visibles.length, pieces.length);
  const basculer = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const totalSelection = somme(pieces.filter((c) => !c.etat.avoir && c.etat.reste.gt(UN_CENTIME) && selection.includes(c.f.id)).map((c) => c.etat.reste));
  const lettrage = lettrageDeLaSelection(
    pieces.map((c) => ({ facture_id: c.f.id, numero: c.f.numero, sens: c.etat.avoir ? -1 : 1, reste: c.etat.reste.toNumber() })),
    selection
  );
  const cibles = pieces.filter((c) => selection.includes(c.f.id)).map((c) => ({ id: c.f.id, numero: c.f.numero, date: c.f.date, reste: c.etat.reste }));

  function lettrerSelection() {
    if (!lettrage) {
      showToast("Cochez une facture et un avoir du même client.");
      return;
    }
    if (!window.confirm(`Lettrer l'avoir ${lettrage.avoir.numero ?? ""} avec la facture ${lettrage.facture.numero ?? ""} pour ${formatEurosEcran(lettrage.montant)} ?`)) return;
    lettrer.mutate(
      { avoirId: lettrage.avoir.facture_id, factureId: lettrage.facture.facture_id, montant: lettrage.montant.toNumber(), date: todayISO() },
      {
        onSuccess: () => {
          setSelection([]);
          showToast(`Avoir ${lettrage.avoir.numero ?? ""} lettré pour ${formatEurosEcran(lettrage.montant)}.`, "success", DUREE_AVIS.copieCreee);
        },
        onError: (err) => showToast(messageErreur(err) || "Le lettrage n'a pas pu être enregistré.", "danger", DUREE_AVIS.refus),
      }
    );
  }

  function supprimer(r: ReglementEcran) {
    if (!window.confirm("Supprimer définitivement cet élément ?")) return;
    retirer.mutate(r, { onError: (err) => showToast(messageErreur(err) || "La suppression a été refusée. Rien n'a été supprimé.", "danger", DUREE_AVIS.suppression) });
  }

  const solde = imputation ? soldes.find((s) => s.facture_id === imputation) : undefined;
  return (
    <CadreReglements>
      <div className="page-head">
        <h1>{nom}</h1>
        <button type="button" className="btn" onClick={() => void navigate("/factures/reglements")}>← Retour</button>
      </div>
      <div className="barre-recherche">
        <input type="search" id="recherche-reglementFacture" aria-label="Rechercher" value={recherche} placeholder="Rechercher : n° de facture, montant, mode, référence…" onChange={(e) => setRecherche(e.target.value)} />
        {compte && <span className="compteur-resultats">{compte}</span>}
      </div>
      <div id="formZoneReglement">
        {saisie && (
          <FormulaireReglement
            key={saisie.enCours?.id ?? saisie.factureId ?? "nouveau"}
            factures={soldes.map((s) => ({ ...s, mode_paiement: cartes.find((c) => c.f.id === s.facture_id)?.f.mode_paiement ?? null }))}
            reglements={reglements.data}
            factureId={saisie.factureId}
            enCours={saisie.enCours}
            fermer={() => setSaisie(null)}
          />
        )}
      </div>
      <div id="liste-reglementFacture">
        {visibles.length ? (
          visibles.map((c) => (
            <CartePieceClient
              key={c.f.id}
              c={c}
              regs={regsDe(c.f.id)}
              coche={selection.includes(c.f.id)}
              basculer={() => basculer(c.f.id)}
              aujourdhui={aujourdhui}
              regler={() => setSaisie({ factureId: c.f.id, enCours: null })}
              corriger={(r) => setSaisie({ factureId: r.facture_id, enCours: r })}
              supprimer={supprimer}
              imputer={() => setImputation(c.f.id)}
            />
          ))
        ) : (
          <div className="empty">{recherche.trim() ? "Aucun facture ne correspond à la recherche." : "Aucune facture pour ce client."}</div>
        )}
      </div>
      {selection.length > 0 && (
        <div className="reglement-bulk-bar">
          <span>
            {lettrage ? (
              <>Avoir {lettrage.avoir.numero} en face de la facture {lettrage.facture.numero} — <b>{formatEurosEcran(lettrage.montant)}</b> à lettrer</>
            ) : (
              <>{selection.length} facture{selection.length > 1 ? "s" : ""} sélectionnée{selection.length > 1 ? "s" : ""} — Total : <b>{formatEurosEcran(totalSelection)}</b></>
            )}
          </span>
          {lettrage ? (
            <button type="button" className="btn primary" onClick={lettrerSelection} title="Solder la facture avec cet avoir">🔗 Lettrer</button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setGroupe(true)} disabled={!totalSelection.gt(UN_CENTIME)} title={totalSelection.gt(UN_CENTIME) ? undefined : "Sélectionnez au moins une facture à encaisser"}>Règlement</button>
          )}
        </div>
      )}
      {groupe && (
        <ModaleReglementGroupe
          cibles={cibles}
          modeParDefaut={pieces.find((c) => selection.includes(c.f.id))?.f.mode_paiement ?? null}
          fermer={() => setGroupe(false)}
          enregistre={() => { setGroupe(false); setSelection([]); }}
        />
      )}
      {solde && <ModaleImputation facture={solde} soldes={soldes} fermer={() => setImputation(null)} />}
    </CadreReglements>
  );
}

/** Une pièce du dossier (`listeFacturesReglementsHTML`) : sa case, son état, son reste, son historique. */
function CartePieceClient({ c, regs, coche, basculer, aujourdhui, regler, corriger, supprimer, imputer }: {
  c: CarteFactureVue;
  regs: readonly ReglementEcran[];
  coche: boolean;
  basculer: () => void;
  aujourdhui: string;
  regler: () => void;
  corriger: (r: ReglementEcran) => void;
  supprimer: (r: ReglementEcran) => void;
  imputer: () => void;
}) {
  useModeDiscret();
  // « Payable » : on peut y poser un encaissement. Un avoir a un reste, mais c'est un crédit : il se coche pour être lettré, il ne s'encaisse pas.
  const payable = c.etat.reste.gt(UN_CENTIME) && !c.etat.avoir;
  const lettrable = c.etat.reste.gt(UN_CENTIME) && c.etat.avoir;
  const delai = c.etat.avoir ? null : delaiBadge(c.f, c.etat.reste, aujourdhui);
  const surCarte = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("input, button")) return;
    basculer();
  };
  return (
    <div className="card" style={payable ? { cursor: "pointer" } : undefined} onClick={payable ? surCarte : undefined}>
      <div className="card-row">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          {payable || lettrable ? (
            <input type="checkbox" aria-label={`Sélectionner ${c.f.numero ?? "la pièce"}`} style={{ marginTop: "3px", width: "17px", height: "17px", flexShrink: 0 }} checked={coche} onChange={basculer} title={lettrable ? "Cocher cet avoir et une facture pour les lettrer" : "Cocher pour un règlement groupé"} />
          ) : (
            <span style={{ width: "17px", flexShrink: 0 }} />
          )}
          <div>
            <div className="card-title">{c.f.numero ?? ""}</div>
            <div className="card-sub">{formatDateFr(c.f.date)}{c.f.echeance ? ` · échéance ${formatDateFr(c.f.echeance)}` : ""}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="amount">{formatEurosEcran(c.ttc)}</div>
          <span className={`badge ${c.etat.classe}`} style={{ marginTop: "5px", display: "inline-block" }}>{c.etat.libelle}</span>
        </div>
      </div>
      <div className="card-sub" style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        {c.etat.avoir ? (
          <>Imputé : {formatEurosEcran(c.etat.paye)} · <strong>Disponible : {formatEurosEcran(c.etat.reste)}</strong></>
        ) : (
          <>Réglé : {formatEurosEcran(c.etat.paye)} · Reste : {formatEurosEcran(c.etat.reste)} {delai && <span className={`badge ${delai.classe}`}>{delai.texte}</span>}</>
        )}
        {/* Le geste là où on le cherche : ici, la facture et l'avoir se font face. */}
        {!c.etat.avoir && c.actions.peutImputerAvoir && c.imputable && (
          <button type="button" className="btn small" style={payable ? undefined : { marginLeft: "auto" }} onClick={imputer} title="Solder tout ou partie de cette facture avec un avoir du même client">🧾 Régler par un avoir</button>
        )}
        {payable && <button type="button" className="btn small primary" style={{ marginLeft: "auto" }} onClick={regler}>+ Règlement</button>}
      </div>
      {regs.length > 0 && <div className="card-sub" style={{ marginTop: "10px", fontWeight: 600 }}>Historique des règlements</div>}
      {regs.map((r) => (
        <div key={r.id} className="card-sub" style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          <span>{formatDateFr(r.date)} · {libelleModeReglement(r.mode)}{r.reference ? ` (${r.reference})` : ""}</span>
          <span className="mono" style={{ whiteSpace: "nowrap" }}>
            {formatEurosEcran(montant(r.montant))}{" "}
            <button type="button" className="btn small ghost" style={{ padding: "2px 7px", marginLeft: "6px" }} title="Modifier ce règlement" onClick={() => corriger(r)}>✎</button>{" "}
            <button type="button" className="btn small danger" style={{ padding: "2px 7px" }} title="Supprimer ce règlement" onClick={() => supprimer(r)}>✕</button>
          </span>
        </div>
      ))}
    </div>
  );
}
