import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { creerClient, listerClients, listerClientsRapprochables, lireClient, modifierClient, supprimerClient, usagesDuClient } from "../api/clients";
import { creerInterlocuteur, listerInterlocuteurs, modifierInterlocuteur, supprimerInterlocuteur } from "../api/interlocuteurs";
import type { SaisieClient } from "../domain/client";
import type { SaisieInterlocuteur } from "../domain/interlocuteur";

export const clesClients = {
  liste: (societeId: string) => ["clients", societeId] as const,
  rapprochables: (societeId: string) => ["clients", societeId, "rapprochables"] as const,
  fiche: (id: string) => ["client", id] as const,
  interlocuteurs: (clientId: string) => ["interlocuteurs", clientId] as const,
};

export function useClients() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesClients.liste(societe.id), queryFn: () => listerClients(societe.id) });
}

/** La lecture légère pour rapprocher un nom lu (OCR) d'une fiche (CLI-32). */
export function useClientsRapprochables() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesClients.rapprochables(societe.id), queryFn: () => listerClientsRapprochables(societe.id) });
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

export function useUsagesClient(id: string) {
  return useQuery({ queryKey: ["usages-client", id], queryFn: () => usagesDuClient(id) });
}

/** Les usages lus au moment du clic : la liste n'a pas à compter les pièces de chaque client pour rien. */
export function useLireUsagesClient() {
  const qc = useQueryClient();
  return (id: string) => qc.fetchQuery({ queryKey: ["usages-client", id], queryFn: () => usagesDuClient(id) });
}

export function useInterlocuteurs(clientId: string) {
  return useQuery({ queryKey: clesClients.interlocuteurs(clientId), queryFn: () => listerInterlocuteurs(clientId) });
}

/** La liste des clients porte leurs interlocuteurs : toute écriture la relit aussi. */
function useInvaliderInterlocuteurs(clientId: string) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesClients.interlocuteurs(clientId) });
    void qc.invalidateQueries({ queryKey: clesClients.liste(societe.id) });
  };
}

export function useAjouterInterlocuteur(clientId: string) {
  const invalider = useInvaliderInterlocuteurs(clientId);
  return useMutation({
    mutationFn: (s: SaisieInterlocuteur) => creerInterlocuteur(clientId, s),
    onSuccess: invalider,
  });
}

/** Créer ou modifier, selon qu'un identifiant est donné (le formulaire de l'ancien sert aux deux). */
export function useEnregistrerInterlocuteur(clientId: string) {
  const invalider = useInvaliderInterlocuteurs(clientId);
  return useMutation({
    mutationFn: ({ id, saisie }: { id: string | null; saisie: SaisieInterlocuteur }) =>
      id ? modifierInterlocuteur(id, saisie) : creerInterlocuteur(clientId, saisie),
    onSuccess: invalider,
  });
}

export function useSupprimerInterlocuteur(clientId: string) {
  const invalider = useInvaliderInterlocuteurs(clientId);
  return useMutation({
    mutationFn: supprimerInterlocuteur,
    onSuccess: invalider,
  });
}
