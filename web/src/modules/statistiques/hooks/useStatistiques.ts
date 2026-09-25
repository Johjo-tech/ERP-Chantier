import { useQuery } from "@tanstack/react-query";
import { useSession, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { bonsDuConducteur, maFicheConducteur } from "../api/conducteur";
import { lireActivite, lireCaParEquipe, lireCaParMois, lireIndicateurs, lireParClient, lireParConducteur, lireParMetier } from "../api/statistiques";
import type { Bornes } from "../domain/periodes";

/**
 * Les agrégats ne vieillissent pas à la seconde : une minute de fraîcheur évite
 * de relancer toutes les fonctions à chaque retour sur l'accueil.
 */
const FRAICHEUR_MS = 60_000;

export const clesStatistiques = {
  racine: (s: string) => ["statistiques", s] as const,
  indicateurs: (s: string, jour: string) => ["statistiques", s, "indicateurs", jour] as const,
  caParMois: (s: string, b: Bornes) => ["statistiques", s, "ca-mois", b.du, b.au] as const,
  activite: (s: string, n: number) => ["statistiques", s, "activite", n] as const,
  clients: (s: string, b: Bornes, n: number | null) => ["statistiques", s, "clients", b.du, b.au, n] as const,
  conducteurs: (s: string, b: Bornes, jour: string) => ["statistiques", s, "conducteurs", b.du, b.au, jour] as const,
  metiers: (s: string, b: Bornes, jour: string) => ["statistiques", s, "metiers", b.du, b.au, jour] as const,
  equipes: (s: string, b: Bornes) => ["statistiques", s, "equipes", b.du, b.au] as const,
  maFiche: (s: string, u: string) => ["statistiques", s, "ma-fiche", u] as const,
  bonsConducteur: (s: string, c: string | null) => ["statistiques", s, "bons-conducteur", c] as const,
};

export function useIndicateurs(jour: string) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.indicateurs(s.id, jour), queryFn: () => lireIndicateurs(s.id, jour), staleTime: FRAICHEUR_MS });
}

/** `actif` à faux tant que la période n'est pas choisie (plage personnalisée incomplète). */
export function useCaParMois(b: Bornes, actif = true) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.caParMois(s.id, b), queryFn: () => lireCaParMois(s.id, b), staleTime: FRAICHEUR_MS, enabled: actif });
}

export function useActivite(limite: number) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.activite(s.id, limite), queryFn: () => lireActivite(s.id, limite), staleTime: FRAICHEUR_MS });
}

export function useParClient(b: Bornes, limite: number | null) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.clients(s.id, b, limite), queryFn: () => lireParClient(s.id, b, limite), staleTime: FRAICHEUR_MS });
}

export function useParConducteur(b: Bornes, jour: string) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.conducteurs(s.id, b, jour), queryFn: () => lireParConducteur(s.id, b, jour), staleTime: FRAICHEUR_MS });
}

export function useParMetier(b: Bornes, jour: string) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.metiers(s.id, b, jour), queryFn: () => lireParMetier(s.id, b, jour), staleTime: FRAICHEUR_MS });
}

export function useCaParEquipe(b: Bornes) {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesStatistiques.equipes(s.id, b), queryFn: () => lireCaParEquipe(s.id, b), staleTime: FRAICHEUR_MS });
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
