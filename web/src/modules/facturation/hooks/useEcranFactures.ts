import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { usePermission, useSession, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { peut } from "@/modules/auth-roles/domain/permissions";
import { interlocuteursDeLaSociete, listerFacturesEcran, referencesDevis, referencesRapports, totauxDesFactures } from "../api/ecran";
import { droitsFacture, type DroitsFacture } from "../domain/actions";
import { FILTRES_VIDES, type EtatFiltres } from "../domain/filtresEcran";
import { clesFactures } from "./useFactures";

/** Sous la racine des factures : toute écriture qui invalide la liste invalide aussi l'écran. */
export const clesEcran = {
  factures: (s: string) => [...clesFactures.racine(s), "ecran"] as const,
  totaux: (s: string) => [...clesFactures.racine(s), "totaux"] as const,
  devis: (s: string) => [...clesFactures.racine(s), "refs-devis"] as const,
  rapports: (s: string) => [...clesFactures.racine(s), "refs-rapports"] as const,
  interlocuteurs: (s: string) => ["interlocuteurs-societe", s] as const,
};

export function useFacturesEcran() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesEcran.factures(s.id), queryFn: () => listerFacturesEcran(s.id) });
}
export function useTotauxFactures() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesEcran.totaux(s.id), queryFn: () => totauxDesFactures(s.id) });
}
export function useReferencesDevis() {
  const s = useSocieteActive();
  const voit = usePermission("devis");
  return useQuery({ queryKey: clesEcran.devis(s.id), queryFn: () => referencesDevis(s.id), enabled: voit });
}
export function useReferencesRapports() {
  const s = useSocieteActive();
  const voit = usePermission("rapports");
  return useQuery({ queryKey: clesEcran.rapports(s.id), queryFn: () => referencesRapports(s.id), enabled: voit });
}
export function useInterlocuteursSociete() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesEcran.interlocuteurs(s.id), queryFn: () => interlocuteursDeLaSociete(s.id) });
}

/** Les droits du rôle effectif sur une facture, résolus une fois pour toute la liste. */
export function useDroitsFacture(): DroitsFacture {
  const { etat, roleEffectif } = useSession();
  return useMemo(() => {
    if (etat.statut !== "connecte") return { modifier: false, creer: false, supprimer: false, emettre: false, imputerAvoir: false };
    return droitsFacture((m, a) => peut(etat.session.matrice, roleEffectif, m, a), roleEffectif);
  }, [etat, roleEffectif]);
}

/**
 * L'état des filtres de Facturation, PARTAGÉ par ses quatre vues le temps de
 * la session — comme `state.factureSearch` & cie : basculer de Factures à
 * À facturer conserve la lentille en cours.
 */
let filtres: EtatFiltres = FILTRES_VIDES;
const abonnes = new Set<() => void>();
function abonner(f: () => void) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
/** Repartir d'une barre vide : les essais, qui partagent le module, ne doivent pas hériter du filtre du précédent. */
export function oublierFiltresFacturation(): void {
  filtres = FILTRES_VIDES;
  abonnes.forEach((f) => f());
}

export function useFiltresFacturation(): [EtatFiltres, (maj: Partial<EtatFiltres> | null) => void] {
  const valeur = useSyncExternalStore(abonner, () => filtres);
  return [
    valeur,
    (maj) => {
      filtres = maj === null ? FILTRES_VIDES : { ...filtres, ...maj };
      abonnes.forEach((f) => f());
    },
  ];
}
