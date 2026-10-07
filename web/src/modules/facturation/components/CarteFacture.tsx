import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";
import { formatDateFr } from "@/lib/dates";
import { montant, type Montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { origineDeLaCorrespondance } from "@/lib/recherche";
import { estAvoir } from "@/modules/documents/domain/totaux";
import type { FactureCarte } from "../api/ecran";
import { badgeAvoir, badgeLogement, delaiBadge, libelleModePaiement, ligneLocataire, type EtatCarte } from "../domain/carte";
import type { Apport } from "../domain/croisement";

const LIEN = { color: "var(--accent-2)", textDecoration: "underline" } as const;

export interface OriginesCarte {
  devis: { id: string; numero: string } | null;
  rapport: { id: string; numero: string } | null;
  rectifiee: { id: string; numero: string } | null;
  bon: { id: string; numero: string; pieceJointe: boolean } | null;
}

/**
 * Une carte de la liste des factures (`renderFacturesListHTML`, app.js
 * l. 5982) : même HTML, mêmes classes, même texte au caractère près. Le clic
 * sur la carte ouvre l'aperçu (`cardRowClick`) — sauf sur un bouton ou un lien.
 */
export function CarteFacture({
  f, ht, ttc, etat, numerosBC, origines, requete, cherchables, apports, enEvidence, aujourdhui, ouvrir, actions, refusImpression,
}: {
  f: FactureCarte;
  ht: Montant;
  ttc: Montant;
  etat: EtatCarte;
  numerosBC: readonly string[];
  origines: OriginesCarte;
  requete: string;
  cherchables: readonly (string | null | undefined)[];
  apports: readonly Apport[];
  enEvidence: boolean;
  aujourdhui: string;
  ouvrir: () => void;
  actions: ReactNode;
  refusImpression: string | null;
}) {
  useModeDiscret();
  const avoir = estAvoir(f.type_document);
  const locataire = ligneLocataire(f);
  const logement = badgeLogement(f.logement_statut);
  const origine = origineDeLaCorrespondance(requete, cherchables, apports);
  const origineTexte = origine.map((o) => `${o.etiquette} ${o.valeur}`).join(" · ");
  const delai = avoir ? null : delaiBadge(f, etat.reste, aujourdhui);
  const ba = avoir ? badgeAvoir(etat.reste, ttc.abs(), formatEurosEcran) : null;
  const surCarte = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    ouvrir();
  };
  const sousLigne =
    `${f.echeance ? ` · échéance ${formatDateFr(f.echeance)}${f.conditions_reglement ? ` (${f.conditions_reglement})` : ""}` : ""}` +
    `${f.mode_paiement ? ` · 💶 ${libelleModePaiement(f.mode_paiement)}` : ""}` +
    `${f.interlocuteur ? ` · 👤 ${f.interlocuteur}` : ""}` +
    `${f.conducteur ? ` · 🦺 ${f.conducteur}` : ""}` +
    `${numerosBC.length ? ` · 📋 N° BC ${numerosBC.join(" / ")}` : ""}`;

  return (
    <div className={enEvidence ? "card search-focus" : "card"} id={`facture-card-${f.id}`} style={{ cursor: "pointer" }} onClick={surCarte}>
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">
            {f.client_nom}{" "}
            {avoir && <span className="badge warn" title="Avoir : il rectifie une facture émise">AVOIR</span>}
            {f.verrouillee && <span title="Facture verrouillée (déjà téléchargée/envoyée)">🔒</span>}
          </div>
          <div className="card-sub">
            <span className="numref-lg">{f.numero || "Brouillon — non émise"}</span> · {formatDateFr(f.date)}
            {sousLigne}
          </div>
          {locataire && <div className="card-sub">{locataire}</div>}
          {origine.length > 0 && <div className="recherche-origine" title={origineTexte}>🔎 {origineTexte}</div>}
          {origines.devis && (
            <div className="card-sub">
              Devis d'origine : <Link to={`/devis/${origines.devis.id}`} style={LIEN}>{origines.devis.numero}</Link>
            </div>
          )}
          {origines.rapport && (
            <div className="card-sub">
              Rapport d'origine : <Link to={`/rapports/${origines.rapport.id}`} style={LIEN}>{origines.rapport.numero}</Link>
            </div>
          )}
          {origines.rectifiee && (
            <div className="card-sub">
              Rectifie la facture : <Link to={`/factures/${origines.rectifiee.id}`} style={LIEN}>{origines.rectifiee.numero}</Link>
              {f.motif_rectification ? ` · ${f.motif_rectification}` : ""}
            </div>
          )}
          {origines.bon && (
            <div className="card-sub">
              Bon de commande d'origine :{" "}
              <Link to={`/commandes/${origines.bon.id}`} style={LIEN} title={origines.bon.pieceJointe ? "Voir le bon reçu du client" : "Aller au bon de commande"}>
                {origines.bon.numero}
                {origines.bon.pieceJointe ? " 📎" : ""}
              </Link>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="amount">
            {formatEurosEcran(ht)} <small style={{ fontWeight: 400, color: "var(--text-dim)", fontSize: "11px" }}>HT</small>
          </div>
          <div className="card-sub">{formatEurosEcran(ttc)} TTC</div>
          {f.remise_pourcentage > 0 && <div className="card-sub" style={{ marginTop: "2px" }}>remise {String(f.remise_pourcentage)}%</div>}
          {etat.paye.gt(montant("0.004")) && (
            <div className="card-sub" style={{ marginTop: "2px" }}>
              réglé {formatEurosEcran(etat.paye)}
              {etat.reste.gt(montant("0.004")) ? ` · reste ${formatEurosEcran(etat.reste)}` : ""}
            </div>
          )}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", marginTop: "5px" }}>
            {logement && <span className={`badge ${logement.classe}`}>{logement.libelle}</span>}
            {ba ? (
              <span className={`badge ${ba.classe}`} title={ba.titre}>{ba.texte}</span>
            ) : (
              <>
                <span className={`badge ${etat.classe}`}>{etat.libelle}</span>
                {delai && <span className={`badge ${delai.classe}`}>{delai.texte}</span>}
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>{actions}</div>
      {refusImpression && <div className="card-sub" style={{ marginTop: "8px" }}>{refusImpression}</div>}
    </div>
  );
}
