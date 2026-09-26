import { Fragment } from "react";
import { CONTROLES_PAR_METIER, type SaisieRapport } from "../domain/rapport";

/** Étape 2 (`stepControlesHTML`) — les points de contrôle du métier choisi ; « Autre » demande une précision. */
export function EtapeControles({ saisie, onChange }: { saisie: SaisieRapport; onChange: (s: SaisieRapport) => void }) {
  const points = saisie.metier ? CONTROLES_PAR_METIER[saisie.metier] : null;
  if (!points) {
    return <div className="empty">Choisissez d'abord un type d'intervention (Plomberie, Électricité, Étanchéité) à l'étape "Infos" pour afficher les points de contrôle correspondants.</div>;
  }
  return (
    <div className="controles-list">
      {points.map((p) => (
        <Fragment key={p.cle}>
          <label className="controle-item">
            <span>{p.libelle}</span>
            <input type="checkbox" checked={!!saisie.controles[p.cle]} onChange={(e) => onChange({ ...saisie, controles: { ...saisie.controles, [p.cle]: e.target.checked } })} />
          </label>
          {p.cle === "autre" && (
            <div className="field full" id="autreTexteBox" style={{ display: saisie.controles.autre ? undefined : "none", margin: "-4px 0 12px" }}>
              <input type="text" aria-label="Précisez le contrôle" value={saisie.precision_autre} placeholder="Précisez le contrôle…" onChange={(e) => onChange({ ...saisie, precision_autre: e.target.value })} />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Étape 4 (`stepRapportHTML`) — le rapport rédigé, puis l'impression et
 * l'envoi, qui enregistrent d'abord (D-ECR-PLN-08). La génération par IA de
 * l'ancien écran n'est pas reprise : elle appelait l'API depuis le navigateur,
 * sans clé, et échouait par construction (PLN-51, D-PLN-11). Son bouton reste,
 * à sa place, et dit franchement qu'elle n'est pas disponible (D-ECR-PLN-09).
 */
export function EtapeRapport({ saisie, onChange, onImprimer, enCours }: { saisie: SaisieRapport; onChange: (s: SaisieRapport) => void; onImprimer: () => void; enCours: boolean }) {
  const genererIA = () =>
    window.alert(
      saisie.constatations.trim()
        ? "La génération automatique n'est pas disponible : complétez le rapport manuellement."
        : "Notez d’abord quelques constatations, même brèves, avant de générer avec l’IA."
    );
  return (
    <>
      <button type="button" className="btn primary" id="genRapportBtn" onClick={genererIA}>✨ Générer / améliorer avec l'IA</button>
      <div className="field full" style={{ marginTop: "16px" }}>
        <label htmlFor="rap_constatations">Constatations</label>
        <textarea id="rap_constatations" value={saisie.constatations} onChange={(e) => onChange({ ...saisie, constatations: e.target.value })} />
      </div>
      <div className="field full" style={{ marginTop: "16px" }}>
        <label htmlFor="rap_preconisations">Préconisations</label>
        <textarea id="rap_preconisations" value={saisie.preconisations} onChange={(e) => onChange({ ...saisie, preconisations: e.target.value })} />
        <p className="card-sub">💡 Une ligne = une ligne de devis. Ajoutez « x2 » (et l'unité juste après, ex : « x25 m² ») en fin de ligne pour indiquer quantité et unité.</p>
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
        <button type="button" className="btn" disabled={enCours} onClick={onImprimer}>Imprimer / PDF</button>
        <button type="button" className="btn" disabled={enCours} onClick={onImprimer}>Envoyer par email</button>
      </div>
    </>
  );
}
