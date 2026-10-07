import { origineDeLaCorrespondance } from "@/lib/recherche";

/**
 * « 🔎 BC 2024-0187 » sous une ligne trouvée par ce que dit son bon ou sa
 * facture, et non par elle-même (TRV-07, `origineRechercheHTML`). Calculé au
 * rendu : seules les lignes affichées paient l'attribution.
 */
export function OrigineRecherche({ requete, propres, apports }: { requete: string; propres: readonly (string | null | undefined)[]; apports: readonly { etiquette: string; valeur: string }[] }) {
  const origines = origineDeLaCorrespondance(requete, propres, apports);
  if (!origines.length) return null;
  return <span className="block text-xs text-muted-foreground">🔎 {origines.map((o) => `${o.etiquette} ${o.valeur}`).join(" · ")}</span>;
}
