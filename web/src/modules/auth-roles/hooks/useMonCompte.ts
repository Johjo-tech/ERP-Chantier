import { useMutation, useQueryClient } from "@tanstack/react-query";
import { renommerMonCompte } from "../api/compte";

export function useRenommerMonCompte(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nom: string) => renommerMonCompte(id, nom),
    // Le menu porte le nom : la session se relit, sinon il resterait sur l'ancien.
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["auth", "session"] }),
  });
}
