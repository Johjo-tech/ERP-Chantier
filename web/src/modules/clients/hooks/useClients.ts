import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { creerClient, listerClients, lireClient, modifierClient, supprimerClient } from "../api/clients";
import { creerInterlocuteur, listerInterlocuteurs, supprimerInterlocuteur } from "../api/interlocuteurs";
import type { SaisieClient } from "../domain/client";
import type { SaisieInterlocuteur } from "../domain/interlocuteur";

export const clesClients = {
  liste: (societeId: string) => ["clients", societeId] as const,
  fiche: (id: string) => ["client", id] as const,
  interlocuteurs: (clientId: string) => ["interlocuteurs", clientId] as const,
};

export function useClients() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesClients.liste(societe.id), queryFn: () => listerClients(societe.id) });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: clesClients.fiche(id ?? ""),
    queryFn: () => lireClient(id as string),
    enabled: !!id,
  });
}

export function useEnregistrerClient(id: string | undefined) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: SaisieClient) => (id ? modifierClient(id, s) : creerClient(societe.id, s)),
    onSuccess: (client) => {
      qc.setQueryData(clesClients.fiche(client.id), client);
      void qc.invalidateQueries({ queryKey: clesClients.liste(societe.id) });
    },
  });
}

export function useSupprimerClient() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supprimerClient,
    onSuccess: () => void qc.invalidateQueries({ queryKey: clesClients.liste(societe.id) }),
  });
}

export function useInterlocuteurs(clientId: string) {
  return useQuery({ queryKey: clesClients.interlocuteurs(clientId), queryFn: () => listerInterlocuteurs(clientId) });
}

export function useAjouterInterlocuteur(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: SaisieInterlocuteur) => creerInterlocuteur(clientId, s),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clesClients.interlocuteurs(clientId) }),
  });
}

export function useSupprimerInterlocuteur(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supprimerInterlocuteur,
    onSuccess: () => void qc.invalidateQueries({ queryKey: clesClients.interlocuteurs(clientId) }),
  });
}
