/**
 * Lire et écrire une archive ZIP, sans bibliothèque (D-CHA-08).
 *
 * Un classeur .xlsx et un document .docx sont des archives ZIP de fichiers XML.
 * Le navigateur sait décompresser (`DecompressionStream("deflate-raw")`) ; il ne
 * reste qu'à parcourir le répertoire central. L'écriture se contente du mode
 * « stocké » (sans compression) : Word l'accepte, et un PPSPS pèse peu.
 * L'ancien écran chargeait SheetJS et docx depuis un CDN, et refusait de
 * travailler hors connexion.
 */

const SIG_FIN = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const STOCKE = 0;
const DEFLATE = 8;
const TAILLE_FIN_MIN = 22;

export class ArchiveIllisible extends Error {
  constructor(motif: string) {
    super(`Archive illisible : ${motif}`);
    this.name = "ArchiveIllisible";
  }
}

async function inflater(donnees: Uint8Array): Promise<Uint8Array> {
  const source = new Response(donnees as BodyInit).body;
  if (!source) throw new ArchiveIllisible("entrée vide.");
  return new Uint8Array(await new Response(source.pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
}

function finDuRepertoire(vue: DataView): number {
  for (let i = vue.byteLength - TAILLE_FIN_MIN; i >= 0; i--) if (vue.getUint32(i, true) === SIG_FIN) return i;
  throw new ArchiveIllisible("ce n'est pas un fichier ZIP (ni .xlsx, ni .docx).");
}

/** Toutes les entrées de l'archive, décompressées, par chemin. */
export async function lireZip(octets: Uint8Array): Promise<Map<string, Uint8Array>> {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const fin = finDuRepertoire(vue);
  const nombre = vue.getUint16(fin + 10, true);
  let p = vue.getUint32(fin + 16, true);
  const decodeur = new TextDecoder();
  const entrees = new Map<string, Uint8Array>();
  for (let n = 0; n < nombre; n++) {
    if (vue.getUint32(p, true) !== SIG_CENTRAL) throw new ArchiveIllisible("répertoire central abîmé.");
    const methode = vue.getUint16(p + 10, true);
    const tailleCompressee = vue.getUint32(p + 20, true);
    const longNom = vue.getUint16(p + 28, true);
    const longExtra = vue.getUint16(p + 30, true);
    const longCommentaire = vue.getUint16(p + 32, true);
    const local = vue.getUint32(p + 42, true);
    const nom = decodeur.decode(octets.subarray(p + 46, p + 46 + longNom));
    if (vue.getUint32(local, true) !== SIG_LOCAL) throw new ArchiveIllisible(`entrée « ${nom} » introuvable.`);
    const debut = local + 30 + vue.getUint16(local + 26, true) + vue.getUint16(local + 28, true);
    const brut = octets.subarray(debut, debut + tailleCompressee);
    if (methode === STOCKE) entrees.set(nom, brut);
    else if (methode === DEFLATE) entrees.set(nom, await inflater(brut));
    else throw new ArchiveIllisible(`compression ${methode} non prise en charge.`);
    p += 46 + longNom + longExtra + longCommentaire;
  }
  return entrees;
}

let tableCrc: Uint32Array | null = null;
export function crc32(octets: Uint8Array): number {
  if (!tableCrc) {
    tableCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tableCrc[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const o of octets) crc = (tableCrc[(crc ^ o) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Une archive « stockée » (sans compression) des fichiers donnés, dans l'ordre donné. */
export function ecrireZip(fichiers: readonly { chemin: string; contenu: Uint8Array }[]): Uint8Array {
  const encodeur = new TextEncoder();
  const morceaux: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = encodeur.encode(f.chemin);
    const crc = crc32(f.contenu);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, SIG_LOCAL, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint32(14, crc, true);
    local.setUint32(18, f.contenu.length, true);
    local.setUint32(22, f.contenu.length, true);
    local.setUint16(26, nom.length, true);
    morceaux.push(new Uint8Array(local.buffer), nom, f.contenu);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, SIG_CENTRAL, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.contenu.length, true);
    c.setUint32(24, f.contenu.length, true);
    c.setUint16(28, nom.length, true);
    c.setUint32(42, decalage, true);
    central.push(new Uint8Array(c.buffer), nom);
    decalage += 30 + nom.length + f.contenu.length;
  }
  const tailleCentral = central.reduce((t, m) => t + m.length, 0);
  const fin = new DataView(new ArrayBuffer(TAILLE_FIN_MIN));
  fin.setUint32(0, SIG_FIN, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true);
  fin.setUint32(16, decalage, true);
  const tout = [...morceaux, ...central, new Uint8Array(fin.buffer)];
  const sortie = new Uint8Array(tout.reduce((t, m) => t + m.length, 0));
  let i = 0;
  for (const m of tout) {
    sortie.set(m, i);
    i += m.length;
  }
  return sortie;
}
