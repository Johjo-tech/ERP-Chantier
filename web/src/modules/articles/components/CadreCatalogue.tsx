import type { ReactNode } from "react";
import { Link } from "react-router";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";

/**
 * L'écran « Catalogue » de l'ancien (`renderCatalogue`) : le titre, les deux
 * boutons, puis `#catalogueZone` où l'on voit TOUR À TOUR la liste, la fiche ou
 * l'import. Les boutons disparaissent dès que la zone montre une fiche ou un
 * import — l'ancien ne les rendait qu'avec la liste. Ici chaque état a sa
 * route ; ce cadre les habille tous pareil.
 */
export function CadreCatalogue({ avecBoutons = false, children }: { avecBoutons?: boolean; children: ReactNode }) {
  const peutEcrire = usePermission("articles", "modifier");
  // L'import dépend de l'abonnement (IMP-02) : l'ancien le montrait à tous.
  const importOuvert = useFonctionnalite("import_articles");
  return (
    <>
      <div className="page-head">
        <h1>Catalogue</h1>
        {avecBoutons && peutEcrire && (
          <div style={{ display: "flex", gap: "8px" }}>
            {importOuvert && (
              <Link className="btn" to="/articles/import">
                📥 Importer un fichier
              </Link>
            )}
            <Link className="btn primary" to="/articles/nouveau">
              + Nouvel article
            </Link>
          </div>
        )}
      </div>
      <div id="catalogueZone">{children}</div>
    </>
  );
}
