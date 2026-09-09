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
import {
  actionsTache as reglesActionsTache,
  prochainActeur as reglesProchainActeur,
  type ActionsTache,
} from "@/api/regles-taches";
import type { PlanningTache, Uuid } from "@/api/types";
import type { RoleMembre, Societe } from "@/api/types";
import { rechercherAdresse } from "./adresse";
import { rechercherEntreprise } from "./entreprise";
import {
  adresseElectroniqueParDefaut,
  cadreSuggere,
  CADRES_FACTURATION,
  identifiantsLegaux,
  mentionsLegales,
  completudeClient,
  completudeSociete,
  INDEMNITE_RECOUVREMENT_EUR,
  messageAnomalies,
  MENTION_FRANCHISE_EN_BASE,
  PAYS_DEFAUT,
  PERIODICITES_EREPORTING,
  REGIMES_TVA,
  sansTva,
  SCHEMAS_ADRESSE_ELECTRONIQUE,
  sectionsEfactureVisibles,
  sirenDuSiret,
  siretValide,
  tvaIntracomFr,
  verifierEntite,
} from "@/api/regles-efacture";
import { alertesDocument, alertesSalarie, alertesVehicule, trierAlertes } from "./alertes";
import { extraireBonCommande, rapprocherClient, versSaisieBonCommande } from "./ocr";
import {
  correspond,
  dansLaPeriode,
  dateDocument,
  filtrerDocuments,
  grouperParClient,
  lignesHaystack,
  multiWordMatch,
  sansAccents,
  texteDocument,
} from "./recherche";
import {
  fusionnerReglages,
  LIBELLES_SEUILS,
  REGLAGES_DEFAUT,
  UNITES_DEFAUT,
} from "./reglages";
import {
  blocagesChiffrage,
  blocagesValidationConducteur,
  messageBlocages,
} from "@/api/regles-bc";
import {
  badgeOrigine,
  comptesRendusTerrain,
  lignesDocumentDirecteur,
} from "./prefacture";
import { enrichirFactureX } from "./facturx-pont";
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

export type { ActionsTache };

/**
 * Ce que le rôle courant peut faire sur une tâche.
 *
 * La règle vit dans `regles-taches.ts`, partagée avec la couche d'accès : elle
 * était recopiée ici, et rien n'obligeait les deux versions à rester d'accord.
 * Ne subsiste ici que le défaut du rôle, qui suppose une session ouverte et ne
 * peut donc pas descendre dans un module feuille.
 */
export function actionsTache(
  statut: string | null,
  role: RoleMembre | null = roleEffectif()
): ActionsTache {
  return reglesActionsTache(statut, role);
}

/**
 * Annuaire des intervenants de la société active, indexé par identifiant.
 *
 * Chargé une fois : l'écran de validation le consulte pour chaque tâche, et
 * une requête par tâche serait absurde.
 */
let annuaire: Map<Uuid, { nom: string; role: RoleMembre | null }> | null = null;
/* La liste plate double la table d'index : l'écran RH doit proposer les comptes
   dans l'ordre pour rattacher un salarié au sien, ce qu'une Map ne garantit
   pas. */
let intervenants: { id: Uuid; nom: string; role: RoleMembre | null }[] = [];

export async function chargerIntervenants(): Promise<void> {
  const societe = societeActive();
  if (!societe) return;
  try {
    const liste = await queries.listIntervenants(societe.uuid);
    annuaire = new Map(liste.map((i) => [i.id, { nom: i.nom, role: i.role }]));
    // `nom` retombe déjà sur l'email quand le compte n'en porte pas.
    intervenants = [...liste].sort((a, b) => a.nom.localeCompare(b.nom));
  } catch (err) {
    console.error("Annuaire des intervenants indisponible", err);
    annuaire = new Map();
    intervenants = [];
  }
}

/** Les comptes de la société, pour les écrans qui doivent y rattacher quelqu'un. */
export function listeIntervenants() {
  return intervenants;
}

/** Nom lisible d'un intervenant ; son identifiant ne dit rien à personne. */
export function nomIntervenant(id: string | null | undefined): string {
  if (!id) return "";
  return annuaire?.get(id as Uuid)?.nom ?? "un utilisateur";
}

/** Qui doit agir à cette étape, en clair. Règle partagée, voir `regles-taches`. */
export const prochainActeur = reglesProchainActeur;

export interface ActionsFacturation {
  /** Chiffrer les travaux supplémentaires et valider la pré-facture. */
  peutValiderPrefacture: boolean;
  /** Reprendre la pré-facture avant émission. */
  peutModifierPrefacture: boolean;
  /** Émettre la facture. */
  peutFacturer: boolean;
}

/**
 * La validation de la pré-facture engage le montant facturé : elle revient au
 * seul administrateur. La secrétaire reprend ensuite le document et l'émet.
 */
export function actionsFacturation(
  role: RoleMembre | null = roleEffectif()
): ActionsFacturation {
  return {
    peutValiderPrefacture: role === "admin",
    peutModifierPrefacture: role === "admin" || role === "secretaire",
    peutFacturer: role === "admin" || role === "secretaire",
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
  w.actionsFacturation = actionsFacturation;
  // Recherche et filtrage : une seule définition pour tous les écrans
  w.sansAccents = sansAccents;
  w.multiWordMatch = multiWordMatch;
  w.lignesHaystack = lignesHaystack;
  w.texteDocument = texteDocument;
  w.correspond = correspond;
  w.dateDocument = dateDocument;
  w.dansLaPeriode = dansLaPeriode;
  w.filtrerDocuments = filtrerDocuments;
  w.grouperParClient = grouperParClient;

  w.chargerIntervenants = chargerIntervenants;
  w.nomIntervenant = nomIntervenant;
  w.listeIntervenants = listeIntervenants;
  w.prochainActeur = prochainActeur;
  w.validerPrefacture = queries.validerPrefacture;
  w.pdfFacturX = enrichirFactureX;
  w.validerChiffrage = queries.validerChiffrage;
  w.validerAffaireConducteur = queries.validerAffaireConducteur;
  w.emettreFacture = queries.emettreFacture;
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

  // Validation directeur : ce qui bloque, et le document qui le montre
  w.blocagesChiffrage = blocagesChiffrage;
  w.blocagesValidationConducteur = blocagesValidationConducteur;
  w.messageBlocages = messageBlocages;
  w.lignesDocumentDirecteur = lignesDocumentDirecteur;
  w.comptesRendusTerrain = comptesRendusTerrain;
  w.badgeOrigine = badgeOrigine;

  w.rechercherEntreprise = rechercherEntreprise;

  // Facturation électronique : ce qui est mal formé, et ce qui manquera à l'émission
  w.verifierEntite = verifierEntite;
  w.completudeClient = completudeClient;
  w.completudeSociete = completudeSociete;
  w.messageAnomalies = messageAnomalies;
  w.tvaIntracomFr = tvaIntracomFr;
  w.sirenDuSiret = sirenDuSiret;
  w.siretValide = siretValide;
  w.adresseElectroniqueParDefaut = adresseElectroniqueParDefaut;
  w.cadreSuggere = cadreSuggere;
  w.sectionsEfactureVisibles = sectionsEfactureVisibles;
  w.CADRES_FACTURATION = CADRES_FACTURATION;
  w.SCHEMAS_ADRESSE_ELECTRONIQUE = SCHEMAS_ADRESSE_ELECTRONIQUE;
  w.REGIMES_TVA = REGIMES_TVA;
  w.PERIODICITES_EREPORTING = PERIODICITES_EREPORTING;
  w.sansTva = sansTva;
  w.MENTION_FRANCHISE_EN_BASE = MENTION_FRANCHISE_EN_BASE;
  w.mentionsLegales = mentionsLegales;
  w.identifiantsLegaux = identifiantsLegaux;
  w.INDEMNITE_RECOUVREMENT_EUR = INDEMNITE_RECOUVREMENT_EUR;
  w.PAYS_DEFAUT = PAYS_DEFAUT;

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
