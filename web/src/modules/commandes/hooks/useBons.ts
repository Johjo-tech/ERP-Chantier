import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { enregistrerBcRecu, enregistrerBon, genererFacture, lireBon, listerBons } from "../api/bons";
import { listerPieces, marquerCommandee, pieceRecue } from "../api/pieces";
import type { EnteteAEnregistrer } from "../domain/bon";

export const clesBons = {
  racine: (s: string) => ["bons-commande", s] as const,
  liste: (s: string) => ["bons-commande", s, "liste"] as const,
  pieces: (s: string) => ["bons-commande", s, "pieces"] as const,
  fiche: (s: string, id: string) => ["bons-commande", s, "fiche", id] as const,
};

export function useBons() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesBons.liste(s.id), queryFn: () => listerBons(s.id) });
}

export function useBon(id: string | undefined) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesBons.fiche(s.id, id ?? ""), queryFn: () => lireBon(id as string), enabled: !!id });
}

export function usePieces() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesBons.pieces(s.id), queryFn: () => listerPieces(s.id) });
}

/**
 * Tout geste sur un bon ou ses tâches recharge TOUTE la collection : les
 * champs du circuit se dérivent des tâches au chargement, et un cache partiel
 * ferait mentir l'écran (BC-70).
 */
function useRecharger() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesBons.racine(s.id) });
    void qc.invalidateQueries({ queryKey: ["factures", s.id] });
  };
}

export function useEnregistrerBon(id: string | undefined) {
  const s = useSocieteActive();
  const recharger = useRecharger();
  return useMutation({
    mutationFn: ({ entete, lignes }: { entete: EnteteAEnregistrer; lignes: LigneAEnregistrer[] }) => enregistrerBon(s.id, id ?? null, entete, lignes),
    onSettled: recharger,
  });
}

export function useBcRecu() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ id, numero }: { id: string; numero: string }) => enregistrerBcRecu(id, numero), onSettled: recharger });
}

export function useGenererFacture() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: (id: string) => genererFacture(id), onSettled: recharger });
}

export function useMarquerCommandee() {
  const recharger = useRecharger();
  return useMutation({
    mutationFn: ({ bonId, date, fournisseur }: { bonId: string; date: string; fournisseur: string | null }) => marquerCommandee(bonId, { date, fournisseur }),
    onSettled: recharger,
  });
}

export function usePieceRecue() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: (bonId: string) => pieceRecue(bonId), onSettled: recharger });
}
