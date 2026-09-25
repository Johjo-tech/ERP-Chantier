import { useRef, useState } from "react";
import { Croquis } from "@/modules/planning/components/Croquis";
import { compresserPhoto } from "@/modules/planning/components/image";
import { basculerCategorie, dupliquer, placesPhotos, type PhotoEdition } from "../domain/assistant";
import { PHOTOS_MAX, signatureClientDemandee, type LogementStatut } from "../domain/rapport";
import { AnnotationPhoto } from "./AnnotationPhoto";

const ENCRE_SIGNATURE = "#182233";
/** Le pavé de signature de l'ancien écran (`sigCanvas`, 500 × 150). */
const TOILE_SIGNATURE = { largeur: 500, hauteur: 150 };
const EFFACER = { libelle: "Effacer la signature", classe: "btn small", style: { marginTop: "8px" } };

export interface SignaturesEdition {
  /** `undefined` : inchangée (on garde celle en base). */
  client: string | null | undefined;
  technicien: string | null | undefined;
}

interface Props {
  photos: PhotoEdition[];
  onPhotos: (p: PhotoEdition[]) => void;
  signatures: SignaturesEdition;
  signaturesExistantes: { client: string | null; technicien: string | null };
  onSignatures: (s: SignaturesEdition) => void;
  logement: LogementStatut | null;
  onMessage: (m: string) => void;
}

/** Réduite dès l'ajout (900 px, JPEG — `handlePhotoFiles`), pour ne transporter que ce qui sera gardé. */
async function lireEnDataUrl(f: File): Promise<string> {
  const reduite = await compresserPhoto(f);
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result));
    lecteur.onerror = () => rejeter(new Error("Cette photo n'a pas pu être lue."));
    lecteur.readAsDataURL(reduite);
  });
}

/**
 * Étape 3 (`stepPhotosHTML`) — photos (trois au plus, classées constatation ou préconisation,
 * dupliquées, annotées) et signatures. Pas de signature du client dans un
 * logement vacant ni une partie commune : personne n'est là pour signer (PLN-21).
 */
export function EtapePhotos({ photos, onPhotos, signatures, signaturesExistantes, onSignatures, logement, onMessage }: Props) {
  const champ = useRef<HTMLInputElement>(null);
  const [annotee, setAnnotee] = useState<PhotoEdition | null>(null);
  const ajouter = async (fichiers: FileList | null) => {
    const liste = Array.from(fichiers ?? []);
    const { acceptees, message } = placesPhotos(photos, liste.length);
    if (message) onMessage(message);
    const nouvelles = await Promise.all(liste.slice(0, acceptees).map(async (f) => {
      const dataUrl = await lireEnDataUrl(f);
      return { cle: crypto.randomUUID(), id: null, apercu: dataUrl, dataUrl, categorie: null } satisfies PhotoEdition;
    }));
    onPhotos([...photos, ...nouvelles]);
  };
  const remplacer = (p: PhotoEdition) => onPhotos(photos.map((x) => (x.cle === p.cle ? p : x)));

  return (
    <>
      <div className="field full">
        <label>Photos de l'intervention ({PHOTOS_MAX} maximum)</label>
        <input ref={champ} type="file" id="photoFileInput" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => void ajouter(e.target.files).catch((err: unknown) => onMessage(err instanceof Error ? err.message : "Photo illisible.")).finally(() => (e.target.value = ""))} />
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div key={p.cle} className={`photo-thumb photo-thumb-${p.categorie ?? ""}`}>
              <img src={p.apercu} alt={`Photo ${i + 1}`} onClick={() => setAnnotee(p)} style={{ cursor: "pointer" }} title="Cliquer pour annoter (flèche, carré)" />
              <button type="button" className="photo-remove-btn" aria-label={`Retirer la photo ${i + 1}`} onClick={() => onPhotos(photos.filter((x) => x.cle !== p.cle))}>✕</button>
              <button type="button" className="photo-duplicate-btn" aria-label={`Dupliquer la photo ${i + 1}`} onClick={() => (photos.length >= PHOTOS_MAX ? onMessage("Maximum 3 photos par intervention.") : onPhotos(dupliquer(photos, p.cle, crypto.randomUUID())))} title="Dupliquer cette photo">⧉</button>
              {p.categorie && <span className={`photo-categorie-badge photo-categorie-${p.categorie}`}>{p.categorie === "constatation" ? "Constatation" : "Préconisation"}</span>}
              <div className="photo-categorie-choix">
                <button type="button" className="photo-cat-btn photo-cat-constatation" aria-pressed={p.categorie === "constatation"} onClick={() => remplacer(basculerCategorie(p, "constatation"))} title="Marquer comme photo de constatation">🔴 Constat.</button>
                <button type="button" className="photo-cat-btn photo-cat-preco" aria-pressed={p.categorie === "preconisation"} onClick={() => remplacer(basculerCategorie(p, "preconisation"))} title="Marquer comme photo de préconisation">🟢 Préco</button>
              </div>
            </div>
          ))}
          {photos.length < PHOTOS_MAX && (
            <div className="photo-add" role="button" tabIndex={0} aria-label="Ajouter une photo" onClick={() => champ.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && champ.current?.click()} title="Ajouter une photo">+</div>
          )}
        </div>
      </div>
      {signatureClientDemandee(logement) && (
        <div className="field full" style={{ marginTop: "16px" }}>
          <label>Signature client</label>
          <Croquis {...TOILE_SIGNATURE} id="sigCanvas" enveloppe="sig-wrap" libelle="Signature du client" couleur={ENCRE_SIGNATURE} valeur={signatures.client === undefined ? signaturesExistantes.client : signatures.client} onChange={(v) => onSignatures({ ...signatures, client: v })} effacer={EFFACER} />
        </div>
      )}
      <div className="field full" style={{ marginTop: "16px" }}>
        <label>Signature du technicien</label>
        <Croquis {...TOILE_SIGNATURE} id="sigCanvasTech" enveloppe="sig-wrap" libelle="Signature du technicien" couleur={ENCRE_SIGNATURE} valeur={signatures.technicien === undefined ? signaturesExistantes.technicien : signatures.technicien} onChange={(v) => onSignatures({ ...signatures, technicien: v })} effacer={EFFACER} />
      </div>
      {annotee && (
        <AnnotationPhoto
          image={annotee.dataUrl ?? annotee.apercu}
          categorie={annotee.categorie}
          onFermer={() => setAnnotee(null)}
          onValider={(dataUrl) => {
            remplacer({ ...annotee, apercu: dataUrl, dataUrl });
            setAnnotee(null);
          }}
        />
      )}
    </>
  );
}
