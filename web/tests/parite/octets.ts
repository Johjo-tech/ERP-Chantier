/** Fabriques de fichiers pour les parités d'import : encodages réels, identifiants à clé juste ou fausse. */
import type { generateur } from "./aleatoire";

type Generateur = ReturnType<typeof generateur>;

/** Windows-1252 : latin-1 pour l'essentiel, plus les signes de 0x80-0x9F qu'on emploie. */
const SPECIAUX_1252: Record<string, number> = { "€": 0x80, "Œ": 0x8c, "œ": 0x9c, "’": 0x92 };

export function en1252(texte: string): Uint8Array | null {
  const octets: number[] = [];
  for (const c of texte) {
    const special = SPECIAUX_1252[c];
    const point = c.codePointAt(0) ?? 0;
    if (special !== undefined) octets.push(special);
    else if (point < 0x80 || (point >= 0xa0 && point <= 0xff)) octets.push(point);
    else return null;
  }
  return Uint8Array.from(octets);
}

export function enUtf16(texte: string, petitBoutiste: boolean): Uint8Array {
  const octets = [petitBoutiste ? 0xff : 0xfe, petitBoutiste ? 0xfe : 0xff];
  for (let i = 0; i < texte.length; i++) {
    const u = texte.charCodeAt(i);
    octets.push(...(petitBoutiste ? [u & 0xff, u >> 8] : [u >> 8, u & 0xff]));
  }
  return Uint8Array.from(octets);
}

export function octetsAleatoires(g: Generateur, texte: string): Uint8Array {
  const sansBom = texte.replace(/^\uFEFF/, "");
  const choix = g.entier(0, 4);
  if (choix === 0) return new TextEncoder().encode(texte);
  if (choix === 1) return Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(sansBom)]);
  if (choix === 2) return en1252(sansBom) ?? new TextEncoder().encode(texte);
  return enUtf16(sansBom, choix === 3);
}

/** Complète des chiffres par leur clé de Luhn : un SIREN (8 → 9) ou un SIRET (13 → 14) valide. */
export function avecCleLuhn(chiffres: string): string {
  for (let cle = 0; cle <= 9; cle++) {
    const n = `${chiffres}${cle}`;
    let total = 0;
    for (let i = 0; i < n.length; i++) {
      let d = Number(n[n.length - 1 - i]);
      if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
      total += d;
    }
    if (total % 10 === 0) return n;
  }
  return chiffres;
}
