/**
 * Le métier d'un bon de commande, lu sur ses chapitres.
 *
 * Le métier est déjà écrit sur le bon — « PEINTURE TOUT LE LOGEMENT »,
 * « SOL CHAMBRE 1 » — mais il fallait jusqu'ici le recocher à la main dans une
 * liste. 222 bons portent des tâches sans qu'aucun métier ne soit renseigné, et
 * une tâche sans métier n'apparaît sous aucun bandeau de validation : le bon
 * reste bloqué avant le chiffrage, sans que rien ne le dise.
 *
 * Ce module est une feuille : il n'importe que des types. C'est ce qui permet à
 * l'adaptateur, à la session et à l'écran de partager la **même** comparaison de
 * métiers. Elle manquait précisément à un endroit — `tacheDuBonCommande` traitait
 * déjà `null` et `""` comme un seul cas, `tachePourMetier` non — et c'est cette
 * divergence qui a rendu une tâche définitivement invalidable.
 *
 * La reconnaissance est prudente par construction, comme `rapprocherClient` :
 * en dessous d'une correspondance nette, on ne décide pas à la place de
 * l'utilisateur, on ne propose rien.
 */

/** Une ligne de document, réduite à ce qui sert ici. */
export interface LigneChapitrable {
  type?: string | null;
  designation?: string | null;
}

/** Comment le métier a été reconnu — l'écran le montre, l'utilisateur juge. */
export type CertitudeMetier = "exact" | "contenu" | "approchant";

export interface MetierReconnu {
  metier: string;
  certitude: CertitudeMetier;
  /** Le titre du chapitre qui l'a produit, tel qu'il est écrit sur le bon. */
  chapitre: string;
}

export interface MetiersLus {
  /** Dans l'ordre d'apparition des chapitres, sans doublon. */
  metiers: string[];
  /** Métier → le chapitre dont il vient. */
  origines: Record<string, string>;
  /** Les chapitres qui ne désignent aucun métier : ils structurent, c'est tout. */
  ignores: string[];
}

/** Fautes de frappe tolérées : « PLOMBEIRE » est à 2 de « PLOMBERIE ». */
export const DISTANCE_MAX = 2;

/**
 * En deçà, une distance de 2 rapprocherait n'importe quoi : « SOL » serait à 2
 * de « SEL », de « SOT » et de « VOL ». Les mots courts se reconnaissent
 * exactement, ou pas du tout.
 */
export const LONGUEUR_MIN_APPROCHANTE = 6;

/**
 * Ramène un libellé à sa forme comparable : sans accent, en majuscules, sans
 * ponctuation. « Étanchéité » et « ETANCHEITE » deviennent le même mot.
 */
export function normaliserLibelle(texte: string | null | undefined): string {
  return (texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Deux métiers désignent-ils la même chose ?
 *
 * `null`, `undefined` et `""` sont un seul et même cas — « pas de métier » —
 * et la casse ne compte pas : `Plomberie` vaut `PLOMBERIE`.
 */
export function memeMetier(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return normaliserLibelle(a) === normaliserLibelle(b);
}

/** Le pluriel français le plus courant, pour que « SOLS » trouve « SOL ». */
function singulier(mot: string): string {
  return mot.length >= 4 && mot.endsWith("S") ? mot.slice(0, -1) : mot;
}

/**
 * Le référentiel des métiers proposés pour une société.
 *
 * La table `metiers` ne suffit pas : KTA n'y déclare que CARRELAGE, PEINTURE et
 * SOL, alors que ses bons portent aussi PLOMBERIE et ETANCHEITE — deux métiers
 * que la liste à cocher ne proposait plus, donc impossibles à recocher.
 *
 * L'orthographe retenue est la première rencontrée : passer les métiers
 * déclarés d'abord fait gagner celle du référentiel.
 */
export function referentielMetiers(
  declares: (string | null | undefined)[],
  employes: (string | null | undefined)[] = []
): string[] {
  const retenus = new Map<string, string>();
  for (const brut of [...declares, ...employes]) {
    const nom = (brut ?? "").trim();
    const cle = normaliserLibelle(nom);
    if (!cle || retenus.has(cle)) continue;
    retenus.set(cle, nom);
  }
  return [...retenus.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Distance d'édition, abandonnée dès qu'elle dépasse le plafond. */
function distanceEdition(a: string, b: string, plafond: number): number {
  if (Math.abs(a.length - b.length) > plafond) return plafond + 1;

  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const courante = [i];
    let minimumDeLaLigne = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(
        courante[j - 1] + 1,
        precedente[j] + 1,
        precedente[j - 1] + cout
      );
      if (courante[j] < minimumDeLaLigne) minimumDeLaLigne = courante[j];
    }
    if (minimumDeLaLigne > plafond) return plafond + 1;
    precedente = courante;
  }
  return precedente[b.length];
}

/** Le titre contient-il ce métier en mots entiers, dans l'ordre ? */
function contient(motsDuTitre: string[], motsDuMetier: string[]): boolean {
  if (!motsDuMetier.length || motsDuMetier.length > motsDuTitre.length) return false;
  for (let debut = 0; debut + motsDuMetier.length <= motsDuTitre.length; debut++) {
    let tous = true;
    for (let k = 0; k < motsDuMetier.length; k++) {
      if (singulier(motsDuTitre[debut + k]) !== singulier(motsDuMetier[k])) {
        tous = false;
        break;
      }
    }
    if (tous) return true;
  }
  return false;
}

/**
 * Le métier que désigne un titre de chapitre, s'il en désigne un.
 *
 * En cascade, du plus sûr au plus permissif ; on s'arrête au premier étage qui
 * répond. Deux candidats à égalité valent `null` : un chapitre ambigu ne vaut
 * pas mieux qu'un chapitre muet.
 *
 * La correspondance se fait sur des **mots entiers** et non sur des
 * sous-chaînes. C'est indispensable : « SOL » est court, et une recherche par
 * sous-chaîne le trouverait dans « SOLDE » comme dans « ISOLATION ».
 */
export function metierDuChapitre(
  titre: string | null | undefined,
  connus: (string | null | undefined)[]
): MetierReconnu | null {
  const titreNormalise = normaliserLibelle(titre);
  if (!titreNormalise) return null;

  const candidats = connus
    .map((m) => ({ nom: (m ?? "").trim(), normalise: normaliserLibelle(m) }))
    .filter((c) => c.normalise);
  if (!candidats.length) return null;

  const chapitre = (titre ?? "").trim();
  const motsDuTitre = titreNormalise.split(" ");

  const exacts = candidats.filter((c) => c.normalise === titreNormalise);
  if (exacts.length === 1) {
    return { metier: exacts[0].nom, certitude: "exact", chapitre };
  }
  if (exacts.length > 1) return null;

  const contenus = candidats.filter((c) => contient(motsDuTitre, c.normalise.split(" ")));
  if (contenus.length === 1) {
    return { metier: contenus[0].nom, certitude: "contenu", chapitre };
  }
  if (contenus.length > 1) return null;

  /* Dernier recours : une faute de frappe. On ne compare que des mots assez
     longs pour que deux caractères d'écart restent significatifs, et on exige
     un gagnant unique. */
  const approchants = candidats.filter((c) => {
    if (c.normalise.length < LONGUEUR_MIN_APPROCHANTE) return false;
    return motsDuTitre.some(
      (mot) =>
        mot.length >= LONGUEUR_MIN_APPROCHANTE &&
        distanceEdition(mot, c.normalise, DISTANCE_MAX) <= DISTANCE_MAX
    );
  });
  if (approchants.length === 1) {
    return { metier: approchants[0].nom, certitude: "approchant", chapitre };
  }

  return null;
}

/**
 * Les métiers que portent les chapitres d'un document.
 *
 * Seules les lignes de type `chapitre` sont lues : une désignation de ligne
 * (« Remplacement siphon ») suggérerait un métier bien plus souvent qu'elle ne
 * le désignerait, et une déduction fausse coûte plus cher qu'une case à cocher.
 */
export function metiersDesChapitres(
  lignes: LigneChapitrable[] | null | undefined,
  connus: (string | null | undefined)[]
): MetiersLus {
  const metiers: string[] = [];
  const origines: Record<string, string> = {};
  const ignores: string[] = [];

  for (const ligne of lignes ?? []) {
    if ((ligne.type ?? "ligne") !== "chapitre") continue;

    const titre = (ligne.designation ?? "").trim();
    if (!titre) continue;

    const trouve = metierDuChapitre(titre, connus);
    if (!trouve) {
      ignores.push(titre);
      continue;
    }
    if (metiers.some((m) => memeMetier(m, trouve.metier))) continue;

    metiers.push(trouve.metier);
    origines[trouve.metier] = titre;
  }

  return { metiers, origines, ignores };
}
