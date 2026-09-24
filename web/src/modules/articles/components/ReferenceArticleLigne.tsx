import type { PropsReferenceLigne } from "@/modules/documents/components/reference";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { appliquerArticle } from "../domain/ligne";
import { ChoixArticle } from "./ChoixArticle";

/**
 * Le champ « référence » d'une ligne de document : taper un code ou un mot
 * remplit la ligne depuis le catalogue (copie, quantité jamais touchée).
 * Sans droit de lire le catalogue, la référence reste un texte libre.
 */
export function ReferenceArticleLigne({ ligne, index, remplacer, desactive }: PropsReferenceLigne) {
  const catalogue = usePermission("articles", "voir");
  if (!catalogue || desactive) {
    return ligne.article_reference ? <span className="text-xs text-muted-foreground">Réf. {ligne.article_reference}</span> : null;
  }
  return (
    <ChoixArticle
      libelle={`Code article, ligne ${index + 1}`}
      valeur={ligne.article_reference}
      onSaisie={(texte) => remplacer({ ...ligne, article_reference: texte })}
      onChoisir={(article) => remplacer(appliquerArticle(ligne, article))}
    />
  );
}
