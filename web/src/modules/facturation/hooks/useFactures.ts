import { clesBons } from "@/modules/commandes/hooks/useBons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import {
  ajouterReglement, contexteImpression, creerFacture, deverrouillerBrouillon, emettreFacture, listerFactures, lireFacture, modifierBrouillon,
  reglementsDeLaSociete, supprimerBrouillon, supprimerReglement, totauxDesFactures, verrouillerBrouillon,
} from "../api/factures";
import { dupliquerFacture, etablirAvoir, factureDepuisDevis, facturerSituation, rendreAvancementDuBrouillon } from "../api/operations";
import { enregistrerReglementGroupe, imputerAvoir, modifierReglement } from "../api/reglements";
import { soldesDesFactures } from "../api/soldes";
import type { EnteteAEnregistrer } from "../domain/facture";
import type { LigneSituation } from "../domain/situation";

const cles = {
  racine: (s: string) => ["factures", s] as const,
  liste: (s: string, f: object) => ["factures", s, "liste", f] as const,
  totaux: (s: string) => ["factures", s, "totaux"] as const,
  reglements: (s: string) => ["factures", s, "reglements"] as const,
  soldes: (s: string) => ["factures", s, "soldes"] as const,
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
/** Les soldes calculés par la base (v_facture_solde) : reste, état, retard. */
export function useSoldes() {
  const s = useSocieteActive();
  return useQuery({ queryKey: cles.soldes(s.id), queryFn: () => soldesDesFactures(s.id) });
}
export function useContexteImpression(f: { id: string; devis_id: string | null; facture_rectifiee_id: string | null } | null) {
  return useQuery({ queryKey: ["facture-contexte", f?.id ?? "", f?.devis_id, f?.facture_rectifiee_id], queryFn: () => contexteImpression(f as NonNullable<typeof f>), enabled: !!f });
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
    // Émettre une facture fige son bon : sa fiche en cache montrerait encore un bon modifiable (relecture 3, I3).
    void qc.invalidateQueries({ queryKey: clesBons.racine(s.id) });
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
  return useMutation({
    mutationFn: async (id: string) => {
      await rendreAvancementDuBrouillon(id);
      await supprimerBrouillon(id);
    },
    onSettled: () => invalider(),
  });
}

/** Les règlements d'une facture, pris dans ceux de la société (une seule lecture pour tous les écrans). */
export function useReglementsFacture(factureId: string) {
  const tous = useReglements();
  return { reglements: (tous.data ?? []).filter((r) => r.facture_id === factureId), chargement: tous };
}

/**
 * Un règlement unitaire. Le statut stocké de la facture (payée / impayée) est
 * recalé PAR LA BASE (déclencheur, proposition 20260926041000) : l'écran ne
 * l'écrit plus — un onglet fermé trop tôt le laissait mentir.
 */
export function useAjouterReglement(factureId: string) {
  const s = useSocieteActive();
  const invalider = useInvalider();
  return useMutation({
    mutationFn: (r: { date: string; montant: number; mode: string; reference: string | null }) => ajouterReglement(s.id, { ...r, facture_id: factureId }),
    onSettled: () => invalider(factureId),
  });
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

/** Lettrage / « Régler par un avoir » : la base contrôle et écrit les deux règlements liés. */
export function useImputerAvoir() {
  const invalider = useInvalider();
  return useMutation({ mutationFn: (r: Parameters<typeof imputerAvoir>[0]) => imputerAvoir(r), onSettled: () => invalider() });
}

/** Un virement réparti sur plusieurs factures, imputé par la base (tout ou rien). */
export function useReglementGroupe() {
  const invalider = useInvalider();
  return useMutation({ mutationFn: (r: Parameters<typeof enregistrerReglementGroupe>[0]) => enregistrerReglementGroupe(r), onSettled: () => invalider() });
}

export function useModifierReglement() {
  const invalider = useInvalider();
  return useMutation({
    mutationFn: ({ id, ...r }: { id: string; date: string; montant: number; mode: string; reference: string | null }) => modifierReglement(id, r),
    onSettled: () => invalider(),
  });
}

export function useSupprimerReglement() {
  const invalider = useInvalider();
  return useMutation({ mutationFn: supprimerReglement, onSettled: () => invalider() });
}

export function useDupliquerFacture() {
  const s = useSocieteActive();
  const invalider = useInvalider();
  return useMutation({ mutationFn: (id: string) => dupliquerFacture(s.id, id), onSuccess: (id) => invalider(id) });
}

/** Le cadenas d'une facture brouillon imprimée ou envoyée (FAC-12), et sa levée (FAC-09). */
export function useCadenas(factureId: string) {
  const s = useSocieteActive();
  const invalider = useInvalider();
  const poser = useMutation({ mutationFn: (clientId: string | null) => verrouillerBrouillon(s.id, { id: factureId, client_id: clientId }), onSettled: () => invalider(factureId) });
  const lever = useMutation({ mutationFn: () => deverrouillerBrouillon(factureId), onSettled: () => invalider(factureId) });
  return { poser, lever };
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
