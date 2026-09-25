import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission, useSocieteActive, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { avancementsChantiers, compteursChantiers, enregistrerChantier, enregistrerInfosDiverses, listerChantiers, lireChantier } from "../api/chantiers";
import {
  ajouterLigneDpgf,
  appliquerRepriseDevis,
  enregistrerLignesDpgf,
  importerDpgf,
  listerDpgf,
  supprimerLigneDpgf,
  type NouvelleLigneDpgf,
} from "../api/dpgf";
import { listerTachesPlanifiees, planifierQuantite, type DemandePlanification } from "../api/planification";
import type { SaisieChantier } from "../domain/chantier";
import type { RepriseDevis } from "../domain/devis-vers-dpgf";
import type { LigneImportee } from "../domain/import-dpgf";
import type { LigneDpgfModifiee } from "../domain/saisie-dpgf";

export const clesChantiers = {
  liste: (s: string) => ["chantiers", s] as const,
  fiche: (id: string) => ["chantier", id] as const,
  avancements: (s: string) => ["chantiers-avancement", s] as const,
  compteurs: (s: string) => ["chantiers-compteurs", s] as const,
  dpgf: (id: string) => ["dpgf", id] as const,
  planifiees: (id: string) => ["dpgf-planifiees", id] as const,
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

export function useCompteursChantiers() {
  const societe = useSocieteActive();
  const devis = usePermission("devis", "voir");
  const factures = usePermission("factures", "voir");
  return useQuery({
    queryKey: [...clesChantiers.compteurs(societe.id), devis, factures],
    queryFn: () => compteursChantiers(societe.id, { devis, factures }),
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

export function useEnregistrerInfosDiverses(chantierId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (infos: string) => enregistrerInfosDiverses(chantierId, infos),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clesChantiers.fiche(chantierId) }),
  });
}

export function useDpgf(chantierId: string) {
  const autorise = usePeutVoirDpgf();
  return useQuery({ queryKey: clesChantiers.dpgf(chantierId), queryFn: () => listerDpgf(chantierId), enabled: autorise });
}

export function useTachesPlanifiees(chantierId: string) {
  const autorise = usePeutVoirDpgf();
  return useQuery({ queryKey: clesChantiers.planifiees(chantierId), queryFn: () => listerTachesPlanifiees(chantierId), enabled: autorise });
}

function useInvaliderDpgf(chantierId: string) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesChantiers.dpgf(chantierId) });
    void qc.invalidateQueries({ queryKey: clesChantiers.planifiees(chantierId) });
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

export function useEnregistrerLignesDpgf(chantierId: string) {
  const invalider = useInvaliderDpgf(chantierId);
  return useMutation({ mutationFn: (lignes: readonly LigneDpgfModifiee[]) => enregistrerLignesDpgf(lignes), onSuccess: invalider });
}

export function useImporterDpgf(chantierId: string) {
  const invalider = useInvaliderDpgf(chantierId);
  return useMutation({
    mutationFn: (i: { lignes: readonly LigneImportee[]; aRemplacer: readonly string[]; positionSuivante: number }) =>
      importerDpgf(chantierId, i.lignes, i.aRemplacer, i.positionSuivante),
    // Même en cas d'échec partiel (suppression faite, insertion refusée), l'écran relit la base.
    onSettled: invalider,
  });
}

export function useRepriseDevis(chantierId: string) {
  const invalider = useInvaliderDpgf(chantierId);
  return useMutation({
    mutationFn: (r: { reprise: RepriseDevis; positionSuivante: number }) => appliquerRepriseDevis(chantierId, r.reprise, r.positionSuivante),
    onSettled: invalider,
  });
}

export function usePlanifierQuantite(chantierId: string) {
  const invalider = useInvaliderDpgf(chantierId);
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: DemandePlanification) => planifierQuantite(d),
    onSuccess: () => {
      invalider();
      // Clé racine des bons (module commandes) : le nouveau bon doit y apparaître sans rechargement.
      void qc.invalidateQueries({ queryKey: ["bons-commande", societe.id] });
    },
  });
}

export { useInvaliderDpgf };
