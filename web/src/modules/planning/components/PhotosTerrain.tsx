import type { CSSProperties } from "react";
import { Erreur } from "@/components/etats/Etats";
import { usePhotosDuBon } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";
import { compresserPhoto } from "./image";

/** Qui écrit au planning (`peut_ecrire`) — et le sous-traitant, qui joint ses photos (proposition 20260926051000). */
const DEPOSENT = ["admin", "conducteur", "technicien", "sous_traitant"];
const RETIRENT = ["admin", "conducteur", "technicien"];

/**
 * Les photos du bon (`renderTechModalPhotos`), dans le seau `terrain`. L'écran
 * historique les gardait en mémoire (`technicienPhotos`, sans colonne) : elles
 * disparaissaient à l'enregistrement. Ici elles vont dans
 * `bon_commande_photos` dès qu'on les choisit (D-PLN-06).
 */
export function PhotosTerrain({ bcId, grilleStyle }: { bcId: string; grilleStyle?: CSSProperties }) {
  const { role, signaler } = usePlanningContexte();
  const { liste, ajouter, retirer } = usePhotosDuBon(bcId);
  const photos = liste.data ?? [];
  const deposer = async (fichiers: FileList | null) => {
    for (const [i, f] of Array.from(fichiers ?? []).entries()) {
      try {
        const reduite = await compresserPhoto(f);
        await ajouter.mutateAsync({ fichier: reduite, position: photos.length + i });
      } catch (e) {
        console.error("Photo non déposée", e);
        signaler("", e instanceof Error && !("code" in e) ? { code: "P0001", message: e.message } : e);
        return;
      }
    }
  };

  return (
    <>
      {liste.isError && <Erreur erreur={liste.error} reessayer={() => void liste.refetch()} />}
      {role && DEPOSENT.includes(role) && (
        <label className="btn small" style={{ cursor: "pointer" }}>
          + Ajouter une photo
          <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={(e) => void deposer(e.target.files).finally(() => (e.target.value = ""))} />
        </label>
      )}
      <div className="tech-photos-grid" style={grilleStyle}>
        {photos.map((p) => (
          <div key={p.id} className="tech-photo-thumb">
            {p.url && <img src={p.url} alt="Photo du chantier" onClick={() => window.open(p.url ?? "", "_blank", "noopener")} />}
            {role && RETIRENT.includes(role) && (
              <button type="button" aria-label="Retirer cette photo" onClick={() => retirer.mutate(p, { onError: (e) => signaler("", e) })}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
