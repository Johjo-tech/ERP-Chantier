/**
 * Un CSV CONFORME (RFC 4180) — port de `lireCsv`, src/api/regles-csv.ts.
 *
 * Deux conventions coexistent dans les imports et les confondre casse l'un
 * ou l'autre : l'export d'articles porte des guillemets NON échappés
 * (`Tube 1/2"`) et se découpe sur `;` seul (articles/domain/import.ts) ; les
 * exports de clients et de factures sont de vrais CSV, dont un champ écrit par
 * un humain peut contenir un `;` ou un retour à la ligne entre guillemets.
 */
export interface LigneCsv {
  /** Ligne du FICHIER où l'enregistrement commence (1 = la première). */
  numero: number;
  champs: string[];
}

/**
 * Rend le numéro de ligne du fichier, pas l'index de l'enregistrement : un
 * champ multiligne les désaccorde, et un rejet désignerait la mauvaise ligne
 * dans le tableur de l'utilisateur.
 */
export function lireCsv(texte: string, separateur = ";"): LigneCsv[] {
  const lignes: LigneCsv[] = [];
  let champs: string[] = [];
  let courant = "";
  let dansGuillemets = false;
  let numero = 1;
  let debutDeLigne = 1;
  let commence = false;

  const finDeChamp = () => {
    champs.push(courant);
    courant = "";
  };
  const finDeLigne = () => {
    finDeChamp();
    lignes.push({ numero: debutDeLigne, champs });
    champs = [];
    commence = false;
  };

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (!commence) {
      debutDeLigne = numero;
      commence = true;
    }
    if (dansGuillemets) {
      if (c === '"') {
        // Un guillemet doublé dans un champ cité vaut un guillemet.
        if (texte[i + 1] === '"') {
          courant += '"';
          i++;
        } else dansGuillemets = false;
      } else {
        if (c === "\n") numero++;
        courant += c;
      }
      continue;
    }
    if (c === '"' && courant === "") dansGuillemets = true;
    else if (c === separateur) finDeChamp();
    else if (c === "\r") {
      // CRLF ou CR seul : un seul saut.
      if (texte[i + 1] === "\n") i++;
      numero++;
      finDeLigne();
    } else if (c === "\n") {
      numero++;
      finDeLigne();
    } else courant += c;
  }
  // Une dernière ligne sans saut final reste une ligne.
  if (commence || courant !== "" || champs.length) finDeLigne();
  return lignes;
}
