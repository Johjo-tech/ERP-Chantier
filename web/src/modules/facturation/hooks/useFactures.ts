import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Montant } from "@/lib/money";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { statutReglement } from "../domain/reglements";
import {
  ajouterReglement, creerFacture, emettreFacture, imputerAvoirSurFacture, listerFactures, lireFacture, modifierBrouillon,
  reglementsDeLaSociete, supprimerBrouillon, supprimerReglement, synchroniserStatut, totauxDesFactures,
} from "../api/factures";
import { etablirAvoir, factureDepuisDevis, facturerSituation } from "../api/operations";
import type { EnteteAEnregistrer } from "../domain/facture";
import type { LigneSituation } from "../domain/situation";

const cles = {
  racine: (s: string) => ["factures", s] as const,
  liste: (s: string, f: object) => ["factures", s, "liste", f] as const,
  totaux: (s: string) => ["factures", s, "totaux"] as const,
  reglements: (s: string) => ["factures", s, "reglements"] as const,
  fiche: (id: string) => ["facture", id] as const,
};

export function useFactures(filtre: { chantierId?: string } = {}) {
  const s = useSocieteActive();
  return useQuery({ queryKey: cles.liste(s.id, filtre), queryFn: () => listerFactures(s.id, filtre) });
}
export function useTotauxFactures() {
  const s = useSocieteActive();
  return useQuery({ queryKey: cles.totaux(s.id), queryFn: () => totauxDesFactures(s.id) });
}
export function useReglements() {
  const s = useSocieteActive();
  return useQuery({ queryKey: cles.reglements(s.id), queryFn: () => reglementsDeLaSociete(s.id) });
}
export function useFacture(id: string | undefined) {
  return useQuery({ queryKey: cles.fiche(id ?? ""), queryFn: () => lireFacture(id as string), enabled: !!id });
}

function useInvalider() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: cles.racine(s.id) });
    if (id) void qc.invalidateQueries({ queryKey: cles.fiche(id) });
    // Une situation déplace l'avancement du DPGF.
    void qc.invalidateQueries({ queryKey: ["dpgf"] });
    void qc.invalidateQueries({ queryKey: ["chantiers-avancement", s.id] });
  };
}

export function useEnregistrerFacture(id: string | undefined) {
  const s = useSocieteActive();
  const invalider = useInvalider();
  return useMutation({
    mutationFn: async ({ entete, lignes }: { entete: EnteteAEnregistrer; lignes: LigneAEnregistrer[] }) => {
      if (id) {
        await modifierBrouillon(id, entete, lignes);
        return id;
      }
      return creerFacture(s.id, entete, lignes);
    },
    onSuccess: (factureId) => invalider(factureId),
    onError: () => invalider(id),
  });
}

export function useEmettre() {
  const invalider = useInvalider();
  return useMutation({ mutationFn: emettreFacture, onSettled: (_n, _e, id) => invalider(id) });
}

export function useSupprimerBrouillon() {
  const invalider = useInvalider();
  return useMutation({ mutationFn: supprimerBrouillon, onSuccess: () => invalider() });
}

/** Ajouter ou retirer un règlement recale le statut stocké de la facture (écrit seulement s'il change). */
export function useReglementsFacture(factureId: string, ttc: Montant) {
  const s = useSocieteActive();
  const invalider = useInvalider();
  const tous = useReglements();
  const siens = (tous.data ?? []).filter((r) => r.facture_id === factureId);
  const recaler = async () => {
    const apres = await reglementsDeLaSociete(s.id);
    const cle = statutReglement(ttc, apres.filter((r) => r.facture_id === factureId)).cle;
    await synchroniserStatut(factureId, cle === "reglee" ? "payée" : "impayée");
  };
  const ajouter = useMutation({
    mutationFn: async (r: { date: string; montant: number; mode: string; reference: string | null }) => {
      await ajouterReglement(s.id, { ...r, facture_id: factureId });
      await recaler();
    },
    onSettled: () => invalider(factureId),
  });
  const retirer = useMutation({
    mutationFn: async (id: string) => {
      await supprimerReglement(id);
      await recaler();
    },
    onSettled: () => invalider(factureId),
  });
  return { reglements: siens, chargement: tous, ajouter, retirer };
}

export function useFactureDepuisDevis() {
  const s = useSocieteActive();
  const invalider = useInvalider();
  return useMutation({ mutationFn: (devisId: string) => factureDepuisDevis(s.id, devisId), onSuccess: (id) => invalider(id) });
}

export function useEtablirAvoir() {
  const s = useSocieteActive();
  const invalider = useInvalider();
  return useMutation({ mutationFn: ({ factureId, motif }: { factureId: string; motif: string }) => etablirAvoir(s.id, factureId, motif), onSuccess: (id) => invalider(id) });
}

export function useImputerAvoir() {
  const s = useSocieteActive();
  const invalider = useInvalider();
  return useMutation({
    mutationFn: (r: Parameters<typeof imputerAvoirSurFacture>[1]) => imputerAvoirSurFacture(s.id, r),
    onSuccess: () => invalider(),
  });
}

export function useFacturerSituation() {
  const s = useSocieteActive();
  const invalider = useInvalider();
  return useMutation({
    mutationFn: (p: { chantier: Parameters<typeof facturerSituation>[1]; lignes: LigneSituation[]; tvaDefaut: number }) =>
      facturerSituation(s.id, p.chantier, p.lignes, p.tvaDefaut),
    onSuccess: (id) => invalider(id),
  });
}
