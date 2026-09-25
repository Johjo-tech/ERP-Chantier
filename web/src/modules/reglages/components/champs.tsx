import { useId, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";

/** Une case à cocher libellée, accessible au clavier. */
export function CaseACocher({ libelle, coche, onChange, desactive }: { libelle: string; coche: boolean; onChange: (v: boolean) => void; desactive?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2 text-sm">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4" checked={coche} disabled={desactive} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{libelle}</label>
    </div>
  );
}

/** Le pied commun des rubriques : état de l'enregistrement et bouton, masqué en lecture seule. */
export function PiedEnregistrement({
  modifiable,
  enCours,
  erreur,
  succes,
  libelle = "Enregistrer",
}: {
  modifiable: boolean;
  enCours: boolean;
  erreur: unknown;
  succes: ReactNode | null;
  libelle?: string;
}) {
  if (!modifiable) {
    return <p className="text-xs text-muted-foreground">Lecture seule : seul un administrateur modifie les réglages.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {erreur !== null && erreur !== undefined && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      {succes && <Alert variant="succes">{succes}</Alert>}
      <div>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : libelle}
        </Button>
      </div>
    </div>
  );
}
