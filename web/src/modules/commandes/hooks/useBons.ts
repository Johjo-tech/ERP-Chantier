import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { todayISO } from "@/lib/dates";
import { useSession, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { ecrireContacts, EnregistrementPartiel, enregistrerBcRecu, enregistrerBon, genererFacture, lireBon, listerBons } from "../api/bons";
import { messageErreur } from "@/lib/erreurs";
import {
  ajouterTravail,
  arbitrerTache,
  chiffrerTravail,
  cloturerGratuit,
  creerTachesManquantes,
  enregistrerPrix,
  journalDuBon,
  listerTaches,
  listerTravaux,
  marquerRealisee,
  supprimerTravail,
  validerAffaireConducteur,
  validerPrefacture,
  type ChiffrageDirecteur,
} from "../api/circuit";
import { creerSav, listerPhotos, remplacerPieceJointe, urlPieceJointe, DUREE_URL_SIGNEE_S } from "../api/documents";
import { listerMetiersDeclares } from "../api/metiers";
import { listerPieces, marquerCommandee, pieceRecue } from "../api/pieces";
import type { EnteteAEnregistrer, EnteteBon } from "../domain/bon";
import { origineDuTravail } from "../domain/circuit";
import { metiersDuBon, referentielMetiers } from "../domain/metiers";
import type { TacheBon } from "../domain/workflow";

export const clesBons = {
  racine: (s: string) => ["bons-commande", s] as const,
  liste: (s: string) => ["bons-commande", s, "liste"] as const,
  pieces: (s: string) => ["bons-commande", s, "pieces"] as const,
  fiche: (s: string, id: string) => ["bons-commande", s, "fiche", id] as const,
  taches: (s: string, id: string) => ["bons-commande", s, "taches", id] as const,
  travaux: (s: string, id: string) => ["bons-commande", s, "travaux", id] as const,
  photos: (s: string, id: string) => ["bons-commande", s, "photos", id] as const,
  journal: (s: string, id: string) => ["bons-commande", s, "journal", id] as const,
  metiers: (s: string) => ["metiers", s] as const,
  url: (chemin: string) => ["piece-jointe", chemin] as const,
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

export function useTaches(bonId: string | undefined) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesBons.taches(s.id, bonId ?? ""), queryFn: () => listerTaches(bonId as string), enabled: !!bonId });
}

export function useTravaux(bonId: string | undefined) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesBons.travaux(s.id, bonId ?? ""), queryFn: () => listerTravaux(bonId as string), enabled: !!bonId });
}

export function usePhotos(bonId: string | undefined) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesBons.photos(s.id, bonId ?? ""), queryFn: () => listerPhotos(bonId as string), enabled: !!bonId });
}

export function useJournal(bonId: string | undefined) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesBons.journal(s.id, bonId ?? ""), queryFn: () => journalDuBon(bonId as string), enabled: !!bonId });
}

/** L'URL signée, demandée UNE fois par chemin et gardée moins longtemps qu'elle ne vaut (BC-73). */
export function useUrlPieceJointe(chemin: string | null) {
  const MARGE = 0.8;
  return useQuery({ queryKey: clesBons.url(chemin ?? ""), queryFn: () => urlPieceJointe(chemin as string), enabled: !!chemin, staleTime: DUREE_URL_SIGNEE_S * 1000 * MARGE });
}

/** Les métiers proposés : déclarés + employés sur les bons de la société (BC-54). */
export function useMetiersDisponibles(): string[] {
  const s = useSocieteActive();
  const declares = useQuery({ queryKey: clesBons.metiers(s.id), queryFn: () => listerMetiersDeclares(s.id) });
  const bons = useBons();
  return referentielMetiers(declares.data ?? [], (bons.data ?? []).flatMap((b) => metiersDuBon(b)));
}

/**
 * Tout geste sur un bon ou ses tâches recharge TOUTE la collection : les
 * champs du circuit se dérivent des tâches au chargement, et un cache partiel
 * ferait mentir l'écran (BC-70). La promesse rendue attend la relecture : qui
 * enchaîne sur un succès lit déjà l'état de la base.
 */
function useRecharger() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: clesBons.racine(s.id) }), qc.invalidateQueries({ queryKey: ["factures", s.id] })]);
}

export interface EnregistrementBon {
  entete: EnteteAEnregistrer;
  lignes: LigneAEnregistrer[];
  /** `undefined` : ne pas toucher au document ; `null` : le retirer ; un fichier : le remplacer. */
  pieceJointe?: File | null;
  /** Le chemin actuel, pour effacer l'ancien fichier après remplacement. */
  pieceJointeActuelle?: string | null;
}

export function useEnregistrerBon(id: string | undefined) {
  const s = useSocieteActive();
  const recharger = useRecharger();
  return useMutation({
    mutationFn: async ({ entete, lignes, pieceJointe, pieceJointeActuelle = null }: EnregistrementBon) => {
      const bonId = await enregistrerBon(s.id, id ?? null, entete, lignes);
      // Après le bon, jamais avant : le chemin de stockage porte son uuid, qui n'existe qu'une fois le bon créé.
      if (pieceJointe === undefined) return bonId;
      try {
        await remplacerPieceJointe({ id: bonId, societe_id: s.id, piece_jointe_chemin: pieceJointeActuelle }, pieceJointe);
      } catch (cause) {
        // Le bon existe déjà : le dire, et y conduire, plutôt que de laisser recréer un doublon.
        throw new EnregistrementPartiel(bonId, cause, `Le bon est enregistré, mais pas sa pièce jointe : ${messageErreur(cause)}`);
      }
      return bonId;
    },
    onSettled: recharger,
  });
}

export function useBcRecu() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ id, numero }: { id: string; numero: string }) => enregistrerBcRecu(id, numero), onSettled: recharger });
}

export function useContacts() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ id, contacts }: { id: string; contacts: Parameters<typeof ecrireContacts>[1] }) => ecrireContacts(id, contacts), onSettled: recharger });
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

// ---------- Circuit ----------

export function useCreerTaches() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ bon, existantes }: { bon: EnteteBon; existantes: readonly TacheBon[] }) => creerTachesManquantes(bon, existantes), onSettled: recharger });
}

export function useMarquerRealisee() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ tacheId, commentaire }: { tacheId: string; commentaire: string | null }) => marquerRealisee(tacheId, commentaire), onSettled: recharger });
}

export function useArbitrerTache() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ tacheId, ok, motif }: { tacheId: string; ok: boolean; motif: string | null }) => arbitrerTache(tacheId, ok, motif), onSettled: recharger });
}

export function useValiderConducteur() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: (bon: EnteteBon) => validerAffaireConducteur(bon), onSettled: recharger });
}

export function useAjouterTravail() {
  const s = useSocieteActive();
  const { roleEffectif } = useSession();
  const recharger = useRecharger();
  return useMutation({
    mutationFn: ({ bonId, tacheId, libelle }: { bonId: string; tacheId: string | null; libelle: string }) =>
      ajouterTravail({ societeId: s.id, bonId, tacheId, libelle, origine: origineDuTravail(roleEffectif) }),
    onSettled: recharger,
  });
}

export function useSupprimerTravail() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: (id: string) => supprimerTravail(id), onSettled: recharger });
}

export function useChiffrerTravail() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ id, prix, quantite, unite }: { id: string; prix: number; quantite: number; unite: string }) => chiffrerTravail(id, { prix, quantite, unite }), onSettled: recharger });
}

export function useValiderPrefacture() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: (c: ChiffrageDirecteur) => validerPrefacture(c), onSettled: recharger });
}

export function useEnregistrerPrix() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: (c: Pick<ChiffrageDirecteur, "bonId" | "lignes" | "montant" | "prix">) => enregistrerPrix(c), onSettled: recharger });
}

export function useCloturerGratuit() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ bonId, motif }: { bonId: string; motif: string | null }) => cloturerGratuit(bonId, motif), onSettled: recharger });
}

export function useCreerSav() {
  const recharger = useRecharger();
  return useMutation({ mutationFn: ({ origine, probleme, photos }: { origine: EnteteBon; probleme: string | null; photos: File[] }) => creerSav(origine, probleme, photos, todayISO()), onSettled: recharger });
}
