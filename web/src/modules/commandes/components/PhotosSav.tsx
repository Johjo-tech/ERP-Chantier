import { useEffect, useId, useMemo, useRef } from "react";
import { afficherToast } from "@/lib/toast";
import type { PhotoBon } from "../api/documents";
import { PHOTOS_SAV_MAX, refusPieceJointe } from "../domain/pieceJointe";
import { usePhotos, useUrlPieceJointe } from "../hooks/useBons";

/** Une photo déjà rangée : lue par URL signée, comme la pièce jointe. */
function PhotoRangee({ photo }: { photo: PhotoBon }) {
  const url = useUrlPieceJointe(photo.chemin);
  return <div className="photo-thumb">{url.data && <img src={url.data} alt={photo.legende ?? "Photo du SAV"} />}</div>;
}

/** Une photo choisie, pas encore envoyée : son aperçu vit le temps de la saisie. */
function PhotoEnAttente({ fichier, onRetirer }: { fichier: File; onRetirer: () => void }) {
  const url = useMemo(() => {
    try {
      return URL.createObjectURL(fichier);
    } catch (e) {
      // Un navigateur (ou un environnement de test) qui ne sait pas l'aperçu : la vignette reste vide, l'envoi se fera.
      console.warn("Aperçu de la photo indisponible", fichier.name, e);
      return null;
    }
  }, [fichier]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <div className="photo-thumb">
      {url && <img src={url} alt={fichier.name} />}
      <button type="button" className="photo-remove-btn" aria-label={`Retirer ${fichier.name}`} onClick={onRetirer}>✕</button>
    </div>
  );
}

interface Props {
  /** Le SAV déjà enregistré, dont on montre les photos rangées ; `null` à la création. */
  savId: string | null;
  nouvelles: readonly File[];
  onChange: (f: File[]) => void;
  desactive: boolean;
}

/**
 * « Photos (5 maximum) » du SAV (`photoThumbsBCHTML`) : les vignettes, puis la
 * case « + » tant qu'il reste de la place. Les photos rangées se lisent ;
 * celles qu'on ajoute partent à l'enregistrement.
 */
export function PhotosSav({ savId, nouvelles, onChange, desactive }: Props) {
  const rangees = usePhotos(savId ?? undefined);
  const entree = useRef<HTMLInputElement>(null);
  const id = useId();
  const deja = (rangees.data ?? []).length;
  const place = PHOTOS_SAV_MAX - deja - nouvelles.length;
  function choisir(liste: FileList | null) {
    const fichiers = [...(liste ?? [])];
    const motif = fichiers.map((f) => refusPieceJointe({ name: f.name, type: f.type, size: f.size })).find((m) => m !== null);
    if (motif) return afficherToast(motif);
    if (place <= 0) return afficherToast(`Maximum ${PHOTOS_SAV_MAX} photos par SAV.`, "success");
    if (fichiers.length > place) afficherToast(`Seules ${place} photo(s) ont été ajoutées (maximum ${PHOTOS_SAV_MAX} au total).`, "success");
    onChange([...nouvelles, ...fichiers.slice(0, place)]);
  }
  return (
    <div className="field full">
      <label htmlFor={id}>Photos (5 maximum)</label>
      <input type="file" id={id} ref={entree} accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { choisir(e.target.files); e.target.value = ""; }} />
      <div className="photo-grid">
        {(rangees.data ?? []).map((p) => <PhotoRangee key={p.id} photo={p} />)}
        {nouvelles.map((f, i) => <PhotoEnAttente key={`${f.name}-${i}`} fichier={f} onRetirer={() => onChange(nouvelles.filter((_, j) => j !== i))} />)}
        {!desactive && place > 0 && (
          <div className="photo-add" role="button" tabIndex={0} title="Ajouter une photo" aria-label="Ajouter une photo" onClick={() => entree.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); entree.current?.click(); } }}>+</div>
        )}
      </div>
    </div>
  );
}
