/**
 * Rapprocher le nom lu sur un bon du fichier clients (port de
 * `rapprocherClient`, src/integrations/ocr.ts) : accents, forme juridique,
 * casse et mention d'agence diffèrent presque toujours. Prudent : en dessous
 * d'une correspondance nette, on propose, on ne choisit pas.
 */
function normaliser(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b(SA|SAS|SASU|SARL|EURL|SCI|OPH|HLM|SA HLM|OFFICE PUBLIC DE L HABITAT)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const VIDES = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "ET", "L", "D"]);
const motsCles = (nom: string) => normaliser(nom).split(" ").filter((m) => m.length > 2 && !VIDES.has(m));

const SEUIL_CERTAIN = 0.8;
const SUGGESTIONS_MAX = 8;

export interface Rapprochement {
  nom: string;
  reconnu: boolean;
  suggestions: string[];
}

export function rapprocherClient(nomLu: string | null | undefined, clientsConnus: readonly string[]): Rapprochement {
  const lu = (nomLu ?? "").trim();
  if (!lu) return { nom: "", reconnu: false, suggestions: clientsConnus.slice(0, SUGGESTIONS_MAX) };
  const cible = normaliser(lu);
  const exact = clientsConnus.find((c) => normaliser(c) === cible);
  if (exact) return { nom: exact, reconnu: true, suggestions: [] };
  const inclus = clientsConnus.filter((c) => {
    const n = normaliser(c);
    return n.includes(cible) || cible.includes(n);
  });
  if (inclus.length === 1 && inclus[0]) return { nom: inclus[0], reconnu: true, suggestions: [] };
  const motsLus = motsCles(lu);
  const scores = clientsConnus
    .map((c) => {
      const mots = motsCles(c);
      const communs = motsLus.filter((m) => mots.includes(m)).length;
      return { nom: c, score: communs / Math.max(1, Math.min(motsLus.length, mots.length)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const [meilleur, second] = scores;
  if (meilleur && meilleur.score >= SEUIL_CERTAIN && (!second || second.score < meilleur.score)) {
    return { nom: meilleur.nom, reconnu: true, suggestions: [] };
  }
  return {
    nom: lu,
    reconnu: false,
    suggestions: [...inclus, ...scores.map((s) => s.nom)].filter((v, i, t) => t.indexOf(v) === i).slice(0, SUGGESTIONS_MAX),
  };
}
