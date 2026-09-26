import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Ce que les lectures en cours n'ont pas pu charger, nommé par le premier
 * segment de leur clé (« devis », « bons-commande »…), sans doublon ; chaîne
 * vide s'il n'y a rien. Une chaîne, pas un tableau : `useSyncExternalStore`
 * compare par identité, un tableau neuf à chaque lecture bouclerait.
 */
export function useEchecsDeLecture(): string {
  const cache = useQueryClient().getQueryCache();
  return useSyncExternalStore(
    (rappel) => cache.subscribe(rappel),
    () => [...new Set(cache.getAll().filter((q) => q.state.status === "error").map((q) => String(q.queryKey[0] ?? "données")))].join(", "),
    () => ""
  );
}
