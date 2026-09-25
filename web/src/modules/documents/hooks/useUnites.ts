import { useQuery } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { unitesDuReferentiel } from "../api/unites";
import { UNITES_REPLI } from "../domain/unites";

/**
 * Les unités d'une ligne de document (DEV-08). Tant que le référentiel n'a
 * pas répondu — ou s'il ne répond pas —, la liste de repli : une ligne ne doit
 * jamais afficher un menu d'unités vide.
 */
export function useUnitesLignes(): readonly string[] {
  const societe = useSocieteActive();
  const q = useQuery({ queryKey: ["referentiel-unites", societe.id], queryFn: () => unitesDuReferentiel(societe.id), staleTime: 5 * 60_000 });
  return q.data ?? UNITES_REPLI;
}
