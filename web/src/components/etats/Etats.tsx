import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";

/**
 * Chargement, vide, erreur : chaque écran passe par ces trois états, dans les
 * habits de l'ancien. L'ancien écran n'avait pas d'état « chargement » (il
 * attendait tout avant de dessiner) : il prend le gabarit de l'état vide, sans
 * cadre. `data-chargement` permet à la comparaison visuelle d'attendre la fin.
 */
export function Chargement({ libelle = "Chargement…" }: { libelle?: string }) {
  return (
    <div role="status" aria-live="polite" className="chargement" data-chargement="oui">
      {libelle}
    </div>
  );
}

/** L'état vide de l'ancien écran (`.empty` : texte gris centré dans un cadre pointillé). */
export function Vide({ message, action }: { message: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {message}
      {action && <div style={{ marginTop: "12px" }}>{action}</div>}
    </div>
  );
}

/** Un refus ou une panne, avec de quoi réessayer — le bandeau d'alerte du circuit (`.wf-banner.alerte`). */
export function Erreur({ erreur, reessayer }: { erreur: unknown; reessayer?: () => void }) {
  return (
    <div role="alert" className="wf-banner alerte" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
      <span>{messageErreur(erreur)}</span>
      {reessayer && (
        <Button variant="outline" size="sm" onClick={reessayer}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
