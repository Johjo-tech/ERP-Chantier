import { useLocation, useNavigate } from "react-router";
import type { PropsReferenceLigne } from "@/modules/documents/components/reference";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { appliquerArticle, brouillonDepuisLigne } from "../domain/ligne";
import { ChoixArticle } from "./ChoixArticle";

/**
 * Le champ « référence » d'une ligne de document : taper un code ou un mot
 * remplit la ligne depuis le catalogue (copie, quantité jamais touchée).
 * Sans droit de lire le catalogue, la référence reste un texte libre.
 *
 * Référence inconnue : « Créer dans le catalogue » ouvre la fiche article
 * préremplie de la ligne (`creerArticleDepuisLigne`, app.js l. 2679, DEV-10),
 * puis revient au document. La saisie en cours du document ne survit pas au
 * changement d'écran : on le dit avant de partir.
 */
export function ReferenceArticleLigne({ ligne, index, remplacer, desactive }: PropsReferenceLigne) {
  const catalogue = usePermission("articles", "voir");
  // Toute écriture au catalogue suit le droit « modifier » (ART-06).
  const peutCreer = usePermission("articles", "modifier");
  const navigate = useNavigate();
  const location = useLocation();
  if (!catalogue || desactive) {
    return ligne.article_reference ? <span className="text-xs text-muted-foreground">Réf. {ligne.article_reference}</span> : null;
  }
  const creer = (code: string) => {
    if (!window.confirm("Ouvrir la fiche article ? Enregistrez d'abord le document : ce qui n'est pas enregistré sera perdu.")) return;
    void navigate("/articles/nouveau", { state: { brouillon: brouillonDepuisLigne(ligne, code), retour: location.pathname } });
  };
  return (
    <ChoixArticle
      libelle={`Code article, ligne ${index + 1}`}
      valeur={ligne.article_reference}
      onSaisie={(texte) => remplacer({ ...ligne, article_reference: texte })}
      onChoisir={(article) => remplacer(appliquerArticle(ligne, article))}
      onCreer={peutCreer ? creer : undefined}
    />
  );
}
