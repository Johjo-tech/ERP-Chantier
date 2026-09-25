import { useEffect, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useImprimerPiece } from "../hooks/useIdentiteDocument";
import { assurerPolices, type OptionsPiece, type PieceImprimee } from "../impression/zone";

interface Props {
  piece: PieceImprimee;
  fermer: () => void;
  /** Gestes propres à web/ (e-mail, plateforme…), posés avant « Imprimer » (D-PDF-06). */
  actions?: ReactNode;
  options?: OptionsPiece;
}

/**
 * L'aperçu d'une pièce, tel que l'ancien l'ouvrait (`openViewDoc`,
 * `openViewIntervention`, app.js l. 5011-5044 ; squelette index.html
 * l. 1808-1817) : la fenêtre `.view-modal` sur un voile, la pièce dans
 * `#viewInterventionContent` avec le HTML même du PDF, « Imprimer » ouvre le
 * PDF dans un onglet, « Enregistrer » le télécharge.
 */
export function ApercuPiece({ piece, fermer, actions, options }: Props) {
  const imprimer = useImprimerPiece();
  useEffect(assurerPolices, []);
  const lancer = (action: "open" | "save") => imprimer.mutate({ piece, action, avant: options?.avant, apres: options?.apres });
  // `closeViewOnBackdrop` : seul un clic sur le voile referme, pas un clic dans la page.
  const surVoile = (ev: MouseEvent) => {
    if (ev.target === ev.currentTarget) fermer();
  };
  return (
    // Le voile de l'ancien se ferme à la souris ; au clavier, la croix reste le geste.
    <div id="viewInterventionModal" className="view-modal open" style={piece.variables as CSSProperties} onClick={surVoile} role="dialog" aria-modal="true" aria-label={piece.nomFichier}>
      <div className="view-modal-panel">
        <button className="view-modal-close" onClick={fermer} aria-label="Fermer">✕</button>
        <div className="view-modal-actions no-print">
          {actions}
          <button className="btn small" disabled={imprimer.isPending} onClick={() => lancer("open")}>Imprimer</button>
          <button className="btn small primary" disabled={imprimer.isPending} onClick={() => lancer("save")}>Enregistrer</button>
        </div>
        <div id="viewInterventionContent" dangerouslySetInnerHTML={{ __html: piece.html }} />
      </div>
    </div>
  );
}
