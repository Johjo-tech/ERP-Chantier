import { useState } from "react";
import { messageErreur } from "@/lib/erreurs";
import { CRITERES_DEFAUT, type CriteresArticles } from "../domain/article";
import { useFamillesArticles, usePageArticles } from "../hooks/useArticles";
import { useDiffere } from "../hooks/useDiffere";
import { CadreCatalogue } from "./CadreCatalogue";
import { FiltresArticles, type ValeursFiltres } from "./FiltresArticles";
import { Pagination } from "./Pagination";
import { TableArticles } from "./TableArticles";

const FILTRES_DEFAUT: ValeursFiltres = { saisie: "", actif: CRITERES_DEFAUT.actif, type: "", famille: "" };

/** Le catalogue de l'ancien (`catalogueListeHTML`) : filtres, compteur, table, pagination. */
export function PageArticles() {
  const [filtres, setFiltres] = useState(FILTRES_DEFAUT);
  const recherche = useDiffere(filtres.saisie);
  const sansPage = { recherche, actif: filtres.actif, type: filtres.type, famille: filtres.famille };
  // La page est rattachée aux filtres qui l'ont vue naître : un filtre changé ramène à la page 1, sans effet de bord.
  const [pagination, setPagination] = useState({ page: 1, pour: JSON.stringify(sansPage) });
  const page = pagination.pour === JSON.stringify(sansPage) ? pagination.page : 1;
  const criteres: CriteresArticles = { ...sansPage, page };

  const liste = usePageArticles(criteres);
  const familles = useFamillesArticles();
  // « Retirés » vide ne veut pas dire catalogue vide : l'ancien écran le laissait croire (D-ECR-CHA-03).
  const filtre = !!(recherche.trim() || filtres.type || filtres.famille || filtres.actif === "retires");

  // Comme l'ancien : une panne remplace toute la zone, filtres compris.
  if (liste.isError) {
    return (
      <CadreCatalogue avecBoutons>
        <div className="empty" role="alert">
          Catalogue indisponible : {messageErreur(liste.error)}
        </div>
      </CadreCatalogue>
    );
  }

  return (
    <CadreCatalogue avecBoutons>
      <FiltresArticles
        valeurs={filtres}
        familles={familles.data ?? []}
        onChange={(champ, valeur) => setFiltres((f) => ({ ...f, [champ]: valeur }))}
      />
      {liste.isPending && (
        <div className="empty" data-chargement="oui">
          Chargement du catalogue…
        </div>
      )}
      {liste.isSuccess && liste.data.articles.length === 0 && (
        <div className="empty">{filtre ? "Aucun article ne correspond." : "Le catalogue est vide. Importez un fichier ou créez un premier article."}</div>
      )}
      {liste.isSuccess && liste.data.articles.length > 0 && (
        <div aria-busy={liste.isPlaceholderData}>
          <div className="card-sub" style={{ marginBottom: "8px" }}>
            {liste.data.total} article{liste.data.total > 1 ? "s" : ""}
          </div>
          <TableArticles articles={liste.data.articles} />
          <Pagination
            libelle="Pages du catalogue"
            page={liste.data.page}
            pages={liste.data.pages}
            onPage={(p) => setPagination({ page: p, pour: JSON.stringify(sansPage) })}
          />
        </div>
      )}
    </CadreCatalogue>
  );
}
