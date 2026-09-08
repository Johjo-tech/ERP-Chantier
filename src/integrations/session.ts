/**
 * Session applicative : sociétés accessibles et rôle effectif.
 *
 * L'app historique se contentait d'une liste de sociétés codée en dur et d'un
 * sélecteur de rôle libre — quiconque pouvait se déclarer administrateur.
 * Ici, les deux viennent de la base : la RLS décide des sociétés visibles et
 * `mon_role()` du rôle. La simulation de rôle reste possible, mais seulement
 * pour restreindre, et sans effet sur ce que la base autorise.
 */

import { signOut } from "@/api/client";
import * as queries from "@/api/queries";
import type { PlanningTache, Uuid } from "@/api/types";
import type { RoleMembre, Societe } from "@/api/types";
import { rechercherAdresse } from "./adresse";
import { rechercherEntreprise } from "./entreprise";
import { alertesDocument, alertesSalarie, alertesVehicule, trierAlertes } from "./alertes";
import { extraireBonCommande, rapprocherClient, versSaisieBonCommande } from "./ocr";
import {
  fusionnerReglages,
  LIBELLES_SEUILS,
  REGLAGES_DEFAUT,
  UNITES_DEFAUT,
} from "./reglages";
import { estRoleConnu, navAutorisee, peutSurNav, voitLesPrix } from "./permissions";
import type { Action, ModuleId } from "./permissions";
import { peut } from "./permissions";

export interface SocieteAccessible {
  /** Code court attendu par l'app (« kta »). */
  id: string;
  nom: string;
  uuid: Uuid;
  role: RoleMembre | null;
}

let societes: SocieteAccessible[] = [];
let societeCourante: SocieteAccessible | null = null;
/** Rôle choisi pour la simulation, jamais plus permissif que le rôle réel. */
let roleSimule: RoleMembre | null = null;

const CLE_SIMULATION = "erp.role.simule";

/** Charge les sociétés visibles et le rôle détenu dans chacune. */
export async function chargerSession(): Promise<SocieteAccessible[]> {
  const brutes: Societe[] = await queries.listMesSocietes();

  societes = await Promise.all(
    brutes.map(async (s) => ({
      id: s.code,
      nom: s.nom,
      uuid: s.id,
      role: await queries.monRole(s.id),
    }))
  );

  societeCourante = societes[0] ?? null;
  restaurerSimulation();
  return societes;
}

export function societesAccessibles(): SocieteAccessible[] {
  return societes;
}

export function societeActive(): SocieteAccessible | null {
  return societeCourante;
}

/** Bascule de société ; renvoie faux si l'utilisateur n'y a pas accès. */
export function choisirSociete(code: string): boolean {
  const trouvee = societes.find((s) => s.id === code);
  if (!trouvee) return false;
  societeCourante = trouvee;
  restaurerSimulation();
  return true;
}

/** Rôle réel dans la société active, tel que la base le donne. */
export function roleReel(): RoleMembre | null {
  return societeCourante?.role ?? null;
}

/** Rôle utilisé pour l'affichage : la simulation si elle restreint. */
export function roleEffectif(): RoleMembre | null {
  return roleSimule ?? roleReel();
}

/**
 * Simule un rôle pour visualiser l'application « comme si ».
 *
 * Réservé aux administrateurs et sans effet sur la base : la RLS continue de
 * s'appliquer avec le rôle réel. Toute autre valeur est refusée.
 */
export function simulerRole(role: RoleMembre | null): boolean {
  if (roleReel() !== "admin") return false;
  if (role !== null && !estRoleConnu(role)) return false;

  roleSimule = role;
  try {
    if (role) localStorage.setItem(CLE_SIMULATION, role);
    else localStorage.removeItem(CLE_SIMULATION);
  } catch {
    // Stockage indisponible : la simulation reste valable pour la session
  }
  return true;
}

function restaurerSimulation() {
  roleSimule = null;
  if (roleReel() !== "admin") return;
  try {
    const brut = localStorage.getItem(CLE_SIMULATION);
    if (estRoleConnu(brut)) roleSimule = brut;
  } catch {
    // ignoré
  }
}

// ============ DROITS, VUS PAR L'INTERFACE ============

export function autorise(module: ModuleId, action: Action = "voir"): boolean {
  return peut(roleEffectif(), module, action);
}

export function autoriseNav(nav: string, action: Action = "voir"): boolean {
  return peutSurNav(roleEffectif(), nav, action);
}

export function ongletsAutorises(navIds: string[]): string[] {
  return navAutorisee(roleEffectif(), navIds);
}

export function affichePrix(): boolean {
  return voitLesPrix(roleEffectif());
}

/** Identité affichée dans l'en-tête. */
let identite = "";

export function setIdentite(v: string) {
  identite = v;
}

export function utilisateurCourant(): string {
  return identite;
}

/** Déconnexion : la redirection est faite par `watchAuthState`. */
export async function seDeconnecter(): Promise<void> {
  await signOut();
}

// ============ CIRCUIT DE VALIDATION ============

/**
 * Retrouve la tâche de planning d'un bon de commande pour une date, ou la crée.
 *
 * Les cartes du planning représentent des bons de commande ; le circuit de
 * validation, lui, s'appuie sur `planning_taches`. On matérialise donc la tâche
 * au premier passage plutôt que d'imposer une double saisie.
 */
export async function tacheDuBonCommande(
  bcId: Uuid,
  date: string,
  libelle: string
): Promise<PlanningTache> {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active.");

  const taches = await queries.listTachesBonCommande(bcId);
  const existante = taches.find((t) => t.date_tache === date) ?? taches[0];
  if (existante) return existante;

  return queries.planifierTache(societe.uuid, {
    bon_commande_id: bcId,
    libelle,
    date_tache: date,
  });
}

export interface ActionsTache {
  peutSaisir: boolean;
  peutTerminer: boolean;
  peutArbitrer: boolean;
}

/**
 * Actions ouvertes sur une tâche, selon le rôle et l'état.
 *
 * Le rôle est un paramètre plutôt qu'une lecture implicite : c'est ce qui rend
 * la règle vérifiable sans monter une session.
 */
export function actionsTache(
  statut: string | null,
  role: RoleMembre | null = roleEffectif()
): ActionsTache {
  const estTerrain = role === "technicien" || role === "sous_traitant";
  const estEncadrant = role === "admin" || role === "conducteur" || role === "secretaire";

  return {
    // Tant que le conducteur n'a pas validé, le terrain peut corriger
    peutSaisir: (estTerrain || estEncadrant) && statut !== "validee",
    peutTerminer:
      (estTerrain || estEncadrant) && (statut === "planifiee" || statut === "refusee"),
    // Arbitrer son propre travail n'aurait pas de sens
    peutArbitrer: (role === "admin" || role === "conducteur") && statut === "realisee",
  };
}

/** Fonctions mises à disposition du HTML historique. */
export function injecterSession() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;

  w.societesAccessibles = societesAccessibles;
  w.societeActive = societeActive;
  w.choisirSociete = choisirSociete;
  w.roleReel = roleReel;
  w.roleEffectif = roleEffectif;
  w.simulerRole = simulerRole;
  w.autorise = autorise;
  w.autoriseNav = autoriseNav;
  w.ongletsAutorises = ongletsAutorises;
  w.affichePrix = affichePrix;
  w.utilisateurCourant = utilisateurCourant;
  w.seDeconnecter = seDeconnecter;

  // Annuaires publics
  w.rechercherAdresse = rechercherAdresse;

  // Circuit de validation des tâches
  w.tacheDuBonCommande = tacheDuBonCommande;
  w.actionsTache = actionsTache;
  w.sauvegarderTerrain = queries.sauvegarderTerrain;
  w.marquerRealisee = queries.marquerRealisee;
  w.validerTache = queries.validerTache;
  w.passerPretAChiffrer = queries.passerPretAChiffrer;
  w.listTachesBonCommande = queries.listTachesBonCommande;

  // Travaux constatés en plus du bon de commande
  w.listTravauxSupplementaires = queries.listTravauxSupplementaires;
  w.ajouterTravailSupplementaire = queries.ajouterTravailSupplementaire;
  w.supprimerTravailSupplementaire = queries.supprimerTravailSupplementaire;
  w.chiffrerTravailSupplementaire = queries.chiffrerTravailSupplementaire;
  w.rechercherEntreprise = rechercherEntreprise;

  // Lecture automatique des bons de commande
  w.extraireBonCommande = extraireBonCommande;
  w.versSaisieBonCommande = versSaisieBonCommande;
  w.rapprocherClient = rapprocherClient;

  // Alertes d'échéance, calées sur les colonnes réelles
  w.alertesVehicule = alertesVehicule;
  w.alertesSalarie = alertesSalarie;
  w.alertesDocument = alertesDocument;
  w.trierAlertes = trierAlertes;

  // Numérotation des documents
  w.SERIES_NUMEROTATION = queries.SERIES_NUMEROTATION;
  w.listCompteurs = queries.listCompteurs;
  w.reglerCompteur = queries.reglerCompteur;
  w.apercuNumero = queries.apercuNumero;

  // Réglages par société
  w.fusionnerReglages = fusionnerReglages;
  w.REGLAGES_DEFAUT = REGLAGES_DEFAUT;
  w.UNITES_DEFAUT = UNITES_DEFAUT;
  w.LIBELLES_SEUILS = LIBELLES_SEUILS;
}
