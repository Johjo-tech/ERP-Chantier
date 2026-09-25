import { afficherToast } from "@/lib/toast";
import { versionConstruite } from "@/lib/version";

/** L'ancien écran l'annonçait quatre secondes : le temps de la noter. */
const DUREE_ANNONCE_MS = 4000;

/**
 * La version construite, copiable d'un clic (AUTH-12, `copierVersion` de
 * l'ancien écran) : une version qu'on doit recopier à la main arrive toujours
 * tronquée dans un signalement.
 */
export function VersionConstruite() {
  const version = versionConstruite();

  function copier() {
    // Presse-papiers refusé (contexte non sécurisé, permission) : la version
    // reste affichée, on le dit au lieu de prétendre l'avoir copiée.
    if (!navigator.clipboard) {
      afficherToast("Copie impossible : relevez la version à la main.");
      return;
    }
    navigator.clipboard.writeText(version).then(
      () => afficherToast(`Version copiée : ${version}`, "success", DUREE_ANNONCE_MS),
      (e: unknown) => {
        console.error("Copie de la version refusée", e);
        afficherToast("Copie impossible : relevez la version à la main.");
      }
    );
  }

  return (
    <div
      className="user-menu-version"
      role="button"
      tabIndex={0}
      title="Cliquer pour copier — à donner en cas d'anomalie"
      onClick={copier}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copier();
        }
      }}
    >
      version {version}
    </div>
  );
}
