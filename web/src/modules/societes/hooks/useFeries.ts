import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { definirFeriesAlsaceMoselle, lireFeriesAlsaceMoselle } from "../api/feries";

const cleFeries = (societeId: string) => ["feries-alsace-moselle", societeId] as const;

/** Un réglage qui ne change presque jamais : lu une fois par société et gardé. */
const GARDE_MS = 30 * 60_000;

export function useFeriesAlsaceMoselle() {
  const s = useSocieteActive();
  return useQuery({ queryKey: cleFeries(s.id), queryFn: () => lireFeriesAlsaceMoselle(s.id), staleTime: GARDE_MS });
}

/** Les options de fériés du planning : nationaux tant que le réglage n'est pas lu (jamais un jour ouvré de trop). */
export function useOptionsFeries(): { alsaceMoselle: boolean } {
  return { alsaceMoselle: useFeriesAlsaceMoselle().data ?? false };
}

export function useDefinirFeriesAlsaceMoselle() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (actif: boolean) => definirFeriesAlsaceMoselle(s.id, actif),
    onSettled: () => void qc.invalidateQueries({ queryKey: cleFeries(s.id) }),
  });
}
