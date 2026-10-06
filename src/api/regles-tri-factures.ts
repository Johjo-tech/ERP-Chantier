/**
 * L'ordre dans lequel la liste des factures se lit.
 *
 * La liste suivait l'ordre de chargement — la date du document, puis la date
 * de saisie. Or c'est par son NUMÉRO qu'on cherche une facture : celui que le
 * client cite au téléphone, celui que le comptable pointe dans le grand livre.
 * Deux factures du même jour s'affichaient dans l'ordre où on les avait
 * saisies, pas dans celui de leur numérotation.
 *
 * Module feuille — il n'importe rien. Les clés et leurs libellés vivent
 * ensemble ici : l'écran les lit, il ne les recopie pas.
 */

export type TriFactures =
  | "numero_desc"
  | "numero_asc"
  | "date_desc"
  | "date_asc"
  | "client"
  | "montant_desc";

export const TRI_FACTURES_DEFAUT: TriFactures = "numero_desc";

/** Dans l'ordre où la liste déroulante les propose. */
export const TRIS_FACTURES: readonly (readonly [TriFactures, string])[] = [
  ["numero_desc", "N° de facture : récent → ancien"],
  ["numero_asc", "N° de facture : ancien → récent"],
  ["date_desc", "Date d'émission : récente → ancienne"],
  ["date_asc", "Date d'émission : ancienne → récente"],
  ["client", "Client (A → Z)"],
  ["montant_desc", "Montant HT décroissant"],
];

/** Une facture, vue d'ici. */
export interface FactureTriable {
  numero?: string | null;
  date?: string | null;
  client?: string | null;
  createdAt?: string | null;
}

/* `numeric` compare « FAC-000099 » et « FAC-000100 » en nombres et non en
   texte. Sans lui, un numéro qui gagnerait un chiffre passerait avant ses
   prédécesseurs. */
const COLLATEUR = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

/**
 * Le numéro réduit à ses lettres et ses chiffres.
 *
 * L'historique importé s'écrit `FAC000121`, la série native `FAC-000122` : le
 * tiret, que la collation range avant les chiffres, plaçait sinon toute la
 * série native avant l'historique, quels que soient les numéros.
 */
function cleNumero(numero: unknown): string {
  return String(numero ?? "").replace(/[^\p{L}\p{N}]/gu, "");
}

function texte(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Un brouillon n'a pas encore de numéro : il recevra le prochain de la série.
 * Il se range donc APRÈS le dernier numéro attribué — en tête du tri récent →
 * ancien, là où l'attend le geste « Émettre », et en fin de l'autre.
 */
function parNumero(a: FactureTriable, b: FactureTriable): number {
  const na = cleNumero(a.numero);
  const nb = cleNumero(b.numero);
  if (!na || !nb) return (na ? 0 : 1) - (nb ? 0 : 1);
  return COLLATEUR.compare(na, nb);
}

/* Les dates sont des chaînes `AAAA-MM-JJ` : elles se comparent comme du texte,
   et le fuseau horaire reste hors du problème. */
function parDate(a: FactureTriable, b: FactureTriable): number {
  return texte(a.date).localeCompare(texte(b.date));
}

function parSaisie(a: FactureTriable, b: FactureTriable): number {
  return texte(a.createdAt).localeCompare(texte(b.createdAt));
}

/**
 * Une facture sans date ou sans client est une anomalie, pas une pièce plus
 * ancienne ou plus récente que les autres : elle passe en dernier dans les
 * deux sens, plutôt que de remonter en tête et de masquer les vraies.
 */
function videEnDernier(va: string, vb: string): number {
  return (va ? 0 : 1) - (vb ? 0 : 1);
}

/**
 * Trie une copie de la liste ; l'original n'est pas touché.
 *
 * Un tri inconnu ou vide vaut le tri par défaut : l'état de l'écran part d'une
 * chaîne vide, et une clé périmée ne doit pas laisser la liste en vrac.
 *
 * `montantDe` est fourni par l'écran : le montant affiché dépend de la remise
 * et du signe de l'avoir, que ce module n'a pas à refaire. Il n'est appelé
 * qu'une fois par facture, et seulement pour le tri par montant.
 */
export function trierFactures<T extends FactureTriable>(
  liste: readonly T[],
  tri?: string | null,
  montantDe: (facture: T) => number = () => 0
): T[] {
  const cle = TRIS_FACTURES.some(([k]) => k === tri) ? (tri as TriFactures) : TRI_FACTURES_DEFAUT;
  const copie = [...(liste ?? [])];

  switch (cle) {
    case "numero_asc":
      return copie.sort((a, b) => parNumero(a, b) || parDate(a, b) || parSaisie(a, b));
    case "numero_desc":
      return copie.sort((a, b) => parNumero(b, a) || parDate(b, a) || parSaisie(b, a));
    case "date_asc":
      return copie.sort(
        (a, b) =>
          videEnDernier(texte(a.date), texte(b.date)) ||
          parDate(a, b) ||
          parNumero(a, b) ||
          parSaisie(a, b)
      );
    case "date_desc":
      return copie.sort(
        (a, b) =>
          videEnDernier(texte(a.date), texte(b.date)) ||
          parDate(b, a) ||
          parNumero(b, a) ||
          parSaisie(b, a)
      );
    case "client":
      // Chez un même client, la plus récente d'abord : c'est elle qu'on cherche
      return copie.sort(
        (a, b) =>
          videEnDernier(texte(a.client), texte(b.client)) ||
          COLLATEUR.compare(texte(a.client), texte(b.client)) ||
          parNumero(b, a) ||
          parSaisie(b, a)
      );
    case "montant_desc": {
      const montants = new Map(copie.map((f) => [f, Number(montantDe(f)) || 0]));
      return copie.sort(
        (a, b) => montants.get(b)! - montants.get(a)! || parNumero(b, a) || parSaisie(b, a)
      );
    }
  }
}
