import { FRAICHEUR_REFERENCE_MS } from "@/lib/durees";
import { useQuery } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { chargerReglages } from "../api/reglages";

export function useReglages() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["reglages", societe.id], queryFn: () => chargerReglages(societe.id), staleTime: FRAICHEUR_REFERENCE_MS });
}
