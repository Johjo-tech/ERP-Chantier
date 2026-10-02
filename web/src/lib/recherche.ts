import { enDecimal2, formatEuros, type Montant } from "./money";

/**
 * Recherche « à la manière de l'ancien écran » : insensible à la casse et aux
 * accents, et chaque mot saisi doit se trouver quelque part (multiWordMatch).
 */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const motsDe = (requete: string) => normaliser(requete).split(/\s+/).filter(Boolean);

export function correspond(requete: string, ...champs: (string | null | undefined)[]): boolean {
  const mots = motsDe(requete);
  if (mots.length === 0) return true;
  const botte = normaliser(champs.filter(Boolean).join(" "));
  return mots.every((m) => botte.includes(m));
}

/**
 * Un montant tel qu'on le tape pour le retrouver (`montantsCherchables`,
 * app.js l. 2151) : sous sa forme affichée « 1 234,50 € » et sous sa forme
 * décimale « 1234.50 ». Chercher « 1234.50 » ou « 234,50 » trouve le document.
 */
export function montantsCherchables(...montants: Montant[]): string[] {
  return montants.flatMap((m) => [formatEuros(m), enDecimal2(m)]);
}

/**
 * D'où vient la correspondance quand elle ne vient pas du document lui-même
 * (`origineDeLaCorrespondance`, `src/integrations/recherche.ts`) : un apport
 * n'est cité que s'il porte un mot de la requête ABSENT des champs propres.
 * Un locataire recopié du bon sur la facture n'est donc jamais annoncé comme
 * venu d'ailleurs.
 */
export function origineDeLaCorrespondance<A extends { valeur: string }>(requete: string, champsPropres: readonly (string | null | undefined)[], apports: readonly A[]): A[] {
  const mots = motsDe(requete);
  if (!mots.length || !apports.length) return [];
  const propre = normaliser(champsPropres.filter(Boolean).join(" "));
  const inedits = mots.filter((m) => !propre.includes(m));
  if (!inedits.length) return [];
  return apports.filter((a) => inedits.some((m) => normaliser(a.valeur).includes(m)));
}
