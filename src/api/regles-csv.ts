/**
 * Lecture d'un CSV conforme, et rapport des lignes écartées.
 *
 * ── POURQUOI DEUX DÉCOUPAGES DANS CE PROJET ────────────────────────────────
 * Les deux fichiers importés n'ont pas la même convention, et les confondre
 * casse l'un ou l'autre :
 *
 * - l'export d'ARTICLES du logiciel de gestion porte des guillemets **non
 *   échappés** dans ses libellés (`Tube 1/2"`). Un parseur conforme les prend
 *   pour des délimiteurs, avale le point-virgule suivant et décale toute la
 *   ligne. Il se découpe donc sur `;` seul — voir `regles-import-articles.ts`,
 *   qui garde sa propre fonction et ne doit PAS venir ici ;
 * - l'export de CLIENTS est un CSV véritable : son champ `Commentaire` est
 *   écrit par un humain (« ALERTE - ne pas confondre avec… ») et peut contenir
 *   un point-virgule, voire un retour à la ligne, entre guillemets.
 *
 * Ce module sert le second. Module feuille : ni base, ni DOM, ni `window`.
 */

/** Un enregistrement, et la ligne du FICHIER où il commence. */
export interface LigneCsv {
  /** 1 pour la première ligne du fichier. */
  numero: number;
  champs: string[];
}

/**
 * Découpe un CSV conforme (RFC 4180) : guillemets doublés, séparateur et
 * retour à la ligne admis dans un champ cité.
 *
 * Rend le numéro de ligne du FICHIER, et non l'index de l'enregistrement : un
 * champ multiligne les désaccorde, et un rejet désignerait alors la mauvaise
 * ligne dans le tableur de l'utilisateur — qui chercherait longtemps.
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
        // Un guillemet doublé à l'intérieur d'un champ cité vaut un guillemet.
        if (texte[i + 1] === '"') {
          courant += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        if (c === "\n") numero++;
        courant += c;
      }
      continue;
    }

    if (c === '"' && courant === "") {
      dansGuillemets = true;
    } else if (c === separateur) {
      finDeChamp();
    } else if (c === "\r") {
      // CRLF ou CR seul : le saut est porté par le `\n`, ou par ce `\r` isolé.
      if (texte[i + 1] === "\n") i++;
      numero++;
      finDeLigne();
    } else if (c === "\n") {
      numero++;
      finDeLigne();
    } else {
      courant += c;
    }
  }

  // Une dernière ligne sans saut final reste une ligne.
  if (commence || courant !== "" || champs.length) finDeLigne();

  return lignes;
}

/** Une ligne écartée, et pourquoi. Le numéro est celui du fichier. */
export interface RejetImport {
  ligne: number;
  motif: string;
  contenu: string;
}

/**
 * Une décision prise à la place du fichier.
 *
 * `code` est absent quand la décision porte sur le FICHIER et non sur une
 * ligne — une colonne manquante, un encodage constaté. Sans quoi le même
 * avertissement se répéterait sur chaque ligne et noierait les vrais cas.
 */
export interface SignalementImport {
  ligne: number;
  code?: string;
  motif: string;
}

/** Le rapport des rejets, en CSV, pour être relu dans un tableur. */
export function rapportRejetsCsv(rejets: RejetImport[]): string {
  const echapper = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    "Ligne;Motif;Contenu",
    ...rejets.map((r) => [r.ligne, echapper(r.motif), echapper(r.contenu)].join(";")),
  ].join("\r\n");
}
