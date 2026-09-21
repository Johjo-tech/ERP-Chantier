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
  motifLectureSeule as reglesMotifLectureSeule,
  prochainActeur as reglesProchainActeur,
  type ActionsTache,
  type AppartenanceTache,
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
  estSociete,
  dateEcheance,
  delaiHorsPlafond,
  DELAIS_PREREGLES,
  delaiPreregle,
  delaiDeLaCle,
  MODES_REGLEMENT,
  MODE_REGLEMENT_DEFAUT,
  modeReglementRetenu,
  delaiPaiementRetenu,
  INDEMNITE_RECOUVREMENT_EUR,
  libelleDelaiPaiement,
  messageAnomalies,
  MENTION_FRANCHISE_EN_BASE,
  PAYS_DEFAUT,
  PERIODICITES_EREPORTING,
  recommandationsSociete,
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
import { apercuDe, urlApercuPdf, verifierPieceJointe } from "@/api/regles-piece-jointe";
import { ACCENT_DEFAUT, paletteAccent } from "@/api/regles-theme";
import {
  avoirDisponible,
  estAvoir,
  libelleDocument,
  montantImputable,
  MOTIFS_AVOIR,
  refusAvoir,
  refusImputationAvoir,
  resteAImputer,
  statutImputation,
  signeDocument,
  totauxSignes,
} from "@/api/regles-avoir";
import {
  formaterTaux,
  montantLigneHt,
  montantLigneTtc,
  soldeAPayer,
  sousTotauxChapitres,
  totauxDocument,
  ventilationTvaAffichage,
} from "@/api/regles-totaux";
import {
  arrondiCentime,
  montantPropose,
  refusReglement,
  resteAPayer,
  statutEnBase,
  statutReglement,
  totalRegle,
  imputer,
  surplusImputation,
  refusImputation,
} from "@/api/regles-reglements";
import { extraireBonCommande, preparer, rapprocherClient, versSaisieBonCommande } from "./ocr";
import { urlPieceJointe, urlTelechargementPieceJointe } from "./pieces-jointes";
import {
  ajouterDocumentRh,
  chargerDocumentsRh,
  majDocumentRh,
  ouvrirDocumentRh,
  purgerDocumentsRh,
  supprimerDocumentRh,
} from "./documents-rh";
import {
  TYPES_DOCUMENT_RH,
  dossierSalarie,
  etatDocumentRh,
  libelleDocumentRh,
  trierDocumentsRh,
  typeDocumentRh,
} from "@/api/regles-documents-rh";
import {
  ajouterVisiteMedicale,
  chargerVisitesMedicales,
  majVisiteMedicale,
  ouvrirAttestationVisite,
  purgerVisitesMedicales,
  supprimerVisiteMedicale,
} from "./visites-medicales";
import {
  AVIS_APTITUDE,
  REGIMES_SUIVI,
  TYPES_VISITE,
  avisAptitude,
  depasseLePlafondLegal,
  derniereVisite,
  etatVisite,
  libelleAvis,
  prochaineVisiteSuggeree,
  regimeSuivi,
  trierVisites,
  typeVisite,
} from "@/api/regles-visite-medicale";
import {
  annulerInvitation,
  chargerInvitations,
  inviterSalarie,
} from "./invitations";
import {
  attenteAnnoncee,
  etatAnnule,
  etatDelaiDepasse,
  etatEchec,
  etatLecture,
  formaterDuree,
} from "@/api/regles-ocr";
import {
  correspond,
  dansLaPeriode,
  correspondFiche,
  dateDocument,
  filtrerDocuments,
  grouperParClient,
  lignesHaystack,
  multiWordMatch,
  sansAccents,
  texteDocument,
  texteFiche,
} from "./recherche";
import {
  fusionnerReglages,
  LIBELLES_SEUILS,
  REGLAGES_DEFAUT,
  UNITES_DEFAUT,
} from "./reglages";
import {
  attenteAvantChiffrage,
  blocagesChiffrage,
  blocagesValidationConducteur,
  etapeValidation,
  lieuIntervention,
  manquesBonCommande,
  messageBlocages,
  refBonCommandeClient,
} from "@/api/regles-bc";
import {
  memeMetier,
  metierDuChapitre,
  metiersDesChapitres,
  referentielMetiers,
  travauxDeLaCarte,
  travauxParMetier,
} from "@/api/regles-metiers";
import {
  badgeOrigine,
  comptesRendusTerrain,
  lignesDocumentDirecteur,
} from "./prefacture";
import { enrichirFactureX, etatConnexionPdp, transmettre } from "./facturx-pont";
import {
  estRoleConnu,
  installerMatrice,
  navAutorisee,
  peutSurNav,
  voitLesPrix,
} from "./permissions";
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

/** Charge la matrice des droits, les sociétés visibles et le rôle détenu. */
export async function chargerSession(): Promise<SocieteAccessible[]> {
  /* La matrice d'abord, et sans rattrapage : tout l'affichage s'y réfère, et
     une application qui ne sait pas ce qui est permis ne doit pas se rendre.
     L'erreur remonte jusqu'à l'écran « Application indisponible ». */
  installerMatrice(await queries.listRolePermissions());

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

/** Identifiant du compte connecté : c'est par lui qu'on retrouve son équipe. */
let compteId: Uuid | null = null;

export function setIdentite(v: string, id?: string | null) {
  identite = v;
  compteId = (id as Uuid) ?? null;
}

export function utilisateurCourant(): string {
  return identite;
}

/**
 * Le compte connecté, tel que `planning_taches.realisee_par` l'enregistre.
 *
 * L'écran ne le connaissait pas : il ne pouvait donc pas savoir si une tâche
 * était celle de l'utilisateur, et proposait « Travaux terminés » sur toutes.
 */
export function monCompteId(): Uuid | null {
  return compteId;
}

/** Déconnexion : la redirection est faite par `watchAuthState`. */
export async function seDeconnecter(): Promise<void> {
  await signOut();
}

// ============ CIRCUIT DE VALIDATION ============

/**
 * Retrouve la tâche de planning d'un bon de commande pour un métier et une
 * date, ou la crée.
 *
 * Les cartes du planning représentent des bons de commande ; le circuit de
 * validation, lui, s'appuie sur `planning_taches`. On matérialise donc la tâche
 * au premier passage plutôt que d'imposer une double saisie.
 *
 * Le métier fait partie de l'identité de la tâche : un bon PEINTURE+SOL porte
 * deux tâches qui s'arbitrent séparément. Un repli sur la première tâche du bon
 * rendrait celle d'un autre métier — déjà validée, elle fermait tout arbitrage
 * et ne laissait que le bouton de pré-facture, faisant passer une étape de
 * facturation pour une étape du circuit.
 */
export async function tacheDuBonCommande(
  bcId: Uuid,
  date: string,
  libelle: string,
  metier?: string | null,
  /**
   * L'équipe du métier, telle que le planning l'a choisie.
   *
   * Sans elle, une tâche matérialisée à l'ouverture d'une carte naissait
   * orpheline — et rien ne lui donnait d'équipe ensuite. `est_de_l_equipe()`
   * répondait alors faux, et le terrain se voyait refuser sa propre tâche.
   */
  equipeId?: Uuid | null
): Promise<PlanningTache> {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active.");

  const taches = await queries.listTachesBonCommande(bcId);
  /* Un bon sans métier déclaré garde ses tâches sans métier : la comparaison se
     fait sur la chaîne vide pour que `null` et `""` restent le même cas. */
  const duMetier = taches.filter((t) => (t.metier ?? "") === (metier ?? ""));
  const existante = duMetier.find((t) => t.date_tache === date) ?? duMetier[0];
  if (existante) return existante;

  return queries.planifierTache(societe.uuid, {
    bon_commande_id: bcId,
    libelle,
    date_tache: date,
    metier: metier || null,
    technicien_id: equipeId ?? null,
  });
}

/**
 * Établit l'avoir qui rectifie une facture émise.
 *
 * La société vient de la session, jamais de l'écran : c'est elle qui porte la
 * série « AV » dont l'avoir tire son numéro, et une facture rectifiée depuis
 * la mauvaise société ouvrirait un trou dans les deux séries à la fois.
 */
export async function etablirAvoir(factureId: Uuid, motif: string) {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active.");
  return queries.createAvoir(societe.uuid, factureId, motif);
}

/**
 * Impute un avoir sur une facture, au nom de la société active.
 *
 * Même raison qu'`etablirAvoir` de tenir la société ici : les deux règlements
 * écrits appartiennent à la société du document, et l'écran n'a pas à la
 * désigner.
 */
export async function imputerAvoirSurFacture(
  avoirId: Uuid,
  factureId: Uuid,
  montant: number,
  date?: string
) {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active.");
  return queries.imputerAvoir(societe.uuid, avoirId, factureId, montant, date);
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
  role: RoleMembre | null = roleEffectif(),
  appartenance?: AppartenanceTache
): ActionsTache {
  return reglesActionsTache(statut, role, appartenance);
}

/** Pourquoi le rôle courant ne peut rien faire sur cette tâche, en clair. */
export function motifLectureSeule(
  appartenance?: AppartenanceTache,
  role: RoleMembre | null = roleEffectif()
): string | null {
  return reglesMotifLectureSeule(role, appartenance);
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

/**
 * Le nom sous lequel l'utilisateur veut être désigné.
 *
 * `profiles.nom` retombe sur l'email quand personne ne l'a renseigné, et la
 * barre latérale affichait donc « laurent.johan1@… » à longueur de journée.
 * La politique `profiles_update_self` autorise déjà chacun à corriger le sien.
 *
 * L'annuaire en mémoire est mis à jour dans la foulée : sans cela, l'écran
 * continuerait d'afficher l'ancien nom jusqu'au prochain rechargement.
 */
export async function definirMonNom(nom: string): Promise<boolean> {
  const moi = monCompteId();
  const propre = (nom ?? "").trim();
  if (!moi || !propre) return false;
  try {
    await queries.renommerMonCompte(moi, propre);
  } catch (err) {
    console.error("Nom du compte non enregistré", err);
    return false;
  }
  const connu = annuaire?.get(moi);
  if (connu) annuaire!.set(moi, { ...connu, nom: propre });
  intervenants = intervenants
    .map((i) => (i.id === moi ? { ...i, nom: propre } : i))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  return true;
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
  /**
   * Envoyer un bon en facturation sans que le planning en atteste.
   *
   * Miroir d'affichage : la garde réelle est le `42501` de
   * `bc_chiffrage_valide_hors_circuit`. Le geste est tracé au journal.
   */
  peutFacturerHorsCircuit: boolean;
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
    peutFacturerHorsCircuit: role === "admin",
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
  w.motifLectureSeule = motifLectureSeule;
  w.monCompteId = monCompteId;
  w.actionsFacturation = actionsFacturation;
  /* Le métier, lu sur les chapitres du bon plutôt que coché. `memeMetier` est
     la comparaison partagée : l'écran, l'adaptateur et la session doivent en
     employer une seule, faute de quoi une tâche devient inatteignable. */
  w.memeMetier = memeMetier;
  w.metierDuChapitre = metierDuChapitre;
  w.metiersDesChapitres = metiersDesChapitres;
  w.referentielMetiers = referentielMetiers;
  /* Les lignes du bon sont la seule description des travaux : elles descendent
     sur la tâche du terrain et remontent dans la pré-facture. */
  w.travauxParMetier = travauxParMetier;
  w.travauxDeLaCarte = travauxDeLaCarte;
  // Recherche et filtrage : une seule définition pour tous les écrans
  w.sansAccents = sansAccents;
  w.multiWordMatch = multiWordMatch;
  w.lignesHaystack = lignesHaystack;
  w.texteDocument = texteDocument;
  w.correspond = correspond;
  w.texteFiche = texteFiche;
  w.correspondFiche = correspondFiche;
  w.dateDocument = dateDocument;
  w.dansLaPeriode = dansLaPeriode;
  w.filtrerDocuments = filtrerDocuments;
  w.grouperParClient = grouperParClient;

  w.chargerIntervenants = chargerIntervenants;
  w.nomIntervenant = nomIntervenant;
  w.definirMonNom = definirMonNom;
  w.listeIntervenants = listeIntervenants;
  w.prochainActeur = prochainActeur;
  /* `validerPrefacture` n'est plus exposée au HTML : elle enchaîne le chiffrage
     et la génération de la facture sans jamais demander de prix. L'écran passe
     par `validerChiffrage`, après la saisie ligne à ligne de Facturation ›
     Validation. La fonction reste dans `queries`, où les tests l'éprouvent. */
  w.pdfFacturX = enrichirFactureX;
  w.transmettreFacture = transmettre;
  w.etatConnexionPdp = etatConnexionPdp;
  /* L'avoir : la seule correction qu'une facture émise accepte. La règle qui
     le refuse et celle qui le signe sont les mêmes que côté base et export. */
  w.etablirAvoir = etablirAvoir;
  w.estAvoir = estAvoir;
  w.signeDocument = signeDocument;
  w.libelleDocument = libelleDocument;
  w.totauxSignes = totauxSignes;
  w.refusAvoir = refusAvoir;
  w.MOTIFS_AVOIR = MOTIFS_AVOIR;
  /* L'imputation : un avoir éteint une créance, il ne s'encaisse pas. */
  w.imputerAvoir = imputerAvoirSurFacture;
  w.resteAImputer = resteAImputer;
  /* L'état d'un avoir dans SA langue. La liste des règlements le mesurait avec
     la règle des factures, et annonçait « réglée » sur un avoir entièrement
     disponible. */
  w.statutImputation = statutImputation;
  w.avoirDisponible = avoirDisponible;
  w.montantImputable = montantImputable;
  w.refusImputationAvoir = refusImputationAvoir;
  w.validerChiffrage = queries.validerChiffrage;
  /* Le même geste sans le planning. Exposée à côté de sa jumelle pour qu'on
     voie, en lisant cette ligne, qu'il existe deux chemins et un seul rôle. */
  w.validerChiffrageHorsCircuit = queries.validerChiffrageHorsCircuit;
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
  w.integrerTravailSupplementaire = queries.integrerTravailSupplementaire;

  // Validation directeur : ce qui bloque, et le document qui le montre
  /* La file de validation : quels bons y entrent, et ce qu'on y attend. */
  w.etapeValidation = etapeValidation;
  w.attenteAvantChiffrage = attenteAvantChiffrage;
  w.blocagesChiffrage = blocagesChiffrage;
  w.blocagesValidationConducteur = blocagesValidationConducteur;
  w.messageBlocages = messageBlocages;
  w.manquesBonCommande = manquesBonCommande;
  w.refBonCommandeClient = refBonCommandeClient;
  w.lieuIntervention = lieuIntervention;
  w.lignesDocumentDirecteur = lignesDocumentDirecteur;
  w.comptesRendusTerrain = comptesRendusTerrain;
  w.badgeOrigine = badgeOrigine;

  w.rechercherEntreprise = rechercherEntreprise;

  // Facturation électronique : ce qui est mal formé, et ce qui manquera à l'émission
  /* Le délai de paiement et l'échéance qu'il produit. Jumeaux de
     `public.date_echeance` et `public.libelle_delai_paiement` : une facture
     naît à l'écran ou par `bc_generer_facture`, jamais avec deux dates. */
  w.delaiPaiementRetenu = delaiPaiementRetenu;
  w.dateEcheance = dateEcheance;
  w.libelleDelaiPaiement = libelleDelaiPaiement;
  w.delaiHorsPlafond = delaiHorsPlafond;
  /* Les conditions de paiement se choisissent dans une liste nommée ;
     le couple (jours, mode) reste ce qui s'enregistre. */
  w.DELAIS_PREREGLES = DELAIS_PREREGLES;
  w.delaiPreregle = delaiPreregle;
  w.delaiDeLaCle = delaiDeLaCle;
  w.MODES_REGLEMENT = MODES_REGLEMENT;
  /* L'écran lisait `window.MODE_REGLEMENT_DEFAUT` — que personne ne posait — et
     retombait sur un « virement » écrit en dur. Les deux valeurs coïncidaient,
     si bien que rien ne se voyait ; changer le défaut dans la règle aurait
     laissé l'écran sur l'ancien. Le contrôle de types de l'écran l'a relevé. */
  w.MODE_REGLEMENT_DEFAUT = MODE_REGLEMENT_DEFAUT;
  w.modeReglementRetenu = modeReglementRetenu;

  /* Les montants d'un document. L'arithmétique qui décide de ce qui est
     facturé sort d'`index.html`, qui n'a aucun test. */
  w.totauxDocument = totauxDocument;
  w.montantLigneHt = montantLigneHt;
  w.montantLigneTtc = montantLigneTtc;
  w.ventilationTvaAffichage = ventilationTvaAffichage;
  w.sousTotauxChapitres = sousTotauxChapitres;
  w.formaterTaux = formaterTaux;
  w.soldeAPayer = soldeAPayer;

  /* Les règlements d'une facture. L'état de la facture se DÉDUIT d'eux : un
     statut saisi à côté finit par mentir sur une facture dont un règlement a
     été corrigé. */
  w.totalRegle = totalRegle;
  w.resteAPayer = resteAPayer;
  w.statutReglement = statutReglement;
  w.statutEnBase = statutEnBase;
  w.refusReglement = refusReglement;
  w.montantPropose = montantPropose;
  w.arrondiCentime = arrondiCentime;
  /* Un virement unique réparti sur plusieurs factures, de la plus ancienne à
     la plus récente. */
  w.imputer = imputer;
  w.surplusImputation = surplusImputation;
  w.refusImputation = refusImputation;

  /* La couleur de la société, déclinée. Le réglage existait depuis longtemps
     et n'avait aucun lecteur : KTA portait un violet, l'écran restait orange. */
  w.paletteAccent = paletteAccent;
  w.ACCENT_DEFAUT = ACCENT_DEFAUT;

  w.verifierEntite = verifierEntite;
  w.completudeClient = completudeClient;
  w.recommandationsSociete = recommandationsSociete;
  w.estSociete = estSociete;
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
  /* Le suivi de lecture : seuils et formulations vivent dans `regles-ocr`,
     pas dans `index.html` qui n'a aucun test. */
  w.etatLecture = etatLecture;
  w.etatAnnule = etatAnnule;
  w.etatDelaiDepasse = etatDelaiDepasse;
  w.etatEchec = etatEchec;
  w.formaterDuree = formaterDuree;
  w.attenteAnnoncee = attenteAnnoncee;
  w.versSaisieBonCommande = versSaisieBonCommande;
  w.rapprocherClient = rapprocherClient;

  /* Le bon tel que le client l'a envoyé : ce qu'on accepte, et comment on le
     rouvre depuis un bucket privé. */
  w.verifierPieceJointe = verifierPieceJointe;
  w.preparerPieceJointe = preparer;
  w.apercuDe = apercuDe;
  w.urlApercuPdf = urlApercuPdf;
  w.urlPieceJointe = urlPieceJointe;
  w.urlTelechargementPieceJointe = urlTelechargementPieceJointe;

  /* Le dossier documentaire d'un salarié. Il ne passe pas par le pont
     kv_store : `salarie` y est sans table fille, et tout tableau posé sur la
     fiche est écarté à l'écriture — c'est ce qui perdait les contrats. */
  w.TYPES_DOCUMENT_RH = TYPES_DOCUMENT_RH;
  w.typeDocumentRh = typeDocumentRh;
  w.etatDocumentRh = etatDocumentRh;
  w.dossierSalarie = dossierSalarie;
  w.libelleDocumentRh = libelleDocumentRh;
  w.trierDocumentsRh = trierDocumentsRh;
  w.chargerDocumentsRh = chargerDocumentsRh;
  w.ajouterDocumentRh = ajouterDocumentRh;
  w.majDocumentRh = majDocumentRh;
  w.supprimerDocumentRh = supprimerDocumentRh;
  w.purgerDocumentsRh = purgerDocumentsRh;
  w.ouvrirDocumentRh = ouvrirDocumentRh;

  /* Le registre des visites médicales. Le suivi médical a quitté le catalogue
     des documents : il a son propre écran, son propre seuil (45 j) et sa
     propre alerte. Écrire ici recalcule, par déclencheur, les deux dates de la
     fiche salarié — ne jamais les écrire à la main. */
  w.TYPES_VISITE = TYPES_VISITE;
  w.REGIMES_SUIVI = REGIMES_SUIVI;
  w.AVIS_APTITUDE = AVIS_APTITUDE;
  w.typeVisite = typeVisite;
  w.regimeSuivi = regimeSuivi;
  w.avisAptitude = avisAptitude;
  w.libelleAvis = libelleAvis;
  w.etatVisite = etatVisite;
  w.derniereVisite = derniereVisite;
  w.trierVisites = trierVisites;
  w.prochaineVisiteSuggeree = prochaineVisiteSuggeree;
  w.depasseLePlafondLegal = depasseLePlafondLegal;
  w.chargerVisitesMedicales = chargerVisitesMedicales;
  w.ajouterVisiteMedicale = ajouterVisiteMedicale;
  w.majVisiteMedicale = majVisiteMedicale;
  w.supprimerVisiteMedicale = supprimerVisiteMedicale;
  w.purgerVisitesMedicales = purgerVisitesMedicales;
  w.ouvrirAttestationVisite = ouvrirAttestationVisite;

  /* Inviter un salarié. Seul l'envoi passe par une fonction de bord — il exige
     la clé de service ; lister et annuler se font à la clé publique. */
  w.inviterSalarie = inviterSalarie;
  /* L'écran ne connaît sa société que par son code : l'uuid se résout ici,
     comme pour `etablirAvoir`. Le module d'invitation, lui, ne peut pas
     interroger la session — c'est elle qui l'importe. */
  w.chargerInvitations = () => {
    const societe = societeActive();
    return societe ? chargerInvitations(societe.uuid) : Promise.resolve([]);
  };
  w.annulerInvitation = annulerInvitation;

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
