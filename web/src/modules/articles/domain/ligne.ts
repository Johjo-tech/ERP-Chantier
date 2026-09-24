import type { LigneEdition } from "@/modules/documents/domain/lignes";
import { UNITE_DEFAUT, type Article, type ValeursArticle } from "./article";

const enTexte = (n: number) => String(n).replace(".", ",");

/** Ce qu'une ligne a besoin de connaître d'un article pour se remplir. */
export type ArticlePourLigne = Pick<Article, "code" | "designation" | "description" | "unite" | "prix_unitaire" | "tva">;

/**
 * Recopie l'article dans la ligne (DEV-10, DEV-43, ART-10), comme
 * `applyArticleObjectToLigne` de l'ancien écran.
 *
 * On COPIE, on ne lie pas : modifier le catalogue plus tard ne doit rien
 * changer à un devis déjà établi. La quantité n'est jamais touchée — c'est la
 * seule valeur que l'utilisateur a saisie lui-même — ni l'identifiant, qui
 * rattache la ligne à celle déjà en base. Une description ne remplace pas un
 * commentaire déjà écrit à la main.
 */
export function appliquerArticle(ligne: LigneEdition, article: ArticlePourLigne): LigneEdition {
  return {
    ...ligne,
    type: "ligne",
    article_reference: article.code,
    designation: article.designation,
    commentaire: ligne.commentaire.trim() ? ligne.commentaire : (article.description ?? ""),
    unite: article.unite || ligne.unite || UNITE_DEFAUT,
    prix_unitaire: enTexte(article.prix_unitaire),
    tva: enTexte(article.tva),
  };
}

/**
 * La fiche d'un article à créer depuis une ligne dont la référence est
 * inconnue (ART-10) : plutôt que d'obliger à quitter le document et tout
 * ressaisir, le catalogue s'ouvre pré-rempli de ce que la ligne porte déjà.
 */
export function brouillonDepuisLigne(ligne: LigneEdition, code: string): Partial<ValeursArticle> {
  return {
    code: code.trim(),
    designation: ligne.designation,
    description: ligne.commentaire,
    unite: ligne.unite || UNITE_DEFAUT,
    prix_unitaire: ligne.prix_unitaire,
    tva: ligne.tva,
  };
}
