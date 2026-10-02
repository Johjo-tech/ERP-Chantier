import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { definirAccesClient, listerAccesClients, ouvrirAccesClient, retirerAccesClient } from "../api/acces";
import type { SaisieOuvertureAcces } from "../domain/acces";

const cleAcces = (societeId: string) => ["acces-clients", societeId] as const;

export function useAccesClients() {
  const s = useSocieteActive();
  return useQuery({ queryKey: cleAcces(s.id), queryFn: () => listerAccesClients(s.id) });
}

/** Chaque geste relit la liste : la base seule sait ce qu'elle a gardé. */
export function useGererAccesClients() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  const relire = () => void qc.invalidateQueries({ queryKey: cleAcces(s.id) });
  return {
    ouvrir: useMutation({ mutationFn: (saisie: SaisieOuvertureAcces) => ouvrirAccesClient(saisie), onSettled: relire }),
    definir: useMutation({ mutationFn: (v: { id: string; actif: boolean }) => definirAccesClient(v.id, v.actif), onSettled: relire }),
    retirer: useMutation({ mutationFn: (id: string) => retirerAccesClient(id), onSettled: relire }),
  };
}
