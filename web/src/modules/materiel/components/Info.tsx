import type { ReactNode } from "react";

/**
 * Une case du bandeau d'une fiche du parc (`.vehicule-hero-item` de l'ancien
 * écran : le libellé en petites capitales, la valeur dessous). Le « — » d'une
 * valeur absente est à l'appelant.
 */
export function Info({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="vehicule-hero-item">
      <div className="vehicule-hero-label">{libelle}</div>
      <div className="vehicule-hero-value">{children}</div>
    </div>
  );
}
