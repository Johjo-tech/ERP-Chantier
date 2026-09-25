import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { depuisBase, lignesPourEnregistrement } from "@/modules/documents/domain/lignes";
import { enregistrerDevis, listerDevis, lireDevis, supprimerDevis, totauxDesDevis } from "../api/devis";
import type { EnteteAEnregistrer } from "../domain/devis";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";

export const clesDevis = {
  liste: (s: string, f: object = {}) => ["devis", s, f] as const,
  racine: (s: string) => ["devis", s] as const,
  totaux: (s: string) => ["devis-totaux", s] as const,
  fiche: (id: string) => ["devis-fiche", id] as const,
};

export function useListeDevis(filtre: { chantierId?: string; clientId?: string } = {}) {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesDevis.liste(societe.id, filtre), queryFn: () => listerDevis(societe.id, filtre) });
}

export function useTotauxDevis() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesDevis.totaux(societe.id), queryFn: () => totauxDesDevis(societe.id) });
}

export function useDevis(id: string | undefined) {
  return useQuery({ queryKey: clesDevis.fiche(id ?? ""), queryFn: () => lireDevis(id as string), enabled: !!id });
}

function useInvaliderDevis() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: clesDevis.racine(societe.id) });
    void qc.invalidateQueries({ queryKey: clesDevis.totaux(societe.id) });
    if (id) void qc.invalidateQueries({ queryKey: clesDevis.fiche(id) });
  };
}

export function useEnregistrerDevis(id: string | undefined) {
  const societe = useSocieteActive();
  const invalider = useInvaliderDevis();
  return useMutation({
    mutationFn: ({ entete, lignes, conducteurHistorique = null }: { entete: EnteteAEnregistrer; lignes: LigneAEnregistrer[]; conducteurHistorique?: string | null }) =>
      enregistrerDevis(societe.id, id ?? null, entete, lignes, conducteurHistorique),
    onSuccess: (devisId) => invalider(devisId),
    onError: () => invalider(id),
  });
}

/** Dupliquer : un nouveau brouillon daté du jour, lignes copiées sans leurs identifiants. */
export function useDupliquerDevis() {
  const societe = useSocieteActive();
  const invalider = useInvaliderDevis();
  return useMutation({
    mutationFn: async (id: string) => {
      const d = await lireDevis(id);
      const { lignes } = lignesPourEnregistrement(d.lignes.map(depuisBase).map((l) => ({ ...l, id: null })));
      const { id: _id, societe_id: _s, numero: _n, conducteur: _c, lignes: _l, ...entete } = d;
      return enregistrerDevis(societe.id, null, { ...entete, client_id: d.client_id ?? "", date: todayISO(), statut: "brouillon" }, lignes);
    },
    onSuccess: (devisId) => invalider(devisId),
  });
}

export function useSupprimerDevis() {
  const invalider = useInvaliderDevis();
  return useMutation({ mutationFn: supprimerDevis, onSuccess: () => invalider() });
}
