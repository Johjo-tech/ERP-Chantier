import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission, useSocieteActive, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { avancementsChantiers, enregistrerChantier, listerChantiers, lireChantier } from "../api/chantiers";
import { ajouterLigneDpgf, listerDpgf, supprimerLigneDpgf, type NouvelleLigneDpgf } from "../api/dpgf";
import type { SaisieChantier } from "../domain/chantier";

export const clesChantiers = {
  liste: (s: string) => ["chantiers", s] as const,
  fiche: (id: string) => ["chantier", id] as const,
  avancements: (s: string) => ["chantiers-avancement", s] as const,
  dpgf: (id: string) => ["dpgf", id] as const,
};

export function useChantiers() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesChantiers.liste(societe.id), queryFn: () => listerChantiers(societe.id) });
}

/** Les montants du DPGF : seulement pour qui voit les prix ET peut modifier les chantiers (RLS du DPGF). */
export function usePeutVoirDpgf(): boolean {
  const prix = useVoitLesPrix();
  const modifier = usePermission("chantiers", "modifier");
  return prix && modifier;
}

export function useAvancements() {
  const societe = useSocieteActive();
  const autorise = usePeutVoirDpgf();
  return useQuery({
    queryKey: clesChantiers.avancements(societe.id),
    queryFn: () => avancementsChantiers(societe.id),
    enabled: autorise,
  });
}

export function useChantier(id: string | undefined) {
  return useQuery({ queryKey: clesChantiers.fiche(id ?? ""), queryFn: () => lireChantier(id as string), enabled: !!id });
}

export function useEnregistrerChantier(id: string | undefined) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: SaisieChantier) => enregistrerChantier(societe.id, id ?? null, s),
    onSuccess: (c) => {
      qc.setQueryData(clesChantiers.fiche(c.id), c);
      void qc.invalidateQueries({ queryKey: clesChantiers.liste(societe.id) });
    },
  });
}

export function useDpgf(chantierId: string) {
  const autorise = usePeutVoirDpgf();
  return useQuery({ queryKey: clesChantiers.dpgf(chantierId), queryFn: () => listerDpgf(chantierId), enabled: autorise });
}

function useInvaliderDpgf(chantierId: string) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesChantiers.dpgf(chantierId) });
    void qc.invalidateQueries({ queryKey: clesChantiers.avancements(societe.id) });
  };
}

export function useAjouterLigneDpgf(chantierId: string) {
  const invalider = useInvaliderDpgf(chantierId);
  return useMutation({
    mutationFn: ({ position, ligne }: { position: number; ligne: NouvelleLigneDpgf }) => ajouterLigneDpgf(chantierId, position, ligne),
    onSuccess: invalider,
  });
}

export function useSupprimerLigneDpgf(chantierId: string) {
  const invalider = useInvaliderDpgf(chantierId);
  return useMutation({ mutationFn: supprimerLigneDpgf, onSuccess: invalider });
}

export { useInvaliderDpgf };
