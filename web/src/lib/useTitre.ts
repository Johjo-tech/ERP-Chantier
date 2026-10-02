import { useEffect } from "react";

/** Le titre de l'onglet d'une page autonome de l'ancienne application, le temps qu'elle est affichée. */
export function useTitre(titre: string): void {
  useEffect(() => {
    const avant = document.title;
    document.title = titre;
    return () => {
      document.title = avant;
    };
  }, [titre]);
}
