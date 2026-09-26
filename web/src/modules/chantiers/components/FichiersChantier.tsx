import type { ChangeEvent } from "react";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { verifierFichierChantier } from "../domain/fichiers";
import { useUrlFichier } from "../hooks/useFiche";

/** La question de l'ancien (`deleteItem`) : retirer un fichier se confirme. */
const QUESTION_RETRAIT = "Supprimer définitivement cet élément ?";

/**
 * « + Ajouter » de l'ancienne fiche : un <label> qui porte le champ fichier
 * (`chantierFileInputHTML`). Le champ reste atteignable au clavier (masqué
 * visuellement, pas `display:none`) ; au-delà de 8 Mo, le refus de l'ancien.
 */
export function AjoutFichier({
  libelle = "+ Ajouter",
  classe = "btn small primary",
  accepte,
  onFichier,
  enCours = false,
}: {
  libelle?: string;
  classe?: string;
  accepte: string;
  onFichier: (f: File) => void;
  enCours?: boolean;
}) {
  function choisir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const verdict = verifierFichierChantier(f);
    if (!verdict.ok) return afficherToast(verdict.motif);
    onFichier(f);
  }
  return (
    <label className={classe} style={{ cursor: "pointer" }} aria-disabled={enCours}>
      {libelle}
      <input type="file" className="sr-only" accept={accepte} disabled={enCours} onChange={choisir} />
    </label>
  );
}

export interface FichierChantier {
  id: string;
  nom: string;
  date: string | null;
  chemin: string | null;
  nonLu?: boolean;
}

interface Props {
  fichiers: readonly FichierChantier[];
  /** Montrer ✕ (et la date modifiable si `onRedater`). */
  modifiable: boolean;
  onOuvert?: (f: FichierChantier) => void;
  onRedater?: ((id: string, date: string | null) => void) | undefined;
  onRetirer?: ((id: string) => void) | undefined;
}

/**
 * Les lignes de fichiers de l'ancienne fiche (`chantierFileListHTML` et sa
 * variante à date modifiable) : « 📎 nom », la date, ✕. Ouvrir demande une URL
 * signée : le fichier est dans un seau privé (CHA-56).
 */
export function LignesFichiers({ fichiers, modifiable, onOuvert, onRedater, onRetirer }: Props) {
  const url = useUrlFichier();
  if (!fichiers.length) return <div className="empty">Aucun fichier pour l'instant.</div>;

  function ouvrir(f: FichierChantier) {
    if (!f.chemin) return;
    // La fenêtre s'ouvre pendant le clic (sinon bloquée), l'URL signée la remplit ensuite.
    const fenetre = window.open("", "_blank");
    url.mutate(f.chemin, {
      onSuccess: (u) => {
        if (fenetre) fenetre.location.href = u;
        else window.location.assign(u);
        onOuvert?.(f);
      },
      onError: (err) => {
        fenetre?.close();
        afficherToast(messageErreur(err));
      },
    });
  }

  return (
    <>
      {fichiers.map((f) => (
        <div key={f.id} className={`chantier-file-row${f.nonLu ? " is-unread" : ""}`}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              ouvrir(f);
            }}
          >
            {f.nonLu && <span className="unread-dot" role="img" aria-label="Non lu" />}📎 {f.nom}
          </a>
          {modifiable && onRedater ? (
            <input
              type="date"
              aria-label={`Date de ${f.nom}`}
              defaultValue={f.date ?? ""}
              style={{ width: "auto", fontSize: "11px", padding: "3px 6px" }}
              onChange={(e) => (e.target.value || null) !== f.date && onRedater(f.id, e.target.value || null)}
            />
          ) : (
            <span className="card-sub">{formatDateFr(f.date)}</span>
          )}
          {modifiable && onRetirer && (
            <button
              type="button"
              className="btn small danger"
              aria-label={`Retirer ${f.nom}`}
              onClick={() => {
                if (window.confirm(QUESTION_RETRAIT)) onRetirer(f.id);
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </>
  );
}
