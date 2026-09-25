import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { chantiersDuClient, devisDuClient, facturesDuClient } from "../api/espace";
import { bonsDuClient, emetteurPourClient, soldesDuClient } from "../api/suivi";

export function useAccesClients() {
  const { etat } = useSession();
  return etat.statut === "connecte" ? etat.session.accesClients : [];
}

export function useDocumentsClient() {
  const ids = useAccesClients().map((a) => a.clientId);
  const cle = ids.join(",");
  const factures = useQuery({ queryKey: ["espace-client", "factures", cle], queryFn: () => facturesDuClient(ids), enabled: ids.length > 0 });
  const idsFactures = (factures.data ?? []).map((f) => f.id);
  return {
    chantiers: useQuery({ queryKey: ["espace-client", "chantiers", cle], queryFn: () => chantiersDuClient(ids), enabled: ids.length > 0 }),
    devis: useQuery({ queryKey: ["espace-client", "devis", cle], queryFn: () => devisDuClient(ids), enabled: ids.length > 0 }),
    factures,
    // Le solde de ses factures : calculé par la base, avec les règlements que la RLS lui ouvre.
    soldes: useQuery({ queryKey: ["espace-client", "soldes", idsFactures.join(",")], queryFn: () => soldesDuClient(idsFactures), enabled: factures.isSuccess }),
  };
}

export function useBonsClient() {
  const ids = useAccesClients().map((a) => a.clientId);
  return useQuery({ queryKey: ["espace-client", "bons", ids.join(",")], queryFn: () => bonsDuClient(ids), enabled: ids.length > 0 });
}

export function useEmetteurClient(societeId: string | undefined) {
  return useQuery({ queryKey: ["espace-client", "emetteur", societeId], queryFn: () => emetteurPourClient(societeId as string), enabled: !!societeId, staleTime: 5 * 60_000 });
}
