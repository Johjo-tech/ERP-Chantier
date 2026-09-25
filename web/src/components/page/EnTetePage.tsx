import type { ReactNode } from "react";

/**
 * L'en-tête d'un écran (`.page-head` de l'ancien : le titre à gauche, les
 * boutons à droite, alignés au centre). Un sous-titre, que l'ancien n'avait
 * pas là, passe dessous en ligne secondaire (`.card-sub`).
 */
export function EnTetePage({ titre, sousTitre, actions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      {sousTitre ? (
        <div>
          <h1>{titre}</h1>
          <div className="card-sub">{sousTitre}</div>
        </div>
      ) : (
        <h1>{titre}</h1>
      )}
      {actions && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}
