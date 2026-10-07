import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { bonsLiables, enregistrerRapport, lierBon, lireRapport, listerRapports, supprimerRapport, type PhotoAEnregistrer, type Rapport, type Signatures } from "../api/rapports";
import { courrielDuClient, devisDepuisRapport, factureDepuisRapport } from "../api/transformations";
import type { SaisieRapport } from "../domain/rapport";

export const clesRapports = {
  racine: (s: string) => ["rapports", s] as const,
  liste: (s: string) => ["rapports", s, "liste"] as const,
  fiche: (s: string, id: string) => ["rapports", s, "fiche", id] as const,
  bons: (s: string) => ["rapports", s, "bons"] as const,
  courriel: (s: string, client: string) => ["rapports", s, "courriel", client] as const,
};

export function useRapports() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRapports.liste(s.id), queryFn: () => listerRapports(s.id) });
}

export function useRapport(id: string | undefined) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRapports.fiche(s.id, id ?? ""), queryFn: () => lireRapport(id as string), enabled: !!id });
}

export function useBonsLiables() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRapports.bons(s.id), queryFn: () => bonsLiables(s.id) });
}

export function useCourrielClient(clientId: string | null) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRapports.courriel(s.id, clientId ?? ""), queryFn: () => courrielDuClient(clientId), enabled: !!clientId });
}

function useRecharger() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesRapports.racine(s.id) });
    void qc.invalidateQueries({ queryKey: ["devis", s.id] });
    void qc.invalidateQueries({ queryKey: ["factures", s.id] });
  };
}

export interface Enregistrement {
  saisie: SaisieRapport;
  photos: PhotoAEnregistrer[];
  signatures: Signatures;
  adresseClient: string | null;
}

export function useEnregistrerRapport(id: string | undefined) {
  const s = useSocieteActive();
  const recharger = useRecharger();
  return useMutation({ mutationFn: (e: Enregistrement) => enregistrerRapport(s.id, id ?? null, e.saisie, e.photos, e.signatures, e.adresseClient), onSettled: recharger });
}

export function useLierBon() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ rapportId, bcId }: { rapportId: string; bcId: string | null }) => lierBon(rapportId, bcId), onSettled: recharger });
}

export function useSupprimerRapport() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: (id: string) => supprimerRapport(id), onSettled: recharger });
}

export function useTransformer() {
  const s = useSocieteActive();
  const recharger = useRecharger();
  return useMutation({
    mutationFn: async ({ type, rapport }: { type: "devis" | "facture"; rapport: Rapport | string }) => {
      // Relu juste avant : un rapport qu'on vient d'enregistrer n'est pas encore dans la liste en cache.
      const r = typeof rapport === "string" ? (await lireRapport(rapport)).rapport : rapport;
      return type === "devis" ? devisDepuisRapport(s.id, r) : factureDepuisRapport(s.id, r);
    },
    onSettled: recharger,
  });
}
