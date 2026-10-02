import { ICONES, type NomIcone } from "./icones-traces";

export type { NomIcone };

/**
 * Le <svg> tel que l'ancien écran l'écrivait. Les tracés sont des constantes du
 * code (`icones-traces.ts`), jamais une donnée : les injecter tels quels ne peut rien exécuter.
 */
export function Icone({ nom }: { nom: NomIcone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONES[nom] }} />
  );
}
