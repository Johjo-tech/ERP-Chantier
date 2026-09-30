/**
 * Ce qu'on sait dire d'un devis relu, avant de l'enregistrer.
 *
 * Module feuille : il n'importe que des types, ce qui lui permet de servir la
 * couche `integrations` comme l'écran, et de s'éprouver sans base ni navigateur.
 *
 * Il répond à trois questions que la lecture automatique pose et que la base
 * ne pardonne pas :
 *
 *   - une remise hors de [0, 100] fait rejeter l'INSERTION ENTIÈRE par la
 *     contrainte CHECK de `devis.remise_pourcentage`, bien plus loin et sans
 *     contexte ;
 *   - un total imprimé qui ne retombe pas sur la somme des lignes est le seul
 *     contrôle d'arithmétique dont on dispose — le devis, lui, n'a pas de
 *     déclencheur pour le dire ;
 *   - un modèle se tait justement quand il n'a rien vu : ses avertissements ne
 *     suffisent pas à savoir ce qui manque.
 */

/** En deçà de cet écart, deux montants disent la même chose. */
const TOLERANCE = 0.01;

/**
 * La remise du devis, ramenée à ce que la colonne accepte.
 *
 * Le pourcentage l'emporte quand il est écrit ; sinon on le déduit du montant,
 * qui est la forme sous laquelle beaucoup de logiciels l'impriment. Deux
 * décimales, comme `numeric(5,2)`.
 */
export function remiseNormalisee(
  pourcentage?: number | null,
  montantHT?: number | null,
  totalHTAvantRemise?: number | null
): number {
  const borner = (n: number) => Math.min(100, Math.max(0, Math.round(n * 100) / 100));
  if (pourcentage != null && Number.isFinite(pourcentage)) return borner(pourcentage);
  if (
    montantHT != null &&
    totalHTAvantRemise != null &&
    Number.isFinite(montantHT) &&
    totalHTAvantRemise > 0
  ) {
    return borner((montantHT / totalHTAvantRemise) * 100);
  }
  return 0;
}

/**
 * L'écart entre le total imprimé sur le devis et celui qu'on recalcule — ou
 * `null` quand il n'y a rien à dire.
 *
 * Le devis d'origine fait foi : s'ils divergent, c'est la lecture qui s'est
 * trompée, pas le document. On le dit, on ne corrige pas.
 */
export function ecartDeTotal(
  totalImprime: number | null | undefined,
  totalRecalcule: number
): string | null {
  if (totalImprime == null || !Number.isFinite(totalImprime)) return null;
  const ecart = totalRecalcule - totalImprime;
  if (Math.abs(ecart) <= TOLERANCE) return null;
  const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
  return (
    `Le total lu sur le devis (${euros(totalImprime)} HT) ne correspond pas à la ` +
    `somme des lignes (${euros(totalRecalcule)}) : écart de ${euros(Math.abs(ecart))}. ` +
    `Relisez les lignes avant d'enregistrer.`
  );
}

export interface Manque {
  code: string;
  libelle: string;
}

export interface LectureDevis {
  numeroDevis?: string | null;
  client?: string | null;
  totalHT?: number | null;
  lignes?: { type?: string | null; qte?: number | null; prixUnitaire?: number | null }[];
}

/**
 * Ce qui manque à une lecture pour faire un devis, dit en toutes lettres.
 *
 * Le modèle remplit `avertissements` à sa discrétion et se tait justement quand
 * il n'a rien vu : une lecture qui rentre sans numéro et sans ligne se
 * présentait comme une réussite. On complète son compte rendu.
 */
export function essentielsDeLectureDevis(lu: LectureDevis): Manque[] {
  const manques: Manque[] = [];
  const lignes = lu.lignes ?? [];
  const chiffrees = lignes.filter((l) => (l.type ?? "ligne") === "ligne");

  if (!String(lu.numeroDevis ?? "").trim()) {
    manques.push({
      code: "numero",
      libelle:
        "Numéro du devis non lu : sans lui, un numéro de la série courante sera " +
        "attribué et la référence d'origine sera perdue. Saisissez-le.",
    });
  }
  if (!String(lu.client ?? "").trim()) {
    manques.push({ code: "client", libelle: "Client non lu : il est obligatoire." });
  }
  if (!chiffrees.length) {
    manques.push({
      code: "lignes",
      libelle: "Aucune ligne chiffrée n'a été lue : le devis vaudrait 0,00 €.",
    });
  } else {
    const sansPrix = chiffrees.filter((l) => l.prixUnitaire == null).length;
    if (sansPrix === chiffrees.length) {
      manques.push({
        code: "prix",
        libelle:
          "Aucun prix unitaire n'a été lu, alors qu'un devis est un chiffrage : " +
          "vérifiez que le tableau du PDF a bien été transcrit.",
      });
    }
  }

  const total = chiffrees.reduce(
    (s, l) => s + (Number(l.qte) || 0) * (Number(l.prixUnitaire) || 0),
    0
  );
  const ecart = ecartDeTotal(lu.totalHT, total);
  if (ecart) manques.push({ code: "total", libelle: ecart });

  return manques;
}
