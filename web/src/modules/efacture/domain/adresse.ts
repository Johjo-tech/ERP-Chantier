/**
 * Découper une adresse française en voie, code postal, commune (BT-50, BT-52,
 * BT-53) — port de src/api/regles-adresse.ts.
 *
 * Les clients repris de l'ancien magasin portent tout sur une ligne
 * (« 21 AVENUE DE CONSTANTINE 38100 GRENOBLE »). La règle est conservatrice :
 * sans code postal reconnaissable, on ne découpe rien — une adresse fausse part
 * sur une facture, une adresse incomplète se voit et se corrige.
 */
export interface AdresseDecoupee {
  rue: string | null;
  codePostal: string | null;
  ville: string | null;
}

/** Cinq chiffres, ni en tête (ce serait un numéro de voie) ni en fin (la commune suit toujours). */
const CODE_POSTAL = /(?:^|[\s,])(\d{5})(?:[\s,]+)(?=\S)/;

function normaliser(valeur: string): string {
  return valeur.replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
}

export function decouperAdresse(brut: string | null | undefined): AdresseDecoupee {
  const texte = normaliser(String(brut ?? ""));
  if (!texte) return { rue: null, codePostal: null, ville: null };
  const trouve = texte.match(CODE_POSTAL);
  if (!trouve || trouve.index === undefined) return { rue: texte, codePostal: null, ville: null };
  const codePostal = trouve[1] ?? null;
  const rue = normaliser(texte.slice(0, trouve.index));
  const ville = normaliser(texte.slice(trouve.index + trouve[0].length));
  if (!rue || !ville) return { rue: texte, codePostal: null, ville: null };
  return { rue, codePostal, ville };
}

/** Ce qui est saisi fait foi ; le découpage ne comble que les vides. */
export function completerAdresse(entite: { adresse?: string | null; codePostal?: string | null; ville?: string | null }): AdresseDecoupee {
  const cpSaisi = (entite.codePostal ?? "").trim();
  const villeSaisie = (entite.ville ?? "").trim();
  if (cpSaisi && villeSaisie) return { rue: (entite.adresse ?? "").trim() || null, codePostal: cpSaisi, ville: villeSaisie };
  const decoupee = decouperAdresse(entite.adresse);
  return { rue: decoupee.rue, codePostal: cpSaisi || decoupee.codePostal, ville: villeSaisie || decoupee.ville };
}
