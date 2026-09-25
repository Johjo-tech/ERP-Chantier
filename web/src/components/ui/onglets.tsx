import type { ReactNode } from "react";
import { NavLink } from "react-router";

export interface Onglet {
  chemin: string;
  libelle: ReactNode;
  /** Imposé par l'appelant ; sinon, l'onglet s'allume quand l'adresse est la sienne. */
  actif?: boolean;
  /** L'adresse doit être exactement la sienne (par défaut), ou seulement la commencer. */
  exact?: boolean;
}

/**
 * Les sous-onglets de l'ancien écran (`.plus-subnav`, `.plus-subnav-btn`) :
 * Factures › Avoirs › Validation…, « Plus » sur téléphone. Centrés sous
 * Factures, alignés à gauche ailleurs — comme l'ancien.
 */
export function Onglets({ libelle, onglets, centre = false }: { libelle: string; onglets: readonly Onglet[]; centre?: boolean }) {
  return (
    <nav aria-label={libelle} className="plus-subnav" style={centre ? { justifyContent: "center" } : undefined}>
      {onglets.map((o) => (
        <NavLink
          key={o.chemin}
          to={o.chemin}
          end={o.exact ?? true}
          className={({ isActive }) => ((o.actif ?? isActive) ? "plus-subnav-btn active" : "plus-subnav-btn")}
        >
          {o.libelle}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Des onglets tenus par l'écran lui-même (pas d'adresse) : mêmes classes,
 * de vrais boutons, et `aria-pressed` pour dire lequel est ouvert.
 */
export function OngletsLocaux<T extends string>({ libelle, onglets, valeur, onChange, centre = false }: { libelle: string; onglets: readonly { valeur: T; libelle: ReactNode }[]; valeur: T; onChange: (v: T) => void; centre?: boolean }) {
  return (
    <div role="group" aria-label={libelle} className="plus-subnav" style={centre ? { justifyContent: "center" } : undefined}>
      {onglets.map((o) => (
        <button key={o.valeur} type="button" aria-pressed={o.valeur === valeur} className={o.valeur === valeur ? "plus-subnav-btn active" : "plus-subnav-btn"} onClick={() => onChange(o.valeur)}>
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
