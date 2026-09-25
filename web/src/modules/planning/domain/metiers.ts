/**
 * Le métier d'un chapitre, et les travaux qu'une carte du planning montre.
 *
 * Port de `src/api/regles-metiers.ts` (parité : tests/parite/planning.essai.ts).
 * Le planning DOIT lire `metierDeLaLigne` (CLAUDE.md racine) : la précédence
 * « le métier choisi l'emporte sur le titre » est celle de l'écran du bon ; une
 * seconde règle ici ferait diverger la carte et le bon — c'est la divergence
 * qui avait rendu une tâche invalidable sur BC-2026-0866.
 */

export interface LigneChapitrable {
  type?: string | null;
  designation?: string | null;
  /** `null` : se lit sur le titre ; `METIER_AUCUN` : refus délibéré. */
  metier?: string | null;
}

export interface LigneTravail extends LigneChapitrable {
  qte?: number | string | null;
  unite?: string | null;
}

export type CertitudeMetier = "choisi" | "exact" | "contenu" | "approchant";

export interface MetierReconnu {
  metier: string;
  certitude: CertitudeMetier;
  chapitre: string;
}

/** Le refus délibéré. Jamais `""` : `null` et la chaîne vide se confondent à la comparaison des lignes. */
export const METIER_AUCUN = "(aucun)";
export const DISTANCE_MAX = 2;
/** En deçà, deux caractères d'écart rapprocheraient n'importe quoi (« SOL », « SEL », « VOL »). */
export const LONGUEUR_MIN_APPROCHANTE = 6;

export function normaliserLibelle(texte: string | null | undefined): string {
  return (texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** `null`, `undefined` et `""` sont le même cas ; ni la casse ni les accents ne comptent. */
export function memeMetier(a: string | null | undefined, b: string | null | undefined): boolean {
  return normaliserLibelle(a) === normaliserLibelle(b);
}

const singulier = (mot: string) => (mot.length >= 4 && mot.endsWith("S") ? mot.slice(0, -1) : mot);

/** Les métiers déclarés d'abord, puis les employés : l'orthographe du référentiel gagne. */
export function referentielMetiers(declares: readonly (string | null | undefined)[], employes: readonly (string | null | undefined)[] = []): string[] {
  const retenus = new Map<string, string>();
  for (const brut of [...declares, ...employes]) {
    const nom = (brut ?? "").trim();
    const cle = normaliserLibelle(nom);
    if (!cle || retenus.has(cle)) continue;
    retenus.set(cle, nom);
  }
  return [...retenus.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

function distanceEdition(a: string, b: string, plafond: number): number {
  if (Math.abs(a.length - b.length) > plafond) return plafond + 1;
  let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const courante = [i];
    let minimumDeLaLigne = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((courante[j - 1] ?? 0) + 1, (precedente[j] ?? 0) + 1, (precedente[j - 1] ?? 0) + cout);
      courante[j] = v;
      if (v < minimumDeLaLigne) minimumDeLaLigne = v;
    }
    if (minimumDeLaLigne > plafond) return plafond + 1;
    precedente = courante;
  }
  return precedente[b.length] ?? plafond + 1;
}

/** Mots entiers et non sous-chaînes : « SOL » ne doit se trouver ni dans « SOLDE » ni dans « ISOLATION ». */
function contient(motsDuTitre: string[], motsDuMetier: string[]): boolean {
  if (!motsDuMetier.length || motsDuMetier.length > motsDuTitre.length) return false;
  for (let debut = 0; debut + motsDuMetier.length <= motsDuTitre.length; debut++) {
    if (motsDuMetier.every((m, k) => singulier(motsDuTitre[debut + k] ?? "") === singulier(m))) return true;
  }
  return false;
}

/** Du plus sûr au plus permissif ; deux candidats à égalité valent `null`. */
export function metierDuChapitre(titre: string | null | undefined, connus: readonly (string | null | undefined)[]): MetierReconnu | null {
  const titreNormalise = normaliserLibelle(titre);
  if (!titreNormalise) return null;
  const candidats = connus.map((m) => ({ nom: (m ?? "").trim(), normalise: normaliserLibelle(m) })).filter((c) => c.normalise);
  if (!candidats.length) return null;
  const chapitre = (titre ?? "").trim();
  const motsDuTitre = titreNormalise.split(" ");

  const exacts = candidats.filter((c) => c.normalise === titreNormalise);
  if (exacts.length === 1 && exacts[0]) return { metier: exacts[0].nom, certitude: "exact", chapitre };
  if (exacts.length > 1) return null;

  const contenus = candidats.filter((c) => contient(motsDuTitre, c.normalise.split(" ")));
  if (contenus.length === 1 && contenus[0]) return { metier: contenus[0].nom, certitude: "contenu", chapitre };
  if (contenus.length > 1) return null;

  const approchants = candidats.filter(
    (c) =>
      c.normalise.length >= LONGUEUR_MIN_APPROCHANTE &&
      motsDuTitre.some((mot) => mot.length >= LONGUEUR_MIN_APPROCHANTE && distanceEdition(mot, c.normalise, DISTANCE_MAX) <= DISTANCE_MAX)
  );
  if (approchants.length === 1 && approchants[0]) return { metier: approchants[0].nom, certitude: "approchant", chapitre };
  return null;
}

/** Le point d'entrée unique : le métier choisi, sinon celui que dit le titre. */
export function metierDeLaLigne(ligne: LigneChapitrable, connus: readonly (string | null | undefined)[]): MetierReconnu | null {
  const chapitre = (ligne.designation ?? "").trim();
  const choisi = (ligne.metier ?? "").trim();
  if (!choisi) return metierDuChapitre(chapitre, connus);
  if (memeMetier(choisi, METIER_AUCUN)) return null;
  return { metier: choisi, certitude: "choisi", chapitre };
}

export interface TravauxDunChapitre {
  chapitre: string | null;
  lignes: LigneTravail[];
}

export interface TravauxDunMetier {
  metier: string | null;
  chapitres: TravauxDunChapitre[];
  lignes: LigneTravail[];
}

/**
 * Répartit les lignes d'un bon entre les métiers, par leur chapitre. Une tâche
 * vaut bon × métier × jour : les chapitres d'un même métier se retrouvent sur
 * la même carte, groupés, car leur titre est souvent la seule indication de pièce.
 */
export function travauxParMetier(lignes: readonly LigneTravail[] | null | undefined, connus: readonly (string | null | undefined)[]): TravauxDunMetier[] {
  const parMetier: TravauxDunMetier[] = [];
  const groupe = (metier: string | null): TravauxDunMetier => {
    const existant = metier ? parMetier.find((g) => g.metier !== null && memeMetier(g.metier, metier)) : parMetier.find((g) => g.metier === null);
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
      chapitreCourant = (ligne.designation ?? "").trim() || null;
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
 * Les travaux d'une carte. Les lignes hors chapitre appartiennent au bon
 * entier : elles ne paraissent que sur la carte du PREMIER métier — un travail
 * que personne ne voit ne se fait pas, un travail vu deux fois se compte deux fois.
 */
export function travauxDeLaCarte(
  lignes: readonly LigneTravail[] | null | undefined,
  connus: readonly (string | null | undefined)[],
  metier: string | null | undefined,
  premierMetier: string | null | undefined
): TravauxDunChapitre[] {
  const groupes = travauxParMetier(lignes, connus);
  const sien = groupes.find((g) => (metier ? g.metier !== null && memeMetier(g.metier, metier) : g.metier === null));
  const blocs = sien ? [...sien.chapitres] : [];
  const surLaPremiere = premierMetier == null || memeMetier(metier, premierMetier);
  if (metier && surLaPremiere) {
    const orphelins = groupes.find((g) => g.metier === null);
    if (orphelins) blocs.push(...orphelins.chapitres);
  }
  return blocs;
}

export interface TacheACreer {
  date: string;
  metier: string | null;
}

/** Les couples (jour, métier) sans tâche : les tâches posées sont la seule mesure qui survive au rechargement. */
export function tachesAcreer(
  posees: readonly { metier?: string | null; date_tache?: string | null }[],
  dates: readonly (string | null | undefined)[],
  metiers: readonly (string | null | undefined)[]
): TacheACreer[] {
  const aCreer: TacheACreer[] = [];
  const dejaVues = posees.map((t) => ({ date: t.date_tache ?? "", metier: normaliserLibelle(t.metier) }));
  for (const dateBrute of dates) {
    const date = (dateBrute ?? "").trim();
    if (!date) continue;
    for (const metierBrut of metiers) {
      const metier = (metierBrut ?? "").trim() || null;
      const cle = normaliserLibelle(metier);
      if (dejaVues.some((t) => t.date === date && t.metier === cle)) continue;
      dejaVues.push({ date, metier: cle });
      aCreer.push({ date, metier });
    }
  }
  return aCreer;
}
