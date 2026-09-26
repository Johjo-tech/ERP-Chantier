import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { SaisiePret } from "@/modules/materiel/domain/prets";
import { ajouterDocument, documentsAEcheance, listerDocuments, supprimerDocument } from "../api/documents";
import { ajouterEntretien, listerEntretiens, modifierEntretien, supprimerEntretien } from "../api/entretiens";
import { listerPretsVehicule, preterVehicule, rendreVehicule, supprimerPretVehicule } from "../api/prets";
import { vendreVehicule } from "../api/vente";
import { creerVehicule, lireVehicule, listerVehicules, modifierVehicule, supprimerVehicule } from "../api/vehicules";
import type { DocumentVehicule, SaisieDocument } from "../domain/documents";
import type { Entretien, SaisieEntretien } from "../domain/entretien";
import type { Marque } from "../domain/schema-vehicule";
import type { SaisieVehicule, Vehicule } from "../domain/vehicule";
import type { SaisieVente } from "../domain/vente";

export const clesVehicules = {
  liste: (societeId: string) => ["vehicules", societeId] as const,
  fiche: (id: string) => ["vehicule", id] as const,
  prets: (id: string) => ["vehicule", id, "prets"] as const,
  entretiens: (id: string) => ["vehicule", id, "entretiens"] as const,
  documents: (id: string) => ["vehicule", id, "documents"] as const,
  echeances: (societeId: string) => ["vehicules-echeances", societeId] as const,
};

export function useVehicules() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesVehicules.liste(societe.id), queryFn: () => listerVehicules(societe.id) });
}

export function useVehicule(id: string | undefined) {
  return useQuery({ queryKey: clesVehicules.fiche(id ?? ""), queryFn: () => lireVehicule(id as string), enabled: !!id });
}

export function useEcheancesDocuments() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesVehicules.echeances(societe.id), queryFn: () => documentsAEcheance(societe.id) });
}

export const usePretsVehicule = (id: string) => useQuery({ queryKey: clesVehicules.prets(id), queryFn: () => listerPretsVehicule(id) });
export const useEntretiens = (id: string) => useQuery({ queryKey: clesVehicules.entretiens(id), queryFn: () => listerEntretiens(id) });
export const useDocumentsVehicule = (id: string) => useQuery({ queryKey: clesVehicules.documents(id), queryFn: () => listerDocuments(id) });

/**
 * Toute écriture relit ce que la fiche du véhicule montre : la fiche elle-même
 * (le kilométrage monte avec un entretien, « vendu » avec une vente), ses
 * listes, et la liste de la société (statut, alertes). Même en cas d'échec :
 * une écriture en deux temps a pu réussir à moitié.
 */
function useEcriture<V, R>(vehiculeId: string | undefined, fn: (v: V) => Promise<R>) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: clesVehicules.liste(societe.id) });
      void qc.invalidateQueries({ queryKey: clesVehicules.echeances(societe.id) });
      if (vehiculeId) void qc.invalidateQueries({ queryKey: clesVehicules.fiche(vehiculeId) });
    },
  });
}

export function useEnregistrerVehicule(id: string | undefined) {
  const societe = useSocieteActive();
  return useEcriture(id, (s: SaisieVehicule) => (id ? modifierVehicule(id, s) : creerVehicule(societe.id, s)));
}

export const useSupprimerVehicule = (id: string) => useEcriture(id, () => supprimerVehicule(id));

export const usePreterVehicule = (id: string) => useEcriture(id, ({ saisie, marques }: { saisie: SaisiePret; marques: Marque[] }) => preterVehicule(id, saisie, marques));
export const useRendreVehicule = (id: string) => useEcriture(id, ({ pretId, marques }: { pretId: string; marques: Marque[] }) => rendreVehicule(pretId, marques));
export const useSupprimerPretVehicule = (id: string) => useEcriture(id, supprimerPretVehicule);

export function useAjouterEntretien(v: Pick<Vehicule, "id" | "kilometrage">) {
  const societe = useSocieteActive();
  return useEcriture(v.id, ({ saisie, fichier }: { saisie: SaisieEntretien; fichier: File | null }) => ajouterEntretien(societe.id, v, saisie, fichier));
}
export const useModifierEntretien = (v: Pick<Vehicule, "id" | "kilometrage">) =>
  useEcriture(v.id, ({ id, saisie }: { id: string; saisie: SaisieEntretien }) => modifierEntretien(v, id, saisie));
export const useSupprimerEntretien = (id: string) => useEcriture(id, (e: Entretien) => supprimerEntretien(e));

export function useAjouterDocument(vehiculeId: string) {
  const societe = useSocieteActive();
  return useEcriture(vehiculeId, ({ saisie, fichier }: { saisie: SaisieDocument; fichier: File }) => ajouterDocument(societe.id, vehiculeId, saisie, fichier));
}
export const useSupprimerDocument = (id: string) => useEcriture(id, (d: DocumentVehicule) => supprimerDocument(d));

/** La vente crée une facture : les factures de la société se relisent aussi. */
export function useVendreVehicule(vehiculeId: string) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useEcriture(vehiculeId, async (s: SaisieVente) => {
    try {
      return await vendreVehicule(societe.id, vehiculeId, s);
    } finally {
      void qc.invalidateQueries({ queryKey: ["factures", societe.id] });
    }
  });
}
