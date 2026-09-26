import { messageErreur } from "@/lib/erreurs";
import type { Article } from "../domain/article";
import { useChangerActif } from "../hooks/useArticles";

/** La question de l'ancien (`retirerDuCatalogue`), au caractère près. */
export const QUESTION_RETRAIT =
  "Retirer cet article du catalogue ?\n\nIl reste cité par les documents qui l'emploient, mais ne sera plus proposé à la saisie.";

/**
 * Retirer / Remettre (ART-03). Il n'existe AUCUN bouton de suppression : des
 * documents citent le code. Retirer demande confirmation — par la boîte du
 * navigateur, comme l'ancien — parce que l'article cesse d'être proposé à la
 * saisie ; remettre est sans risque.
 */
export function BoutonActifArticle({ article }: { article: Pick<Article, "id" | "code" | "actif"> }) {
  const changer = useChangerActif();
  const erreur = changer.isError && (
    <span role="alert" className="champ-erreur" style={{ display: "block" }}>
      {messageErreur(changer.error)}
    </span>
  );
  if (!article.actif) {
    return (
      <>
        <button type="button" className="btn small" disabled={changer.isPending} onClick={() => changer.mutate({ id: article.id, actif: true })}>
          Remettre
        </button>
        {erreur}
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        className="btn small danger"
        disabled={changer.isPending}
        title="Retirer du catalogue sans l'effacer : des documents citent ce code"
        onClick={() => {
          if (window.confirm(QUESTION_RETRAIT)) changer.mutate({ id: article.id, actif: false });
        }}
      >
        Retirer
      </button>
      {erreur}
    </>
  );
}
