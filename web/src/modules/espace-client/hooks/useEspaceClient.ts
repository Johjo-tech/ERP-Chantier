import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { chantiersDuClient, devisDuClient, facturesDuClient } from "../api/espace";

export function useAccesClients() {
  const { etat } = useSession();
  return etat.statut === "connecte" ? etat.session.accesClients : [];
}

export function useDocumentsClient() {
  const ids = useAccesClients().map((a) => a.clientId);
  const cle = ids.join(",");
  return {
    chantiers: useQuery({ queryKey: ["espace-client", "chantiers", cle], queryFn: () => chantiersDuClient(ids), enabled: ids.length > 0 }),
    devis: useQuery({ queryKey: ["espace-client", "devis", cle], queryFn: () => devisDuClient(ids), enabled: ids.length > 0 }),
    factures: useQuery({ queryKey: ["espace-client", "factures", cle], queryFn: () => facturesDuClient(ids), enabled: ids.length > 0 }),
  };
}
