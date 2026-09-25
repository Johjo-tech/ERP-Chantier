/**
 * Les polices standard d'un PDF (Helvetica) ne connaissent que le jeu
 * WinAnsi : « → » (les lignes de situation), l'espace fine insécable de
 * `Intl` ou un emoji s'y imprimeraient en caractères illisibles. On les
 * remplace par leur équivalent lisible, et le reste inconnu par « ? ».
 */
const EQUIVALENTS: Record<string, string> = {
  "\u2192": "->",
  "\u2190": "<-",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u00A0": " ",
  "\u202F": " ",
  "\u2007": " ",
  "\u2009": " ",
  "\u2011": "-",
  "\u2212": "-",
  "\u2713": "v",
  "\u2714": "v",
};

// Latin-1 imprimable, plus les caractères que WinAnsi place entre 0x80 et 0x9F.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const ASCII_DEBUT = 0x20;
const ASCII_FIN = 0x7e;
const LATIN1_DEBUT = 0xa0;
const LATIN1_FIN = 0xff;

function imprimable(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  return c === "\n" || (code >= ASCII_DEBUT && code <= ASCII_FIN) || (code >= LATIN1_DEBUT && code <= LATIN1_FIN) || WIN_ANSI_EXTRA.has(c);
}

export function texteWinAnsi(s: string): string {
  let sortie = "";
  for (const c of s) sortie += EQUIVALENTS[c] ?? (imprimable(c) ? c : "?");
  return sortie;
}
