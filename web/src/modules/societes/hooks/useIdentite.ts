import { FRAICHEUR_REFERENCE_MS } from "@/lib/durees";
import { useQuery } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { lireIdentite } from "../api/identite";

export function useIdentite() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["identite", societe.id], queryFn: () => lireIdentite(societe.id), staleTime: FRAICHEUR_REFERENCE_MS });
}
