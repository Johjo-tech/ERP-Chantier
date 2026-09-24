/**
 * Recherche « à la manière de l'ancien écran » : insensible à la casse et aux
 * accents, et chaque mot saisi doit se trouver quelque part (multiWordMatch).
 */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function correspond(requete: string, ...champs: (string | null | undefined)[]): boolean {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const botte = normaliser(champs.filter(Boolean).join(" "));
  return mots.every((m) => botte.includes(m));
}
