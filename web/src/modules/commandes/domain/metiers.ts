import { arrondiCentimes, montant, ZERO, type Montant } from "@/lib/money";
import { montantLigneHt } from "@/modules/documents/domain/totaux";

/**
 * Le métier d'un bon de commande, lu sur ses chapitres (port de
 * `src/api/regles-metiers.ts`, parité : tests/parite/metiers.essai.ts).
 *
 * Le `metier` d'une ligne de chapitre a TROIS états : `null` (il se lit sur le
 * titre — le défaut des 830 bons de production), un nom, ou la sentinelle
 * `METIER_AUCUN` pour un refus délibéré. Jamais `""` : l'ancienne comparaison
 * des lignes confond `null` et la chaîne vide, et le refus ne s'enregistrerait
 * pas (CLAUDE.md, BC-53). La précédence « choisi l'emporte sur le titre » vit
 * dans `metierDeLaLigne`, que l'écran du bon ET la pré-facture lisent.
 */
export const METIER_AUCUN = "(aucun)";

/** Fautes de frappe tolérées : « PLOMBEIRE » est à 2 de « PLOMBERIE ». */
const DISTANCE_MAX = 2;
/** En deçà, deux lettres d'écart rapprocheraient « SOL » de « SEL » ou « VOL ». */
const LONGUEUR_MIN_APPROCHANTE = 6;

export type CertitudeMetier = "choisi" | "exact" | "contenu" | "approchant";

export interface MetierReconnu {
  metier: string;
  certitude: CertitudeMetier;
  chapitre: string;
}

export interface LigneChapitrable {
  type?: string | null;
  designation?: string | null;
  metier?: string | null;
}

export function normaliserLibelle(texte: string | null | undefined): string {
  return (texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** `null`, `undefined` et `""` sont un seul cas — « pas de métier » — et la casse ne compte pas. */
export function memeMetier(a: string | null | undefined, b: string | null | undefined): boolean {
  return normaliserLibelle(a) === normaliserLibelle(b);
}

const singulier = (mot: string) => (mot.length >= 4 && mot.endsWith("S") ? mot.slice(0, -1) : mot);

/**
 * Les métiers proposés : déclarés d'abord (leur orthographe gagne), puis ceux
 * qu'emploient déjà les bons — sans quoi un métier retiré des réglages ne se
 * recocherait plus (BC-54).
 */
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
    let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((courante[j - 1] ?? 0) + 1, (precedente[j] ?? 0) + 1, (precedente[j - 1] ?? 0) + cout);
      courante[j] = v;
      if (v < minimum) minimum = v;
    }
    if (minimum > plafond) return plafond + 1;
    precedente = courante;
  }
  return precedente[b.length] ?? plafond + 1;
}

/** Le titre contient-il ce métier en MOTS ENTIERS : « SOL » n'est ni dans « SOLDE » ni dans « ISOLATION ». */
function contient(motsDuTitre: readonly string[], motsDuMetier: readonly string[]): boolean {
  if (!motsDuMetier.length || motsDuMetier.length > motsDuTitre.length) return false;
  for (let debut = 0; debut + motsDuMetier.length <= motsDuTitre.length; debut++) {
    if (motsDuMetier.every((m, k) => singulier(motsDuTitre[debut + k] ?? "") === singulier(m))) return true;
  }
  return false;
}

/** Le métier que désigne un titre, du plus sûr au plus permissif ; deux candidats à égalité valent `null`. */
export function metierDuChapitre(titre: string | null | undefined, connus: readonly (string | null | undefined)[]): MetierReconnu | null {
  const titreNormalise = normaliserLibelle(titre);
  if (!titreNormalise) return null;
  const candidats = connus.map((m) => ({ nom: (m ?? "").trim(), normalise: normaliserLibelle(m) })).filter((c) => c.normalise);
  if (!candidats.length) return null;
  const chapitre = (titre ?? "").trim();
  const motsDuTitre = titreNormalise.split(" ");

  const unique = (liste: typeof candidats, certitude: CertitudeMetier): MetierReconnu | null | undefined => {
    if (liste.length > 1) return null;
    const [seul] = liste;
    return seul ? { metier: seul.nom, certitude, chapitre } : undefined;
  };

  const exact = unique(candidats.filter((c) => c.normalise === titreNormalise), "exact");
  if (exact !== undefined) return exact;
  const contenu = unique(candidats.filter((c) => contient(motsDuTitre, c.normalise.split(" "))), "contenu");
  if (contenu !== undefined) return contenu;
  const approchants = candidats.filter(
    (c) => c.normalise.length >= LONGUEUR_MIN_APPROCHANTE && motsDuTitre.some((mot) => mot.length >= LONGUEUR_MIN_APPROCHANTE && distanceEdition(mot, c.normalise, DISTANCE_MAX) <= DISTANCE_MAX)
  );
  const [seul] = approchants;
  return approchants.length === 1 && seul ? { metier: seul.nom, certitude: "approchant", chapitre } : null;
}

/** Choisi > exact > contenu en mots entiers > approchant (BC-53). Un choix est honoré même hors référentiel. */
export function metierDeLaLigne(ligne: LigneChapitrable, connus: readonly (string | null | undefined)[]): MetierReconnu | null {
  const chapitre = (ligne.designation ?? "").trim();
  const choisi = (ligne.metier ?? "").trim();
  if (!choisi) return metierDuChapitre(chapitre, connus);
  if (memeMetier(choisi, METIER_AUCUN)) return null;
  return { metier: choisi, certitude: "choisi", chapitre };
}

export interface MetierAffiche {
  /** Un métier, `METIER_AUCUN`, ou `""` si le titre est muet. */
  valeur: string;
  devine: boolean;
  certitude: CertitudeMetier | null;
}

/** Ce que montre la liste d'un chapitre : « rien de reconnu » invite à choisir, « aucun » est un refus qui doit rester visible. */
export function metierAffiche(ligne: LigneChapitrable, connus: readonly (string | null | undefined)[]): MetierAffiche {
  const choisi = (ligne.metier ?? "").trim();
  if (choisi) {
    const refus = memeMetier(choisi, METIER_AUCUN);
    return { valeur: refus ? METIER_AUCUN : choisi, devine: false, certitude: refus ? null : "choisi" };
  }
  const lu = metierDuChapitre(ligne.designation, connus);
  return { valeur: lu?.metier ?? "", devine: true, certitude: lu?.certitude ?? null };
}

/**
 * Ce que la liste d'un chapitre écrit : « Déduit du titre » redevient `null`,
 * jamais `""` (BC-72) — sinon le refus et l'absence se confondraient.
 */
export function metierChoisi(valeur: string): string | null {
  return valeur.trim() === "" ? null : valeur.trim();
}

export interface MetiersLus {
  metiers: string[];
  origines: Record<string, string>;
  ignores: string[];
}

/** Les métiers que livrent les chapitres, dans l'ordre, sans doublon. Seuls les chapitres sont lus. */
export function metiersDesChapitres(lignes: readonly LigneChapitrable[] | null | undefined, connus: readonly (string | null | undefined)[]): MetiersLus {
  const metiers: string[] = [];
  const origines: Record<string, string> = {};
  const ignores: string[] = [];
  for (const ligne of lignes ?? []) {
    if ((ligne.type ?? "ligne") !== "chapitre") continue;
    const titre = (ligne.designation ?? "").trim();
    const trouve = metierDeLaLigne(ligne, connus);
    if (!trouve) {
      if (titre) ignores.push(titre);
      continue;
    }
    if (metiers.some((m) => memeMetier(m, trouve.metier))) continue;
    metiers.push(trouve.metier);
    if (titre) origines[trouve.metier] = titre;
  }
  return { metiers, origines, ignores };
}

/**
 * Les métiers du bon en saisie : ceux qu'il déclare, plus ceux que ses
 * chapitres livrent. La déduction ajoute, ne retire jamais (metiersDuBrouillon).
 */
export function metiersRetenus(declares: readonly string[], lignes: readonly LigneChapitrable[], connus: readonly string[]): { retenus: string[]; origines: Record<string, string>; ajoutes: number } {
  const lu = metiersDesChapitres(lignes, connus);
  const retenus = [...declares];
  for (const m of lu.metiers) if (!retenus.some((c) => memeMetier(c, m))) retenus.push(m);
  return { retenus, origines: lu.origines, ajoutes: retenus.length - declares.length };
}

/** Les métiers d'un bon lu en base : la liste jsonb, sinon l'ancien champ unique (bcMetiersDuBC). */
export function metiersDuBon(b: { metiers?: unknown; metier?: string | null }): string[] {
  const liste = Array.isArray(b.metiers) ? b.metiers.filter((m): m is string => typeof m === "string" && m.trim() !== "") : [];
  return liste.length ? liste : [b.metier ?? ""].filter((m) => m.trim() !== "");
}

export interface MontantDunMetier {
  metier: string | null;
  montantHt: Montant;
  nbLignes: number;
}

export interface LigneTravail extends LigneChapitrable {
  quantite?: number | string | null;
  prix_unitaire?: number | string | null;
}

/**
 * Ce que chaque métier pèse dans un document (BC-55). Comme l'ancien, arrondi
 * au centime À CHAQUE AJOUT : c'est ainsi que les sous-totaux par métier de la
 * pré-facture ont toujours été affichés.
 */
export function montantsParMetier(lignes: readonly LigneTravail[] | null | undefined, connus: readonly (string | null | undefined)[]): MontantDunMetier[] {
  const groupes: MontantDunMetier[] = [];
  const groupe = (metier: string | null) => {
    const existant = metier ? groupes.find((g) => g.metier !== null && memeMetier(g.metier, metier)) : groupes.find((g) => g.metier === null);
    if (existant) return existant;
    const neuf: MontantDunMetier = { metier, montantHt: ZERO, nbLignes: 0 };
    groupes.push(neuf);
    return neuf;
  };
  let metierCourant: string | null = null;
  for (const ligne of lignes ?? []) {
    const type = (ligne.type ?? "ligne").trim() || "ligne";
    if (type === "chapitre") {
      metierCourant = metierDeLaLigne(ligne, connus)?.metier ?? null;
      continue;
    }
    if (type === "commentaire") continue;
    const cible = groupe(metierCourant);
    cible.montantHt = arrondiCentimes(cible.montantHt.plus(montantLigneHt({ type: "ligne", quantite: ligne.quantite, prix_unitaire: ligne.prix_unitaire })));
    cible.nbLignes += 1;
  }
  return groupes;
}

/**
 * Les totaux des chapitres d'un devis, par titre (devisChapterTotals, app.js
 * l. 2820) : de quoi préremplir le montant d'un métier depuis le devis lié.
 */
export function totauxDesChapitres(lignes: readonly LigneTravail[]): Map<string, Montant> {
  const totaux = new Map<string, Montant>();
  let courant: string | null = null;
  for (const l of lignes) {
    if (l.type === "chapitre") {
      courant = (l.designation ?? "").trim();
      if (courant && !totaux.has(courant)) totaux.set(courant, ZERO);
    } else if (courant) {
      totaux.set(courant, (totaux.get(courant) ?? ZERO).plus(montant(l.quantite).times(montant(l.prix_unitaire))));
    }
  }
  return totaux;
}

/**
 * Le montant d'un métier lu dans le devis lié (refreshBCMontantFields) : le
 * chapitre qui le désigne, en mots entiers. `null` → « aucun chapitre … montant
 * à saisir manuellement » (BC-11).
 */
export function montantDuMetierDansLeDevis(metier: string, totaux: ReadonlyMap<string, Montant>): Montant | null {
  for (const [chapitre, total] of totaux) if (metierDuChapitre(chapitre, [metier])) return total;
  return null;
}
