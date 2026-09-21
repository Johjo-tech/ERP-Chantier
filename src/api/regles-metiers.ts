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
  /**
   * Le métier tranché sur ce chapitre. Absent ou `null` : il se lit sur le
   * titre. `METIER_AUCUN` : le chapitre n'en désigne aucun, délibérément.
   */
  metier?: string | null;
}

/** Une ligne de travaux, avec ce qu'il faut pour l'annoncer et la chiffrer. */
export interface LigneTravail extends LigneChapitrable {
  qte?: number | string | null;
  unite?: string | null;
  prixUnitaire?: number | string | null;
}

/** Comment le métier a été reconnu — l'écran le montre, l'utilisateur juge. */
export type CertitudeMetier = "choisi" | "exact" | "contenu" | "approchant";

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

/**
 * Ce chapitre ne désigne aucun métier, et c'est un choix — pas un oubli.
 *
 * La chaîne vide ne conviendrait pas : `enfantsIdentiques` compare les lignes
 * sur `String(v ?? "")`, où `null` et `""` sont le même texte. Un refus écrit
 * `""` sur un chapitre dont la base porte `NULL` ne s'enregistrerait jamais.
 */
export const METIER_AUCUN = "(aucun)";

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
 * Le métier d'un chapitre : celui qu'on a choisi, sinon celui que dit le titre.
 *
 * C'est le point d'entrée unique, et il vit ici plutôt que dans l'écran parce
 * que trois lecteurs dérivent des mêmes lignes — les cases du bon, les cartes
 * du planning, les tâches à créer. Une précédence posée dans le rendu HTML les
 * ferait diverger, et c'est très exactement la divergence qui a rendu une tâche
 * définitivement invalidable sur BC-2026-0866.
 *
 * Un choix est honoré même s'il ne figure plus au référentiel : c'est la parole
 * de l'utilisateur, et `referentielMetiers` enseigne déjà qu'un métier employé
 * compte autant qu'un métier déclaré. Un métier retiré des Réglages ne doit pas
 * disparaître d'un vieux document.
 */
export function metierDeLaLigne(
  ligne: LigneChapitrable,
  connus: (string | null | undefined)[]
): MetierReconnu | null {
  const chapitre = (ligne.designation ?? "").trim();
  const choisi = (ligne.metier ?? "").trim();

  if (!choisi) return metierDuChapitre(chapitre, connus);
  if (memeMetier(choisi, METIER_AUCUN)) return null;

  return { metier: choisi, certitude: "choisi", chapitre };
}

/** Ce que la liste déroulante d'un chapitre affiche, et d'où ça vient. */
export interface MetierAffiche {
  /** La sélection : un métier, `METIER_AUCUN`, ou `""` si le titre est muet. */
  valeur: string;
  /** Vrai tant que personne n'a tranché : la valeur vient du titre. */
  devine: boolean;
  /** Comment elle a été obtenue ; `null` quand rien ne la désigne. */
  certitude: CertitudeMetier | null;
}

/**
 * Ce que montre la liste déroulante d'un chapitre.
 *
 * Séparé de `metierDeLaLigne` parce que l'écran a besoin d'une chose que le
 * domaine n'a pas à connaître : la différence entre « rien n'est reconnu » et
 * « on a refusé ». Les deux ne valent aucun métier, mais la première invite à
 * choisir et la seconde non — et `METIER_AUCUN` doit rester sélectionné dans
 * la liste, sans quoi le refus paraîtrait s'être effacé tout seul.
 */
export function metierAffiche(
  ligne: LigneChapitrable,
  connus: (string | null | undefined)[]
): MetierAffiche {
  const choisi = (ligne.metier ?? "").trim();

  if (choisi) {
    const refus = memeMetier(choisi, METIER_AUCUN);
    return {
      valeur: refus ? METIER_AUCUN : choisi,
      devine: false,
      certitude: refus ? null : "choisi",
    };
  }

  const lu = metierDuChapitre(ligne.designation, connus);
  return { valeur: lu?.metier ?? "", devine: true, certitude: lu?.certitude ?? null };
}

/** Une tâche déjà posée, réduite à ce qui la rend reconnaissable. */
export interface TachePosee {
  metier?: string | null;
  date_tache?: string | null;
}

export interface TacheACreer {
  date: string;
  metier: string | null;
}

/**
 * Les couples (jour, métier) qui n'ont pas encore de tâche.
 *
 * `datesSupplementaires` n'a pas de colonne : il est dérivé des tâches à la
 * lecture et écarté en silence à l'écriture. Se demander « cette date est-elle
 * nouvelle ? » en la comparant à un état jamais persisté rendait toujours oui,
 * et chaque enregistrement recréait une tâche par métier — quatre doublons du
 * même jour sur BC-2026-0866, tous invisibles à l'écran mais tous comptés par
 * `bc_passer_pret_a_chiffrer`, qui exige que toutes les tâches soient validées.
 *
 * Les tâches déjà posées sont la seule mesure qui survive au rechargement.
 */
export function tachesAcreer(
  posees: TachePosee[],
  dates: (string | null | undefined)[],
  metiers: (string | null | undefined)[]
): TacheACreer[] {
  const aCreer: TacheACreer[] = [];
  const dejaVues = posees.map((t) => ({
    date: t.date_tache ?? "",
    metier: normaliserLibelle(t.metier),
  }));

  for (const dateBrute of dates) {
    const date = (dateBrute ?? "").trim();
    if (!date) continue;

    for (const metierBrut of metiers) {
      const metier = (metierBrut ?? "").trim() || null;
      const cle = normaliserLibelle(metier);
      if (dejaVues.some((t) => t.date === date && t.metier === cle)) continue;

      // Mémorisé tout de suite : la même date listée deux fois n'en crée qu'une.
      dejaVues.push({ date, metier: cle });
      aCreer.push({ date, metier });
    }
  }

  return aCreer;
}

/**
 * Les métiers que portent les chapitres d'un document.
 *
 * Seules les lignes de type `chapitre` sont lues : une désignation de ligne
 * (« Remplacement siphon ») suggérerait un métier bien plus souvent qu'elle ne
 * le désignerait, et une déduction fausse coûte plus cher qu'une case à cocher.
 *
 * Le métier tranché sur un chapitre l'emporte sur son titre — voir
 * `metierDeLaLigne`. Retaper le titre ne défait donc pas un choix.
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

    /* Pas de garde sur le titre : un chapitre qu'on vient de créer n'en a pas
       encore, et le métier qu'on y choisit doit compter tout de suite. Sans
       cela, cocher PLOMBERIE sur un chapitre vierge ne ferait rien paraître,
       et on le cocherait une seconde fois à la main. */
    const titre = (ligne.designation ?? "").trim();
    const trouve = metierDeLaLigne(ligne, connus);
    if (!trouve) {
      if (titre) ignores.push(titre);
      continue;
    }
    if (metiers.some((m) => memeMetier(m, trouve.metier))) continue;

    metiers.push(trouve.metier);
    // Sans titre, il n'y a pas d'origine à montrer : le métier a été choisi.
    if (titre) origines[trouve.metier] = titre;
  }

  return { metiers, origines, ignores };
}

/** Les travaux d'un chapitre, tels qu'ils s'affichent sous son titre. */
export interface TravauxDunChapitre {
  /** Le titre lu sur le bon — « PEINTURE CHAMBRE 1 » — ou null hors chapitre. */
  chapitre: string | null;
  lignes: LigneTravail[];
}

export interface TravauxDunMetier {
  /** `null` : des travaux que ni chapitre ni titre ne rattachent à un métier. */
  metier: string | null;
  chapitres: TravauxDunChapitre[];
  /** Toutes lignes confondues, dans l'ordre du bon. */
  lignes: LigneTravail[];
}

/**
 * Répartit les lignes d'un bon entre les métiers, par leur chapitre.
 *
 * Une tâche vaut bon × métier × jour, jamais bon × chapitre : cinq chapitres
 * « PEINTURE CHAMBRE 1 », « PEINTURE LOGEMENT COMPLET »… désignent un seul
 * métier, donc une seule venue de l'équipe. Leurs travaux se retrouvent donc
 * sur la même tâche — mais **groupés par chapitre**, sans quoi le technicien
 * perdrait la seule indication de pièce que porte le bon.
 *
 * Les lignes placées avant tout chapitre — 210 sur 230 bons lignés en
 * production, le cas courant et non l'exception — ne se rattachent à aucun
 * métier par elles-mêmes : les deviner sur leur désignation reviendrait à faire
 * ce que `metiersDesChapitres` refuse déjà de faire. Elles ressortent sous
 * `metier: null`, à charge de l'appelant de les montrer là où elles ne seront
 * pas perdues.
 *
 * Les commentaires suivent leur chapitre : ils qualifient les travaux voisins.
 */
export function travauxParMetier(
  lignes: LigneTravail[] | null | undefined,
  connus: (string | null | undefined)[]
): TravauxDunMetier[] {
  const parMetier: TravauxDunMetier[] = [];

  /* Deux clés distinctes : `null` (hors chapitre) n'est pas un métier et ne
     doit jamais fusionner avec un métier non reconnu d'un chapitre nommé. */
  const groupe = (metier: string | null): TravauxDunMetier => {
    const existant = metier
      ? parMetier.find((g) => g.metier !== null && memeMetier(g.metier, metier))
      : parMetier.find((g) => g.metier === null);
    if (existant) return existant;
    const neuf: TravauxDunMetier = { metier, chapitres: [], lignes: [] };
    parMetier.push(neuf);
    return neuf;
  };

  let metierCourant: string | null = null;
  let chapitreCourant: string | null = null;

  for (const ligne of lignes ?? []) {
    const type = (ligne.type ?? "ligne").trim() || "ligne";

    if (type === "chapitre") {
      const titre = (ligne.designation ?? "").trim();
      chapitreCourant = titre || null;
      // Un chapitre qu'aucun métier ne réclame structure quand même le bon.
      metierCourant = metierDeLaLigne(ligne, connus)?.metier ?? null;
      continue;
    }

    if (!(ligne.designation ?? "").trim()) continue;

    const cible = groupe(metierCourant);
    let bloc = cible.chapitres[cible.chapitres.length - 1];
    if (!bloc || bloc.chapitre !== chapitreCourant) {
      bloc = { chapitre: chapitreCourant, lignes: [] };
      cible.chapitres.push(bloc);
    }
    bloc.lignes.push(ligne);
    cible.lignes.push(ligne);
  }

  return parMetier;
}

/**
 * Les travaux à montrer sur la carte d'un métier.
 *
 * Les lignes hors chapitre appartiennent au bon entier, pas à un métier : les
 * répéter sur chaque carte les ferait compter plusieurs fois à l'œil, les
 * omettre les rendrait invisibles. Elles ne paraissent donc que sur la carte du
 * **premier** métier — même règle que les tâches orphelines, et pour la même
 * raison : un travail que personne ne voit ne se fait pas.
 */
export function travauxDeLaCarte(
  lignes: LigneTravail[] | null | undefined,
  connus: (string | null | undefined)[],
  metier: string | null | undefined,
  premierMetier: string | null | undefined
): TravauxDunChapitre[] {
  const groupes = travauxParMetier(lignes, connus);
  const sien = groupes.find((g) =>
    metier ? g.metier !== null && memeMetier(g.metier, metier) : g.metier === null
  );
  const blocs = sien ? [...sien.chapitres] : [];

  const surLaPremiere = premierMetier == null || memeMetier(metier, premierMetier);
  if (metier && surLaPremiere) {
    const orphelins = groupes.find((g) => g.metier === null);
    if (orphelins) blocs.push(...orphelins.chapitres);
  }

  return blocs;
}
