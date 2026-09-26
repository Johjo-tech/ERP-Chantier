/** Générateur pseudo-aléatoire à graine fixe : une parité qui échoue se rejoue à l'identique. */
export function generateur(graine = 20260924) {
  let etat = graine >>> 0;
  const suivant = () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    reel: suivant,
    entier: (min: number, max: number) => min + Math.floor(suivant() * (max - min + 1)),
    parmi: <T>(liste: readonly T[]): T => liste[Math.floor(suivant() * liste.length)] as T,
    chiffres: (n: number) => Array.from({ length: n }, () => Math.floor(suivant() * 10)).join(""),
  };
}
