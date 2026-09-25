import { useState } from "react";
import { versionConstruite } from "@/lib/version";

type Etat = "repos" | "copiee" | "echec";

/**
 * La version construite, copiable d'un clic (AUTH-12) : une version qu'on
 * doit recopier à la main arrive toujours tronquée dans un signalement.
 */
export function VersionConstruite() {
  const [etat, setEtat] = useState<Etat>("repos");
  const version = versionConstruite();

  function copier() {
    // Presse-papiers refusé (contexte non sécurisé, permission) : la version
    // reste affichée, on le dit au lieu de prétendre l'avoir copiée.
    if (!navigator.clipboard) {
      setEtat("echec");
      return;
    }
    navigator.clipboard.writeText(version).then(
      () => setEtat("copiee"),
      (e: unknown) => {
        console.error("Copie de la version refusée", e);
        setEtat("echec");
      }
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>
        Version <span className="font-mono">{version}</span>
      </span>
      <button type="button" onClick={copier} className="rounded px-1 text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Copier
      </button>
      <span aria-live="polite">
        {etat === "copiee" ? "Copiée" : etat === "echec" ? "Copie impossible : relevez-la à la main" : ""}
      </span>
    </div>
  );
}
