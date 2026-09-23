/**
 * Les listes de choix tenues par la société.
 *
 * Catégories et états de matériel, catégories d'achat de chantier, unités,
 * pièces courantes et leurs fournisseurs : autant de listes qui vivaient dans
 * le code de l'écran, hors de portée de qui s'en sert.
 *
 * UNE LISTE N'EST JAMAIS SEULEMENT LA TABLE. C'est la leçon que
 * `referentielMetiers` avait déjà coûté : KTA ne déclarait que trois métiers
 * alors que ses bons en portaient cinq, et les deux absents avaient disparu de
 * la liste à cocher — donc impossibles à recocher. Une catégorie employée par
 * une fiche doit rester proposée, même si personne ne l'a déclarée.
 *
 * Module feuille : il n'importe que des types. C'est aussi pourquoi la
 * normalisation est réécrite ici plutôt qu'empruntée à `regles-metiers` —
 * `CLAUDE.md` interdit qu'une feuille en importe une autre, et huit lignes
 * dupliquées valent mieux qu'un cycle de dépendances.
 */

/** Une entrée de liste, telle que la table la porte. */
export interface EntreeReferentiel {
  id?: string;
  societeId?: string | null;
  domaine?: string | null;
  libelle?: string | null;
  code?: string | null;
  couleur?: string | null;
  icone?: string | null;
  position?: number | null;
}

/**
 * Ramène un libellé à sa forme comparable : sans accent, en majuscules, sans
 * ponctuation. « Échafaudage » et « ECHAFAUDAGE » deviennent le même mot.
 */
export function normaliserEntree(texte: string | null | undefined): string {
  return (texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Deux entrées désignent-elles la même chose ? */
export function memeEntree(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return normaliserEntree(a) === normaliserEntree(b);
}

/**
 * Les entrées d'un domaine, pour une société, dans l'ordre choisi.
 *
 * Le tri suit `position`, jamais l'alphabet : une liste d'états va de « Neuf »
 * à « Hors service », et l'ordre alphabétique la rendrait illisible. À
 * position égale — l'état d'avant la première réorganisation — le libellé
 * départage, pour que l'ordre reste stable d'un affichage à l'autre.
 */
export function entreesDuDomaine(
  entrees: EntreeReferentiel[],
  domaine: string,
  societeId?: string | null
): EntreeReferentiel[] {
  return (entrees ?? [])
    .filter((e) => e.domaine === domaine && (!societeId || e.societeId === societeId))
    .slice()
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) ||
        (a.libelle ?? "").localeCompare(b.libelle ?? "", "fr")
    );
}

/**
 * La liste proposée : ce qui est déclaré, PLUS ce que les fiches emploient
 * déjà.
 *
 * L'ordre déclaré est conservé tel quel ; les valeurs seulement employées
 * viennent ensuite, par ordre alphabétique — elles n'ont pas de rang, et les
 * intercaler demanderait de deviner où.
 *
 * L'orthographe retenue est celle du référentiel : les déclarées passent en
 * premier, et une valeur déjà vue ne réécrit pas la précédente.
 */
export function referentielCompose(
  declares: (string | null | undefined)[],
  employes: (string | null | undefined)[] = []
): string[] {
  const retenus = new Map<string, string>();
  for (const brut of declares) {
    const v = (brut ?? "").trim();
    const cle = normaliserEntree(v);
    if (!cle || retenus.has(cle)) continue;
    retenus.set(cle, v);
  }

  const ajoutes = new Map<string, string>();
  for (const brut of employes) {
    const v = (brut ?? "").trim();
    const cle = normaliserEntree(v);
    if (!cle || retenus.has(cle) || ajoutes.has(cle)) continue;
    ajoutes.set(cle, v);
  }

  return [
    ...retenus.values(),
    ...[...ajoutes.values()].sort((a, b) => a.localeCompare(b, "fr")),
  ];
}

/**
 * Le rang de la prochaine entrée d'un domaine.
 *
 * Une entrée neuve se pose À LA FIN. Sans cela elle prendrait la position 0 et
 * passerait devant tout le monde — ce qui s'est produit sur les métiers avant
 * qu'on y prenne garde.
 */
export function prochainePosition(
  entrees: EntreeReferentiel[],
  domaine: string,
  societeId?: string | null
): number {
  const liste = entreesDuDomaine(entrees, domaine, societeId);
  return liste.reduce((max, e) => Math.max(max, e.position ?? 0), 0) + 1;
}
