import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSession, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { clesBons } from "@/modules/commandes/hooks/useBons";
import {
  ajouterPhoto,
  ajouterTravailSupplementaire,
  appliquerPlan,
  enregistrerMontantSousTraitant,
  enregistrerRappel,
  enregistrerTentatives,
  lignesDuBon,
  lirePlanning,
  marquerRealisee,
  photosDuBon,
  sauvegarderTerrain,
  supprimerPhoto,
  travauxSupplementaires,
  validerTache,
  type Constats,
  type NouveauTravail,
  type PhotoTerrain,
} from "../api/planning";
import { construireCartes, trierCommeLAncien, type Tentative } from "../domain/cartes";
import type { Plan } from "../domain/planification";

export const clesPlanning = {
  racine: (s: string) => ["planning", s] as const,
  donnees: (s: string, u: string) => ["planning", s, "donnees", u] as const,
  lignes: (s: string, bc: string) => ["planning", s, "lignes", bc] as const,
  travaux: (s: string, bc: string) => ["planning", s, "travaux", bc] as const,
  photos: (s: string, bc: string) => ["planning", s, "photos", bc] as const,
};

function useUtilisateurId(): string {
  const { etat } = useSession();
  return etat.statut === "connecte" ? etat.session.utilisateur.id : "";
}

/** Tout le planning de la société, et ses cartes (bon × métier). */
export function usePlanning() {
  const s = useSocieteActive();
  const utilisateurId = useUtilisateurId();
  const requete = useQuery({ queryKey: clesPlanning.donnees(s.id, utilisateurId), queryFn: () => lirePlanning(s.id, utilisateurId) });
  const cartes = useMemo(() => (requete.data ? trierCommeLAncien(construireCartes(requete.data.bons, requete.data.taches, requete.data)) : []), [requete.data]);
  return { ...requete, cartes };
}

/**
 * Tout geste recharge le planning ET les bons : le circuit d'un bon se dérive
 * de ses tâches à la lecture, un cache partiel ferait mentir Facturation ›
 * Validation (CLAUDE.md racine, BC-70). Rechargé aussi après un échec : l'écran
 * montre ce que la base a réellement gardé (PLN-04).
 */
function useRecharger() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesPlanning.racine(s.id) });
    void qc.invalidateQueries({ queryKey: clesBons.racine(s.id) });
  };
}

export function useAppliquerPlan() {
  const s = useSocieteActive();
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ bcId, plan }: { bcId: string; plan: Plan }) => appliquerPlan(s.id, bcId, plan), onSettled: recharger });
}

export function useSauvegarderTerrain() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ tacheId, constats }: { tacheId: string; constats: Constats }) => sauvegarderTerrain(tacheId, constats), onSettled: recharger });
}

/** « Travaux terminés » : les constats d'abord — ils seraient perdus au changement d'état — puis la déclaration. */
export function useMarquerRealisee() {
  const recharger = useRecharger();
  return useMutation({
    mutationFn: async ({ tacheId, constats }: { tacheId: string; constats: Constats }) => {
      await sauvegarderTerrain(tacheId, constats);
      await marquerRealisee(tacheId, constats.commentaire);
    },
    onSettled: recharger,
  });
}

export function useValiderTache() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ tacheId, ok, motif }: { tacheId: string; ok: boolean; motif: string | null }) => validerTache(tacheId, ok, motif), onSettled: recharger });
}

export function useLignesDuBon(bcId: string) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesPlanning.lignes(s.id, bcId), queryFn: () => lignesDuBon(bcId) });
}

export function useTravauxSupplementaires(bcId: string, active: boolean) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesPlanning.travaux(s.id, bcId), queryFn: () => travauxSupplementaires(bcId), enabled: active });
}

export function useAjouterTravail() {
  const s = useSocieteActive();
  const utilisateurId = useUtilisateurId();
  const recharger = useRecharger();
  return useMutation({ mutationFn: (t: NouveauTravail) => ajouterTravailSupplementaire(s.id, utilisateurId, t), onSettled: recharger });
}

export function useContacts() {
  const recharger = useRecharger();
  return {
    tentatives: useMutation({ mutationFn: ({ bcId, tentatives }: { bcId: string; tentatives: Tentative[] }) => enregistrerTentatives(bcId, tentatives), onSettled: recharger }),
    rappel: useMutation({ mutationFn: ({ bcId, date }: { bcId: string; date: string | null }) => enregistrerRappel(bcId, date), onSettled: recharger }),
  };
}

export function useMontantSousTraitant() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ bcId, valeur }: { bcId: string; valeur: string | null }) => enregistrerMontantSousTraitant(bcId, valeur), onSettled: recharger });
}

export function usePhotosDuBon(bcId: string) {
  const s = useSocieteActive();
  const qc = useQueryClient();
  const cle = clesPlanning.photos(s.id, bcId);
  const liste = useQuery({ queryKey: cle, queryFn: () => photosDuBon(bcId) });
  const rafraichir = () => void qc.invalidateQueries({ queryKey: cle });
  const ajouter = useMutation({ mutationFn: ({ fichier, position }: { fichier: Blob; position: number }) => ajouterPhoto(s.id, bcId, fichier, position), onSettled: rafraichir });
  const retirer = useMutation({ mutationFn: (photo: PhotoTerrain) => supprimerPhoto(photo), onSettled: rafraichir });
  return { liste, ajouter, retirer };
}
