import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { libellesDuReferentiel, listerPersonnes } from "../api/annuaires";
import {
  creerMateriel,
  lireMateriel,
  listerMateriels,
  modifierMateriel,
  preterMateriel,
  rendreMateriel,
  supprimerMateriel,
  supprimerPretMateriel,
} from "../api/materiels";
import type { SaisieMateriel } from "../domain/materiel";
import type { SaisiePret } from "../domain/prets";

export const clesMateriel = {
  liste: (societeId: string) => ["materiels", societeId] as const,
  fiche: (id: string) => ["materiel", id] as const,
  personnes: (societeId: string) => ["parc-personnes", societeId] as const,
  referentiel: (societeId: string, domaine: string) => ["referentiels", societeId, domaine] as const,
};

const CINQ_MINUTES = 5 * 60_000;

export function useMateriels() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesMateriel.liste(societe.id), queryFn: () => listerMateriels(societe.id) });
}

export function useMateriel(id: string | undefined) {
  return useQuery({ queryKey: clesMateriel.fiche(id ?? ""), queryFn: () => lireMateriel(id as string), enabled: !!id });
}

export function usePersonnes() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesMateriel.personnes(societe.id), queryFn: () => listerPersonnes(societe.id), staleTime: CINQ_MINUTES });
}

export function useReferentielMateriel(domaine: "etat_materiel" | "categorie_materiel") {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesMateriel.referentiel(societe.id, domaine), queryFn: () => libellesDuReferentiel(societe.id, domaine), staleTime: CINQ_MINUTES });
}

/** Toute écriture relit la fiche et la liste : le statut « En prêt » s'affiche aux deux. */
function useEcriture<V, R>(materielId: string | undefined, fn: (v: V) => Promise<R>) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: clesMateriel.liste(societe.id) });
      if (materielId) void qc.invalidateQueries({ queryKey: clesMateriel.fiche(materielId) });
    },
  });
}

export function useEnregistrerMateriel(id: string | undefined) {
  const societe = useSocieteActive();
  return useEcriture(id, (s: SaisieMateriel) => (id ? modifierMateriel(id, s) : creerMateriel(societe.id, s)));
}

export const useSupprimerMateriel = (id: string) => useEcriture(id, () => supprimerMateriel(id));
export const usePreterMateriel = (id: string) => useEcriture(id, (s: SaisiePret) => preterMateriel(id, s));
export const useRendreMateriel = (id: string) => useEcriture(id, rendreMateriel);
export const useSupprimerPretMateriel = (id: string) => useEcriture(id, supprimerPretMateriel);
