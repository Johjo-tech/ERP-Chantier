import { attenteAnnoncee, etatLecture, formaterDuree, type EtapeLecture, type EtatLecture } from "../domain/lecture";

interface Props {
  /** Le nom du document lu. */
  nom: string;
  etape: EtapeLecture;
  ecoule: number;
  /** L'issue d'une lecture qui n'a pas abouti ; `null` tant qu'elle court. */
  issue: EtatLecture | null;
  onAnnuler: () => void;
  onReessayer: (fichier: File) => void;
  onSaisirALaMain: () => void;
}

/**
 * L'écran de la lecture automatique (`ocrEcranHTML`) : il remplace le
 * formulaire le temps de la lecture — pastille, étape, nom du document,
 * chronomètre, durée habituelle, « Annuler la lecture » — puis, si elle
 * n'aboutit pas, dit laquelle des trois issues et propose de réessayer avec un
 * document, ou de saisir à la main.
 */
export function EcranLecture({ nom, etape, ecoule, issue, onAnnuler, onReessayer, onSaisirALaMain }: Props) {
  if (issue) {
    return (
      <div className="form-panel ocr-ecran" role="alert">
        <div className="ocr-titre" style={{ color: issue.ton === "erreur" ? "var(--danger)" : "var(--text-dim)" }}>{issue.libelle}</div>
        {issue.alerte && <div className="ocr-alerte">{issue.alerte}</div>}
        <div className="ocr-fichier">{nom}</div>
        <div className="ocr-actions">
          <label className="btn primary" style={{ cursor: "pointer" }}>
            ↻ Réessayer
            <input type="file" accept="application/pdf,image/*,.heic,.heif" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onReessayer(f); }} />
          </label>
          <button type="button" className="btn" onClick={onSaisirALaMain}>Saisir à la main</button>
        </div>
      </div>
    );
  }
  const etat = etatLecture(etape, ecoule);
  return (
    <div className="form-panel ocr-ecran" role="status" aria-live="polite">
      <div className="ocr-titre"><span className="ocr-pastille" /><span id="ocrLibelle">{etat.libelle}</span></div>
      <div className="ocr-fichier">{nom}</div>
      <div className="ocr-chrono" id="ocrChrono">{formaterDuree(ecoule)}</div>
      <div className="ocr-attente">{attenteAnnoncee()}</div>
      <div className="ocr-alerte" id="ocrAlerte" style={{ display: etat.alerte ? "" : "none" }}>{etat.alerte ?? ""}</div>
      <div className="ocr-actions">
        <button type="button" className="btn ghost" onClick={onAnnuler}>Annuler la lecture</button>
      </div>
    </div>
  );
}
