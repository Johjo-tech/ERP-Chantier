import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { rechercherAdresse, type SuggestionAdresse } from "@/modules/clients/api/adresses";
import { communesDuCodePostal } from "@/modules/clients/api/communes";

/** Le délai de l'ancien (`searchAdresse`) : on attend que la frappe se pose avant d'interroger la BAN. */
const DELAI_ADRESSE_MS = 350;
const CARACTERES_MINIMUM = 3;
/** Une commune ne change pas de code postal d'un jour à l'autre. */
const GARDE_COMMUNES_MS = 86_400_000;

/**
 * Les adresses de la Base adresse nationale pour ce qui est tapé dans « Lieu
 * d'intervention » : `null` tant qu'on ne cherche pas (moins de trois
 * caractères, ou champ quitté), `"attente"` pendant la recherche.
 */
export function useSuggestionsAdresse(saisie: string, actif: boolean): SuggestionAdresse[] | "attente" | null {
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(saisie.trim()), DELAI_ADRESSE_MS);
    return () => clearTimeout(t);
  }, [saisie]);
  const possible = actif && q.length >= CARACTERES_MINIMUM;
  const r = useQuery({ queryKey: ["adresses", q], queryFn: ({ signal }) => rechercherAdresse(q, signal), enabled: possible });
  if (!possible) return null;
  return r.data ?? "attente";
}

/** La ville du code postal (`lookupVilleParCodePostal`) : la première commune, posée dès les cinq chiffres tapés. */
export function useVilleDuCodePostal(codePostal: string, poser: (ville: string) => void, actif: boolean): void {
  const cp = codePostal.trim();
  const communes = useQuery({ queryKey: ["communes", cp], queryFn: ({ signal }) => communesDuCodePostal(cp, signal), enabled: actif && /^\d{5}$/.test(cp), staleTime: GARDE_COMMUNES_MS });
  const premiere = communes.data?.[0];
  useEffect(() => {
    if (actif && premiere) poser(premiere);
    // `poser` change à chaque rendu : seul l'arrivée d'une commune doit déclencher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiere, actif]);
}
