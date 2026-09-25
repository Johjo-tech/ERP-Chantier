import { useEffect, useId, type ReactNode } from "react";

/**
 * La modale de l'ancien écran (`.view-modal` et son panneau, ancien.css
 * l. 936) : fond assombri, panneau blanc, croix ronde en haut à droite, titre
 * en <h3> sans marge haute. Échap et un clic sur le fond la ferment, comme
 * `closeViewOnBackdrop`.
 */
export function Modale({
  titre,
  onFermer,
  largeurMax,
  children,
}: {
  titre: ReactNode;
  onFermer: () => void;
  /** Largeur du panneau, comme les `max-width` posés à la main par l'ancien écran (« 460px »). */
  largeurMax?: string;
  children: ReactNode;
}) {
  const idTitre = useId();
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [onFermer]);
  return (
    <div
      className="view-modal open"
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitre}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div className="view-modal-panel" style={largeurMax ? { maxWidth: largeurMax } : undefined}>
        <button type="button" className="view-modal-close" aria-label="Fermer" onClick={onFermer}>
          ✕
        </button>
        <h3 id={idTitre} style={{ marginTop: 0 }}>
          {titre}
        </h3>
        {children}
      </div>
    </div>
  );
}

/** La rangée de boutons au pied d'une modale (`display:flex; gap:10px; margin-top:14px` de l'ancien). */
export function PiedModale({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>{children}</div>;
}
