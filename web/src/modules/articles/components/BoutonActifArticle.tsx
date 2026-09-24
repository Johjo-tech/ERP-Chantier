import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { messageErreur } from "@/lib/erreurs";
import type { Article } from "../domain/article";
import { useChangerActif } from "../hooks/useArticles";

/**
 * Retirer / Remettre (ART-03). Il n'existe AUCUN bouton de suppression : des
 * documents citent le code. Retirer demande confirmation parce que l'article
 * cesse d'être proposé à la saisie ; remettre est sans risque.
 */
export function BoutonActifArticle({ article }: { article: Pick<Article, "id" | "code" | "actif"> }) {
  const changer = useChangerActif();
  const erreur = changer.isError && (
    <span role="alert" className="block text-xs text-destructive">{messageErreur(changer.error)}</span>
  );
  if (!article.actif) {
    return (
      <>
        <Button variant="outline" size="sm" disabled={changer.isPending} onClick={() => changer.mutate({ id: article.id, actif: true })}>
          Remettre
        </Button>
        {erreur}
      </>
    );
  }
  return (
    <>
      <BoutonConfirme
        libelle="Retirer"
        question={`Retirer ${article.code} ? Il reste cité par les documents, mais ne sera plus proposé.`}
        enCours={changer.isPending}
        onConfirmer={() => changer.mutate({ id: article.id, actif: false })}
      />
      {erreur}
    </>
  );
}
