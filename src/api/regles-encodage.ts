/**
 * De quel encodage est ce fichier ? On le CONSTATE, on ne le suppose pas.
 *
 * L'export d'articles du logiciel de gestion est en Windows-1252 ; l'export de
 * clients est en UTF-8 avec BOM. Deux imports, deux encodages — et un même
 * fichier ré-enregistré par un tableur change de camp sans prévenir.
 *
 * Supposer coûte cher et se voit tard : lu en UTF-8, un fichier 1252 donne
 * « RÃ©fection » ; lu en 1252, un fichier UTF-8 donne « RÃ©fection » aussi,
 * mais l'inverse. Dans les deux cas le catalogue part de travers et personne
 * ne sait pourquoi.
 *
 * Module feuille : ni base, ni DOM, ni `window`.
 */

export type Encodage = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" | "windows-1252";

export interface TexteDecode {
  texte: string;
  /** Ce qui a été constaté — destiné à être MONTRÉ, pas seulement utilisé. */
  encodage: Encodage;
}

/** Ce qu'on affiche à l'utilisateur. Il ne connaît pas « windows-1252 ». */
export function libelleEncodage(e: Encodage): string {
  switch (e) {
    case "utf-8":
      return "UTF-8";
    case "utf-8-bom":
      return "UTF-8 (avec BOM)";
    case "utf-16le":
    case "utf-16be":
      return "UTF-16 (Texte Unicode)";
    case "windows-1252":
      return "Windows-1252 (Europe occidentale)";
  }
}

function octets(donnees: ArrayBuffer | Uint8Array): Uint8Array {
  return donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees);
}

/**
 * Décode, et dit par quelle branche il est passé.
 *
 * Trois étapes, dans cet ordre :
 *
 * 1. **BOM UTF-8** (`EF BB BF`). `TextDecoder("utf-8")` le retire lui-même,
 *    mais on le repère sur les OCTETS pour pouvoir le nommer dans l'aperçu.
 * 2. **BOM UTF-16**. Un « Texte Unicode » enregistré depuis Excel arrive ainsi,
 *    et le lire en 1252 donnerait un octet nul entre chaque lettre — un
 *    en-tête introuvable, sans la moindre explication.
 * 3. **Sans BOM**, on tente l'UTF-8 en mode `fatal`. En Windows-1252 « é » vaut
 *    `0xE9`, un octet haut isolé que l'UTF-8 refuse : la levée est immédiate et
 *    fiable. Un fichier purement ASCII se décode identiquement des deux côtés,
 *    donc le choix ne change rien. Reste un cas ambigu — un fichier 1252 dont
 *    les octets accentués forment par hasard une séquence UTF-8 valide
 *    (`C3 A9` = « Ã© ») : c'est déjà du mojibake, et le lire en UTF-8 est la
 *    réponse la moins fausse.
 *
 * Le `catch` n'est pas muet : il ne masque pas une erreur, il CONSOMME le
 * verdict du décodeur, et la branche prise ressort dans `encodage`.
 */
export function decoderTexte(donnees: ArrayBuffer | Uint8Array): TexteDecode {
  const o = octets(donnees);

  if (o.length >= 3 && o[0] === 0xef && o[1] === 0xbb && o[2] === 0xbf) {
    return { texte: new TextDecoder("utf-8").decode(o), encodage: "utf-8-bom" };
  }
  if (o.length >= 2 && o[0] === 0xff && o[1] === 0xfe) {
    return { texte: new TextDecoder("utf-16le").decode(o), encodage: "utf-16le" };
  }
  if (o.length >= 2 && o[0] === 0xfe && o[1] === 0xff) {
    return { texte: new TextDecoder("utf-16be").decode(o), encodage: "utf-16be" };
  }

  try {
    return { texte: new TextDecoder("utf-8", { fatal: true }).decode(o), encodage: "utf-8" };
  } catch {
    /* Verdict consommé : ces octets ne sont pas de l'UTF-8. Windows-1252 accepte
       les 256 valeurs, il ne peut donc pas échouer à son tour. */
    return { texte: new TextDecoder("windows-1252").decode(o), encodage: "windows-1252" };
  }
}
