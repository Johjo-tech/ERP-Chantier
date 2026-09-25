import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { ajouterDocumentLegal, listerDocumentsLegaux, supprimerDocumentLegal, type DocumentLegal } from "../api/documentsLegaux";
import {
  definirConducteurActif,
  definirFournisseurActif,
  enregistrerConducteur,
  enregistrerFournisseur,
  listerFichesConducteurs,
  listerFournisseurs,
  type FicheConducteur,
  type Fournisseur,
} from "../api/intervenants";
import {
  creerEntree,
  creerMetier,
  listerEntrees,
  listerMetiers,
  modifierMetier,
  placerEntrees,
  placerMetiers,
  renommerEntree,
  supprimerEntree,
  supprimerMetier,
} from "../api/listes";
import { listerCompteurs, reglerCompteurs } from "../api/numerotation";
import type { SaisieDocumentLegal } from "../domain/documents-legaux";
import type { SaisieConducteur, SaisieFournisseur } from "../domain/intervenants";
import type { DomaineListe, SaisieMetier } from "../domain/listes";
import type { SaisieCompteur, TypeSerie } from "../domain/numerotation";

export const clesReglages = {
  compteurs: (id: string, annee: number) => ["compteurs", id, annee] as const,
  documentsLegaux: (id: string) => ["documents-legaux", id] as const,
  entrees: (id: string) => ["referentiels", id] as const,
  metiers: (id: string) => ["metiers", id] as const,
  fichesConducteurs: (id: string) => ["fiches-conducteurs", id] as const,
  fournisseurs: (id: string) => ["fournisseurs", id] as const,
};

/** L'année civile à Paris : les compteurs repartent de zéro au 1er janvier. */
export function anneeCourante(): number {
  return Number(todayISO().slice(0, 4));
}

/** Une requête et ses mutations qui la relisent — le patron commun des listes de l'écran. */
function useMutationQuiRelit<V>(cle: readonly unknown[], fn: (v: V) => Promise<unknown>, autres: readonly (readonly unknown[])[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      for (const c of [cle, ...autres]) void qc.invalidateQueries({ queryKey: c });
    },
  });
}

export function useCompteurs(annee: number) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesReglages.compteurs(s.id, annee), queryFn: () => listerCompteurs(s.id, annee) });
}

export function useReglerCompteurs(annee: number) {
  const s = useSocieteActive();
  return useMutationQuiRelit(clesReglages.compteurs(s.id, annee), (series: Record<TypeSerie, SaisieCompteur>) => reglerCompteurs(s.id, annee, series));
}

export function useDocumentsLegaux() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesReglages.documentsLegaux(s.id), queryFn: () => listerDocumentsLegaux(s.id) });
}

export function useAjouterDocumentLegal() {
  const s = useSocieteActive();
  return useMutationQuiRelit(clesReglages.documentsLegaux(s.id), ({ saisie, fichier }: { saisie: SaisieDocumentLegal; fichier: File | null }) =>
    ajouterDocumentLegal(s.id, saisie, fichier)
  );
}

export function useSupprimerDocumentLegal() {
  const s = useSocieteActive();
  return useMutationQuiRelit(clesReglages.documentsLegaux(s.id), (d: DocumentLegal) => supprimerDocumentLegal(d));
}

export function useEntrees() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesReglages.entrees(s.id), queryFn: () => listerEntrees(s.id) });
}

export function useEcrireEntrees() {
  const s = useSocieteActive();
  const cle = clesReglages.entrees(s.id);
  return {
    creer: useMutationQuiRelit(cle, (v: { domaine: DomaineListe; libelle: string; position: number }) => creerEntree(s.id, v.domaine, v.libelle, v.position)),
    renommer: useMutationQuiRelit(cle, (v: { id: string; libelle: string }) => renommerEntree(v.id, v.libelle)),
    supprimer: useMutationQuiRelit(cle, (id: string) => supprimerEntree(id)),
    placer: useMutationQuiRelit(cle, (p: { id: string; position: number }[]) => placerEntrees(p)),
  };
}

export function useMetiers() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesReglages.metiers(s.id), queryFn: () => listerMetiers(s.id) });
}

export function useEcrireMetiers() {
  const s = useSocieteActive();
  const cle = clesReglages.metiers(s.id);
  return {
    creer: useMutationQuiRelit(cle, (v: { saisie: SaisieMetier; position: number }) => creerMetier(s.id, v.saisie, v.position)),
    // Un renommage est propagé par la base : les listes des autres modules se relisent aussi.
    modifier: useMutationQuiRelit(cle, (v: { id: string; saisie: SaisieMetier }) => modifierMetier(v.id, v.saisie), [["commandes"], ["planning"]]),
    supprimer: useMutationQuiRelit(cle, (id: string) => supprimerMetier(id)),
    placer: useMutationQuiRelit(cle, (p: { id: string; position: number }[]) => placerMetiers(p)),
  };
}

export function useFichesConducteurs() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesReglages.fichesConducteurs(s.id), queryFn: () => listerFichesConducteurs(s.id) });
}

export function useEcrireConducteurs() {
  const s = useSocieteActive();
  const cle = clesReglages.fichesConducteurs(s.id);
  // `conducteurs` : l'annuaire que lisent les sélecteurs des devis, bons et factures.
  const autres = [["conducteurs", s.id]] as const;
  return {
    enregistrer: useMutationQuiRelit(cle, (v: { avant: FicheConducteur | null; saisie: SaisieConducteur }) => enregistrerConducteur(s.id, v.avant, v.saisie), autres),
    actif: useMutationQuiRelit(cle, (v: { id: string; actif: boolean }) => definirConducteurActif(v.id, v.actif), autres),
  };
}

export function useFournisseurs() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesReglages.fournisseurs(s.id), queryFn: () => listerFournisseurs(s.id) });
}

export function useEcrireFournisseurs() {
  const s = useSocieteActive();
  const cle = clesReglages.fournisseurs(s.id);
  return {
    enregistrer: useMutationQuiRelit(cle, (v: { avant: Fournisseur | null; saisie: SaisieFournisseur }) => enregistrerFournisseur(s.id, v.avant, v.saisie)),
    actif: useMutationQuiRelit(cle, (v: { id: string; actif: boolean }) => definirFournisseurActif(v.id, v.actif)),
  };
}
