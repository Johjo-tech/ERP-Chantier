import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useUrlFichier } from "@/modules/chantiers/hooks/useFiche";

/**
 * Ouvrir un fichier du seau privé : le lien nu de l'ancien écran (« 📎 … »),
 * par une URL signée demandée au moment du clic. Un refus se dit par la bulle.
 */
export function LienFichier({ chemin, libelle }: { chemin: string; libelle: string }) {
  const url = useUrlFichier();
  function ouvrir() {
    // La fenêtre s'ouvre pendant le clic (sinon bloquée), l'URL signée la remplit ensuite.
    const fenetre = window.open("", "_blank");
    url.mutate(chemin, {
      onSuccess: (u) => {
        if (fenetre) fenetre.location.href = u;
        else window.location.assign(u);
      },
      onError: (e) => {
        fenetre?.close();
        afficherToast(messageErreur(e));
      },
    });
  }
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ouvrir();
      }}
    >
      {libelle}
    </a>
  );
}
