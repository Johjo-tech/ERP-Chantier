import { createContext, useContext } from "react";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import type { DonneesPlanning } from "../api/planning";
import type { CartePlanning } from "../domain/cartes";
import type { Affectation } from "../domain/filtres";
import type { Plan } from "../domain/planification";

/**
 * Ce que toutes les pièces du planning partagent : les données lues, les
 * droits d'affichage du rôle effectif, et les gestes (qui passent tous par
 * `appliquer`, pour que chaque refus s'affiche au même endroit).
 */
export interface ValeurPlanning {
  donnees: DonneesPlanning;
  cartes: CartePlanning[];
  role: RoleMembre | null;
  /** Poser, déplacer, régler : admin et conducteur (planning ET bons à modifier). */
  peutPlanifier: boolean;
  /** Tentatives de contact et rappel s'écrivent sur le bon (`bons_commande/modifier`). */
  peutContacter: boolean;
  voitPrix: boolean;
  affectation: Affectation;
  couleurMetier: (metier: string | null) => string | null;
  nomEquipe: (id: string | null) => string | null;
  nomSousTraitant: (id: string | null) => string | null;
  /** Calcule le plan (qui peut refuser), l'écrit, recharge, et dit ce qui s'est passé. */
  appliquer: (carte: CartePlanning, calcul: () => Plan, succes?: string) => void;
  ouvrirFiche: (carte: CartePlanning, jour: string | null) => void;
  poser: (carte: CartePlanning, jour: string, heure: string) => void;
  demanderDate: (carte: CartePlanning) => void;
  signaler: (message: string, erreur?: unknown) => void;
}

export const ContextePlanning = createContext<ValeurPlanning | null>(null);

export function usePlanningContexte(): ValeurPlanning {
  const v = useContext(ContextePlanning);
  if (!v) throw new Error("usePlanningContexte() hors de la page Planning.");
  return v;
}
