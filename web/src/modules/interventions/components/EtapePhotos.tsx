import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Croquis } from "@/modules/planning/components/Croquis";
import { compresserPhoto } from "@/modules/planning/components/image";
import { basculerCategorie, dupliquer, placesPhotos, type PhotoEdition } from "../domain/assistant";
import { PHOTOS_MAX, signatureClientDemandee, type LogementStatut } from "../domain/rapport";
import { AnnotationPhoto } from "./AnnotationPhoto";

const ENCRE_SIGNATURE = "#182233";

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
 * Étape 3 — photos (trois au plus, classées constatation ou préconisation,
 * dupliquées, annotées) et signatures. Pas de signature du client dans un
 * logement vacant ni une partie commune : personne n'est là pour signer (PLN-21).
 */
export function EtapePhotos({ photos, onPhotos, signatures, signaturesExistantes, onSignatures, logement, onMessage }: Props) {
  const idFichier = useId();
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
    <div className="flex flex-col gap-4">
      <section aria-label="Photos de l'intervention" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Photos de l'intervention ({PHOTOS_MAX} maximum)</h3>
        <ul className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <li key={p.cle} className="flex w-40 flex-col gap-1">
              <button type="button" onClick={() => setAnnotee(p)} title="Cliquer pour annoter">
                <img src={p.apercu} alt={`Photo ${i + 1}${p.categorie ? ` (${p.categorie === "constatation" ? "constatation" : "préconisation"})` : ""}`} className="h-28 w-40 rounded-md border object-cover" />
              </button>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={p.categorie === "constatation" ? "default" : "outline"} aria-pressed={p.categorie === "constatation"} className="h-6 px-1 text-[11px]" onClick={() => remplacer(basculerCategorie(p, "constatation"))}>🔴 Constat.</Button>
                <Button size="sm" variant={p.categorie === "preconisation" ? "default" : "outline"} aria-pressed={p.categorie === "preconisation"} className="h-6 px-1 text-[11px]" onClick={() => remplacer(basculerCategorie(p, "preconisation"))}>🟢 Préco</Button>
                <Button size="sm" variant="ghost" className="h-6 px-1 text-[11px]" aria-label={`Dupliquer la photo ${i + 1}`} disabled={photos.length >= PHOTOS_MAX} onClick={() => onPhotos(dupliquer(photos, p.cle, crypto.randomUUID()))}>⧉</Button>
                <Button size="sm" variant="ghost" className="h-6 px-1 text-[11px]" aria-label={`Retirer la photo ${i + 1}`} onClick={() => onPhotos(photos.filter((x) => x.cle !== p.cle))}>✕</Button>
              </div>
            </li>
          ))}
        </ul>
        {photos.length < PHOTOS_MAX && (
          <div>
            <label htmlFor={idFichier} className="cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-muted">📷 Ajouter une photo</label>
            <input id={idFichier} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void ajouter(e.target.files).catch((err: unknown) => onMessage(err instanceof Error ? err.message : "Photo illisible."))} />
          </div>
        )}
      </section>
      {signatureClientDemandee(logement) && (
        <section aria-label="Signature client" className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Signature client</h3>
          <Croquis libelle="Signature du client" couleur={ENCRE_SIGNATURE} valeur={signatures.client === undefined ? signaturesExistantes.client : signatures.client} onChange={(v) => onSignatures({ ...signatures, client: v })} />
        </section>
      )}
      <section aria-label="Signature du technicien" className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Signature du technicien</h3>
        <Croquis libelle="Signature du technicien" couleur={ENCRE_SIGNATURE} valeur={signatures.technicien === undefined ? signaturesExistantes.technicien : signatures.technicien} onChange={(v) => onSignatures({ ...signatures, technicien: v })} />
      </section>
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
    </div>
  );
}
