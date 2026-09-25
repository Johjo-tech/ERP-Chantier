import axe from "axe-core";

/**
 * Le capteur d'accessibilité automatique (TRV, axe-core) : il passe l'écran
 * rendu au crible des règles WCAG 2.x A/AA et rend les violations lisibles.
 *
 * Deux règles sont coupées, parce que jsdom ne peut pas y répondre juste :
 * le contraste (aucun calcul de style ni de mise en page) et les régions de
 * page (un écran testé seul n'a pas le gabarit qui porte `<main>`). Le
 * contraste de la palette est garanti ailleurs (`societes/theme/palette`,
 * 4,5:1 prouvé par la parité).
 */
const REGLES_COUPEES = { "color-contrast": { enabled: false }, region: { enabled: false } } as const;

export interface ViolationLisible {
  regle: string;
  impact: string | null | undefined;
  aide: string;
  cibles: string[];
}

export async function violationsAxe(conteneur: Element): Promise<ViolationLisible[]> {
  const r = await axe.run(conteneur, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, rules: REGLES_COUPEES });
  return r.violations.map((v) => ({ regle: v.id, impact: v.impact, aide: v.help, cibles: v.nodes.map((n) => n.target.join(" ")) }));
}
