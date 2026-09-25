import { useId } from "react";
import { Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { usePhotosDuBon } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";
import { compresserPhoto } from "./image";

/** Qui écrit au planning (`peut_ecrire`) — et le sous-traitant, qui joint ses photos (proposition 20260926051000). */
const DEPOSENT = ["admin", "conducteur", "technicien", "sous_traitant"];
const RETIRENT = ["admin", "conducteur", "technicien"];

/**
 * Les photos du bon, dans le seau `terrain`. L'écran historique les gardait en
 * mémoire (`technicienPhotos`, sans colonne) : elles disparaissaient à
 * l'enregistrement. Ici elles vont dans `bon_commande_photos`.
 */
export function PhotosTerrain({ bcId }: { bcId: string }) {
  const { role, signaler } = usePlanningContexte();
  const { liste, ajouter, retirer } = usePhotosDuBon(bcId);
  const idChamp = useId();
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
    signaler("Photo(s) ajoutée(s).");
  };

  return (
    <section aria-label="Photos" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Photos</h3>
      {liste.isError && <Erreur erreur={liste.error} reessayer={() => void liste.refetch()} />}
      <ul className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <li key={p.id} className="relative">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer">
                <img src={p.url} alt="Photo du chantier" className="h-24 w-24 rounded-md border object-cover" />
              </a>
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-md border text-xs">Photo indisponible</span>
            )}
            {role && RETIRENT.includes(role) && (
              <button
                type="button"
                aria-label="Retirer cette photo"
                className="absolute right-0 top-0 rounded-bl bg-background/80 px-1 text-xs"
                onClick={() => retirer.mutate(p, { onError: (e) => signaler("", e) })}
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {!photos.length && liste.isSuccess && <li className="text-xs text-muted-foreground">Aucune photo.</li>}
      </ul>
      {role && DEPOSENT.includes(role) && (
        <div>
          <label htmlFor={idChamp} className="cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-muted">📷 Ajouter des photos</label>
          <input id={idChamp} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void deposer(e.target.files).finally(() => (e.target.value = ""))} />
          {ajouter.isPending && <span className="ml-2 text-xs text-muted-foreground">Envoi…</span>}
          {ajouter.isError && <span className="ml-2 text-xs text-destructive">{messageErreur(ajouter.error)}</span>}
        </div>
      )}
    </section>
  );
}
