import { useId, useState, type ChangeEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { verifierFichierChantier } from "../domain/fichiers";
import { useUrlFichier } from "../hooks/useFiche";

/** Le bouton « + Ajouter » : choisir un fichier, refusé au-delà de 8 Mo avant tout envoi (CHA-41). */
export function BoutonDepot({ libelle, accepte, onFichier, enCours, desactive }: { libelle: string; accepte: string; onFichier: (f: File) => void; enCours?: boolean; desactive?: boolean }) {
  const id = useId();
  const [refus, setRefus] = useState<string | null>(null);
  function choisir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const verdict = verifierFichierChantier(f);
    setRefus(verdict.ok ? null : verdict.motif);
    if (verdict.ok) onFichier(f);
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <label htmlFor={id} className={`inline-flex h-8 cursor-pointer items-center rounded-md bg-secondary px-3 text-xs font-medium hover:bg-secondary/80 ${desactive || enCours ? "pointer-events-none opacity-50" : ""}`}>
        {enCours ? "Envoi…" : libelle}
      </label>
      <input id={id} type="file" accept={accepte} className="sr-only" onChange={choisir} disabled={desactive || enCours} />
      {refus && <span role="alert" className="text-xs text-destructive">{refus}</span>}
    </span>
  );
}

export interface FichierListe {
  id: string;
  nom: string;
  date: string | null;
  chemin: string | null;
  nonLu?: boolean;
}

interface PropsListe {
  fichiers: readonly FichierListe[];
  modifiable: boolean;
  dateModifiable?: boolean;
  onOuvert?: (f: FichierListe) => void;
  onRedater?: (id: string, date: string | null) => void;
  onRetirer?: (id: string) => void;
}

/** Une liste de fichiers : l'ouvrir (URL signée), corriger sa date, le retirer. */
export function ListeFichiers({ fichiers, modifiable, dateModifiable = false, onOuvert, onRedater, onRetirer }: PropsListe) {
  const url = useUrlFichier();
  if (!fichiers.length) return <p className="text-sm text-muted-foreground">Aucun fichier pour l'instant.</p>;

  function ouvrir(f: FichierListe) {
    if (!f.chemin) return;
    // La fenêtre s'ouvre pendant le clic (sinon bloquée), l'URL signée la remplit ensuite.
    const fenetre = window.open("", "_blank");
    url.mutate(f.chemin, {
      onSuccess: (u) => {
        if (fenetre) fenetre.location.href = u;
        else window.location.assign(u);
        onOuvert?.(f);
      },
      onError: () => fenetre?.close(),
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {url.isError && <Alert variant="erreur">{messageErreur(url.error)}</Alert>}
      <ul className="divide-y divide-border">
        {fichiers.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
            {f.nonLu && <span className="size-2 rounded-full bg-primary" aria-label="Non lu" role="img" />}
            <Button variant="link" className={`h-auto p-0 ${f.nonLu ? "font-semibold" : ""}`} onClick={() => ouvrir(f)} disabled={!f.chemin}>
              {f.nom}
            </Button>
            {dateModifiable && modifiable && onRedater ? (
              <Input type="date" aria-label={`Date de ${f.nom}`} className="h-7 w-36 text-xs" defaultValue={f.date ?? ""} onBlur={(e) => (e.target.value || null) !== f.date && onRedater(f.id, e.target.value || null)} />
            ) : (
              <span className="text-xs text-muted-foreground">{formatDateFr(f.date)}</span>
            )}
            {modifiable && onRetirer && (
              <span className="ml-auto">
                <BoutonConfirme libelle="Retirer" question={`Retirer « ${f.nom} » ?`} onConfirmer={() => onRetirer(f.id)} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
