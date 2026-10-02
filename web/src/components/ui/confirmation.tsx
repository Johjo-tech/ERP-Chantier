import { useState } from "react";
import { Button } from "./button";

interface Props {
  libelle: string;
  question: string;
  onConfirmer: () => void;
  enCours?: boolean;
}

/** Une action destructrice demande une seconde confirmation, au même endroit, au clavier comme à la souris. */
export function BoutonConfirme({ libelle, question, onConfirmer, enCours = false }: Props) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOuvert(true)} disabled={enCours}>
        {libelle}
      </Button>
    );
  }
  return (
    <span role="group" aria-label={question} className="inline-flex items-center gap-2 text-sm">
      <span>{question}</span>
      <Button
        variant="destructive"
        size="sm"
        autoFocus
        disabled={enCours}
        onClick={() => {
          setOuvert(false);
          onConfirmer();
        }}
      >
        Confirmer
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOuvert(false)}>
        Annuler
      </Button>
    </span>
  );
}
