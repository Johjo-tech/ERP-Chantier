import { useEffect, useId, type CSSProperties, type ReactNode } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";

/** Une case à cocher libellée (`.bc-tache-row` de l'ancien écran), accessible au clavier. */
export function CaseACocher({ libelle, coche, onChange, desactive }: { libelle: string; coche: boolean; onChange: (v: boolean) => void; desactive?: boolean }) {
  const id = useId();
  return (
    <label className="bc-tache-row" htmlFor={id}>
      <input id={id} type="checkbox" checked={coche} disabled={desactive} onChange={(e) => onChange(e.target.checked)} />
      <span>{libelle}</span>
    </label>
  );
}

/**
 * Le pied commun des rubriques, comme l'ancien : un bouton « Enregistrer »
 * (`<div style="margin-top:16px">`), la réussite et l'échec dits par la bulle
 * (`showToast`). En lecture seule, une phrase à la place du bouton.
 */
export function PiedEnregistrement({
  modifiable,
  enCours,
  erreur,
  succes,
  libelle = "Enregistrer",
  style = { marginTop: "16px" },
  type = "submit",
  onClick,
}: {
  modifiable: boolean;
  enCours: boolean;
  erreur: unknown;
  succes: ReactNode | null;
  libelle?: string;
  style?: CSSProperties;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  useEffect(() => {
    if (typeof succes === "string") afficherToast(succes, "success");
  }, [succes]);
  useEffect(() => {
    if (erreur !== null && erreur !== undefined) afficherToast(messageErreur(erreur));
  }, [erreur]);
  if (!modifiable) {
    return (
      <div className="card-sub" style={style}>
        Lecture seule : seul un administrateur modifie les réglages.
      </div>
    );
  }
  return (
    <div style={style}>
      <button type={type} className="btn primary" disabled={enCours} onClick={onClick}>
        {libelle}
      </button>
    </div>
  );
}
