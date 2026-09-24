import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Button } from "@/components/ui/button";
import { Can } from "@/modules/auth-roles/components/Can";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import { CRITERES_DEFAUT, type CriteresArticles } from "../domain/article";
import { useFamillesArticles, usePageArticles } from "../hooks/useArticles";
import { useDiffere } from "../hooks/useDiffere";
import { FiltresArticles, type ValeursFiltres } from "./FiltresArticles";
import { Pagination } from "./Pagination";
import { TableArticles } from "./TableArticles";

const FILTRES_DEFAUT: ValeursFiltres = { saisie: "", actif: CRITERES_DEFAUT.actif, type: "", famille: "" };

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
  const importOuvert = useFonctionnalite("import_articles");
  // « Retirés » vide ne veut pas dire catalogue vide : l'ancien écran le laissait croire.
  const filtre = !!(recherche.trim() || filtres.type || filtres.famille || filtres.actif === "retires");

  return (
    <>
      <EnTetePage
        titre="Articles"
        sousTitre={liste.data ? `${liste.data.total} article(s)` : undefined}
        actions={
          <Can module="articles" action="modifier">
            {importOuvert && (
              <Button variant="outline" asChild>
                <Link to="/articles/import">Importer un fichier</Link>
              </Button>
            )}
            <Button asChild>
              <Link to="/articles/nouveau">Nouvel article</Link>
            </Button>
          </Can>
        }
      />
      <FiltresArticles
        valeurs={filtres}
        familles={familles.data ?? []}
        onChange={(champ, valeur) => setFiltres((f) => ({ ...f, [champ]: valeur }))}
      />
      {liste.isPending && <Chargement libelle="Chargement du catalogue…" />}
      {liste.isError && <Erreur erreur={liste.error} reessayer={() => void liste.refetch()} />}
      {liste.isSuccess && liste.data.articles.length === 0 && (
        <Vide message={filtre ? "Aucun article ne correspond." : "Le catalogue est vide. Importez un fichier ou créez un premier article."} />
      )}
      {liste.isSuccess && liste.data.articles.length > 0 && (
        <div aria-busy={liste.isPlaceholderData}>
          <TableArticles articles={liste.data.articles} />
          <Pagination
            libelle="Pages du catalogue"
            page={liste.data.page}
            pages={liste.data.pages}
            onPage={(p) => setPagination({ page: p, pour: JSON.stringify(sansPage) })}
          />
        </div>
      )}
    </>
  );
}
