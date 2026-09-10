/**
 * Découper une adresse française en ses trois champs.
 *
 * La facture électronique veut la voie, le code postal et la commune séparés
 * (BT-50, BT-52, BT-53). L'application les saisit ainsi depuis longtemps, mais
 * les clients repris de l'ancien `kv_store` portent tout dans un seul champ :
 * « 21 AVENUE DE CONSTANTINE 38100 GRENOBLE ». Deux sur sept aujourd'hui.
 *
 * La règle est volontairement conservatrice : sans code postal reconnaissable,
 * on ne découpe rien. Inventer une commune serait pire que de laisser le champ
 * vide — une adresse fausse part sur une facture, une adresse incomplète se
 * voit et se corrige.
 *
 * Module feuille : il n'importe rien, ce qui permet de l'utiliser aussi bien à
 * l'émission qu'à la reprise des données.
 */

export interface AdresseDecoupee {
  rue: string | null;
  codePostal: string | null;
  ville: string | null;
}

/**
 * Un code postal français : cinq chiffres.
 *
 * Il ne peut pas ouvrir l'adresse — ce serait un numéro de voie — ni la
 * fermer : après lui vient toujours la commune. Ces deux conditions écartent
 * l'essentiel des faux positifs, « 12345 » dans un nom de résidence compris.
 */
const CODE_POSTAL = /(?:^|[\s,])(\d{5})(?:[\s,]+)(?=\S)/;

/** Espaces multiples, retours à la ligne et ponctuation de fin. */
function normaliser(valeur: string): string {
  return valeur.replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
}

/**
 * Découpe une adresse tenant sur une ligne.
 *
 * Rend les trois champs à `null` plutôt que de deviner quand le code postal est
 * absent : c'est ce qui permet à l'appelant de garder ce qu'il avait.
 */
export function decouperAdresse(brut: string | null | undefined): AdresseDecoupee {
  const texte = normaliser(String(brut ?? ""));
  if (!texte) return { rue: null, codePostal: null, ville: null };

  const trouve = texte.match(CODE_POSTAL);
  if (!trouve || trouve.index === undefined) {
    // Pas de code postal : l'adresse entière est une voie, et c'est tout ce
    // qu'on peut en dire honnêtement.
    return { rue: texte, codePostal: null, ville: null };
  }

  const codePostal = trouve[1];
  const rue = normaliser(texte.slice(0, trouve.index));
  const ville = normaliser(texte.slice(trouve.index + trouve[0].length));

  // Un code postal en tête sans rue devant : on ne sait pas ce qu'on lit.
  if (!rue || !ville) return { rue: texte, codePostal: null, ville: null };

  return { rue, codePostal, ville };
}

/**
 * Complète une adresse déjà partiellement saisie.
 *
 * Ce qui est renseigné fait foi : on ne remplace jamais une commune saisie par
 * une commune devinée. Le découpage ne sert qu'à combler les vides.
 */
export function completerAdresse(entite: {
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
}): AdresseDecoupee {
  const cpSaisi = (entite.codePostal ?? "").trim();
  const villeSaisie = (entite.ville ?? "").trim();
  if (cpSaisi && villeSaisie) {
    return {
      rue: (entite.adresse ?? "").trim() || null,
      codePostal: cpSaisi,
      ville: villeSaisie,
    };
  }

  const decoupee = decouperAdresse(entite.adresse);
  return {
    rue: decoupee.rue,
    codePostal: cpSaisi || decoupee.codePostal,
    ville: villeSaisie || decoupee.ville,
  };
}
