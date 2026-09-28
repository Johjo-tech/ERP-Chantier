import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSession, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { BonDeLaListe } from "@/modules/commandes/api/bons";
import { useBons } from "@/modules/commandes/hooks/useBons";
import { useSoldes } from "@/modules/facturation/hooks/useFactures";
import type { DevisStats, FactureStats, RapportStats, ReglementStats, SoldeStats } from "../domain/pieces";
import type { BonStats, EquipeStats, FicheConducteur, TacheStats, TravailStats } from "../domain/statistiques";
import type { BonPilotage } from "../domain/tableau";
import { lireBons, lireConducteurs, lireDevis, lireEquipes, lireFactures, lireRapports, lireReglements, lireTaches, lireTravaux } from "../api/collections";
import { bonsDuConducteur, maFicheConducteur } from "../api/conducteur";

/**
 * Les collections ne vieillissent pas à la seconde : une minute de fraîcheur
 * évite de tout relire à chaque retour sur l'accueil.
 */
const FRAICHEUR_MS = 60_000;

export const clesStatistiques = {
  racine: (s: string) => ["statistiques", s] as const,
  factures: (s: string) => ["statistiques", s, "factures"] as const,
  devis: (s: string) => ["statistiques", s, "devis"] as const,
  reglements: (s: string) => ["statistiques", s, "reglements"] as const,
  rapports: (s: string) => ["statistiques", s, "rapports"] as const,
  bons: (s: string) => ["statistiques", s, "bons"] as const,
  conducteurs: (s: string) => ["statistiques", s, "conducteurs"] as const,
  equipes: (s: string) => ["statistiques", s, "equipes"] as const,
  taches: (s: string) => ["statistiques", s, "taches"] as const,
  travaux: (s: string) => ["statistiques", s, "travaux"] as const,
  maFiche: (s: string, u: string) => ["statistiques", s, "ma-fiche", u] as const,
  bonsConducteur: (s: string, c: string | null) => ["statistiques", s, "bons-conducteur", c] as const,
};

export function useFacturesStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.factures(s.id), queryFn: () => lireFactures(s.id), staleTime: FRAICHEUR_MS });
}

export function useDevisStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.devis(s.id), queryFn: () => lireDevis(s.id), staleTime: FRAICHEUR_MS });
}

export function useReglementsStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.reglements(s.id), queryFn: () => lireReglements(s.id), staleTime: FRAICHEUR_MS });
}

export function useRapportsStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.rapports(s.id), queryFn: () => lireRapports(s.id), staleTime: FRAICHEUR_MS });
}

export function useBonsStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.bons(s.id), queryFn: () => lireBons(s.id), staleTime: FRAICHEUR_MS });
}

export function useConducteursStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.conducteurs(s.id), queryFn: () => lireConducteurs(s.id), staleTime: FRAICHEUR_MS });
}

export function useEquipesStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.equipes(s.id), queryFn: () => lireEquipes(s.id), staleTime: FRAICHEUR_MS });
}

export function useTachesStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.taches(s.id), queryFn: () => lireTaches(s.id), staleTime: FRAICHEUR_MS });
}

export function useTravauxStats() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.travaux(s.id), queryFn: () => lireTravaux(s.id), staleTime: FRAICHEUR_MS });
}

/** La fiche conducteur du compte connecté, puis ses affaires (toutes celles de la société sans fiche). */
export function useTableauConducteur() {
  const s = useSocieteActive();
  const { etat } = useSession();
  const utilisateurId = etat.statut === "connecte" ? etat.session.utilisateur.id : "";
  const fiche = useQuery({ queryKey: clesStatistiques.maFiche(s.id, utilisateurId), queryFn: () => maFicheConducteur(s.id, utilisateurId), enabled: !!utilisateurId });
  const conducteurId = fiche.data?.id ?? null;
  const bons = useQuery({
    queryKey: clesStatistiques.bonsConducteur(s.id, conducteurId),
    queryFn: () => bonsDuConducteur(s.id, conducteurId),
    enabled: fiche.isSuccess,
  });
  return { fiche, bons };
}

/** Plusieurs lectures vues comme une : prêtes ensemble, la première erreur dite, un seul « Réessayer ». */
function ensemble<T>(requetes: readonly UseQueryResult<unknown>[], donnees: () => T | null) {
  const echec = requetes.find((q) => q.isError);
  return {
    donnees: requetes.every((q) => q.isSuccess) ? donnees() : null,
    erreur: echec ? echec.error : null,
    reessayer: () => requetes.forEach((q) => void q.refetch()),
  };
}

/** Le bon de la liste des commandes, vu comme l'ancien pont le reconstituait pour « À traiter ». */
function bonPilotage(b: BonDeLaListe): BonPilotage {
  return {
    id: b.id,
    statut_workflow: b.statut_workflow,
    bon_commande_parent_id: b.bon_commande_parent_id,
    rappel_date: b.rappel_date,
    valideConducteur: b.circuit.valideConducteur,
    valideDirecteur: b.circuit.valideDirecteur,
    lignes: b.lignesMontant ?? [],
  };
}

export interface DonneesPilotage {
  factures: FactureStats[];
  devis: DevisStats[];
  reglements: ReglementStats[];
  rapports: RapportStats[];
  bons: BonPilotage[];
  /** Le solde de chaque pièce, calculé par la base : le même cache que l'écran des factures. */
  soldes: SoldeStats[];
}

/** Ce que lit le pilotage : pièces, règlements, rapports, bons, et le solde de la base. */
export function useDonneesPilotage() {
  const factures = useFacturesStats();
  const devis = useDevisStats();
  const reglements = useReglementsStats();
  const rapports = useRapportsStats();
  const bons = useBons();
  const soldes = useSoldes();
  return ensemble<DonneesPilotage>([factures, devis, reglements, rapports, bons, soldes], () => ({
    factures: factures.data ?? [],
    devis: devis.data ?? [],
    reglements: reglements.data ?? [],
    rapports: rapports.data ?? [],
    bons: (bons.data ?? []).map(bonPilotage),
    soldes: soldes.data ?? [],
  }));
}

export interface DonneesStatistiques {
  factures: FactureStats[];
  devis: DevisStats[];
  bons: BonStats[];
  conducteurs: FicheConducteur[];
  equipes: EquipeStats[];
  taches: TacheStats[];
  travaux: TravailStats[];
}

/** Ce que lit l'écran Statistiques. */
export function useDonneesStatistiques() {
  const factures = useFacturesStats();
  const devis = useDevisStats();
  const bons = useBonsStats();
  const conducteurs = useConducteursStats();
  const equipes = useEquipesStats();
  const taches = useTachesStats();
  const travaux = useTravauxStats();
  return ensemble<DonneesStatistiques>([factures, devis, bons, conducteurs, equipes, taches, travaux], () => ({
    factures: factures.data ?? [],
    devis: devis.data ?? [],
    bons: bons.data ?? [],
    conducteurs: conducteurs.data ?? [],
    equipes: equipes.data ?? [],
    taches: taches.data ?? [],
    travaux: travaux.data ?? [],
  }));
}
