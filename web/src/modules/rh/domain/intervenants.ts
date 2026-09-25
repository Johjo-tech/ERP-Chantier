import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { verifierIdentifiants } from "@/modules/clients/domain/identifiants";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { joursEntre } from "./documents";
import { nomComplet, type Salarie } from "./salarie";

/**
 * Équipes, sous-traitants et fiche conducteur du salarié (RH-02, RH-06,
 * RH-21, PAR-06, AUTH-20, AUTH-44).
 */

// ============ ÉQUIPES ============

export interface Equipe {
  id: string;
  nom: string;
  metier: string | null;
  metiers: string[];
  couleur: string | null;
}

/**
 * Le nom d'une équipe. Les équipes d'origine n'ont pas de nom, seulement un
 * métier : il en tient lieu plutôt que « (sans nom) » (`technicienLabel`).
 */
export function libelleEquipe(e: Pick<Equipe, "nom" | "metier" | "metiers">): string {
  return e.nom.trim() || e.metier || e.metiers[0] || "Équipe";
}

/**
 * Les membres d'une équipe : les salariés ACTIFS dont `technicien_id` la
 * désigne. `nom2`, `nom3` et la composition « binôme » de l'ancien formulaire
 * n'avaient pas de colonne (RH-21) : les membres sont nommés une fois, sur
 * leur fiche (D-RH-06).
 */
export function membresDe<T extends Pick<Salarie, "technicienId" | "actif">>(salaries: readonly T[], equipeId: string): T[] {
  return salaries.filter((s) => s.actif && s.technicienId === equipeId);
}

export function sansEquipe<T extends Pick<Salarie, "technicienId" | "actif">>(salaries: readonly T[]): T[] {
  return salaries.filter((s) => s.actif && !s.technicienId);
}

const COULEUR_PAR_DEFAUT = "#4F7CFF";

export const schemaSaisieEquipe = z.object({
  nom: z.string().trim().min(1, "Le nom de l'équipe est requis."),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.").catch(COULEUR_PAR_DEFAUT),
  metiers: z.array(z.string()),
});
export type SaisieEquipe = z.infer<typeof schemaSaisieEquipe>;

export function valeursEquipe(e: Equipe | null) {
  return { nom: e?.nom ?? "", couleur: e?.couleur || COULEUR_PAR_DEFAUT, metiers: e?.metiers.length ? e.metiers : e?.metier ? [e.metier] : [] };
}

// ============ SOUS-TRAITANTS ============

export interface SousTraitant {
  id: string;
  nom: string;
  metier: string | null;
  metiers: string[];
  email: string | null;
  telephone: string | null;
  siret: string | null;
  siren: string | null;
  tvaIntracom: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  contactNom: string | null;
  contactEmail: string | null;
  contactProfileId: string | null;
}

export interface DocumentSousTraitant {
  id: string;
  sousTraitantId: string;
  nom: string;
  type: string | null;
  dateValidite: string | null;
  fichierChemin: string | null;
  fichierNom: string | null;
}

export const TYPES_DOC_SOUS_TRAITANT = ["Assurance décennale", "Attestation de vigilance URSSAF", "Assurance RC Pro", "Kbis", "Autre"] as const;

/** Sans date en fin de liste : ce qui expire le plus tôt se lit d'abord. */
export function trierDocumentsSousTraitant<T extends Pick<DocumentSousTraitant, "dateValidite">>(docs: readonly T[]): T[] {
  return [...docs].sort((a, b) => (a.dateValidite || "9999").localeCompare(b.dateValidite || "9999"));
}

/**
 * Le badge d'un document de sous-traitant : « EXPIRÉ », « DANS n J » sous le
 * seuil des documents (`documentLegal`, 30 j par défaut — l'ancien écran
 * codait 30 en dur, D-RH-04), rien au-delà ni sans date.
 */
export function echeanceDocumentSousTraitant(dateValidite: string | null, aujourdHui: string, seuil: number): { niveau: "expire" | "bientot"; jours: number } | null {
  const j = joursEntre(aujourdHui, dateValidite);
  if (j === null || j > seuil) return null;
  return { niveau: j < 0 ? "expire" : "bientot", jours: j };
}

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const email = z.preprocess((v) => videEnNull(typeof v === "string" ? v.trim() : v), z.email("Adresse e-mail invalide.").nullable());

/** Le mal formé bloque (SIRET, SIREN, TVA — `verifierEntite`), l'absent jamais. */
export const schemaSaisieSousTraitant = z
  .object({
    nom: z.string().trim().min(1, "Le nom du sous-traitant est requis."),
    siret: texte,
    siren: texte,
    tvaIntracom: texte,
    adresse: texte,
    codePostal: texte,
    ville: texte,
    telephone: texte,
    email,
    contactNom: texte,
    contactEmail: email,
    contactProfileId: z.preprocess(videEnNull, z.string().nullable()),
    metiers: z.array(z.string()),
  })
  .superRefine((s, ctx) => {
    for (const a of verifierIdentifiants({ siret: s.siret, siren: s.siren, tva_intracom: s.tvaIntracom })) {
      ctx.addIssue({ code: "custom", message: a.libelle, path: [a.champ === "tva_intracom" ? "tvaIntracom" : a.champ] });
    }
  });
export type SaisieSousTraitant = z.infer<typeof schemaSaisieSousTraitant>;

export function valeursSousTraitant(s: SousTraitant | null) {
  return {
    nom: s?.nom ?? "",
    siret: s?.siret ?? "",
    siren: s?.siren ?? "",
    tvaIntracom: s?.tvaIntracom ?? "",
    adresse: s?.adresse ?? "",
    codePostal: s?.codePostal ?? "",
    ville: s?.ville ?? "",
    telephone: s?.telephone ?? "",
    email: s?.email ?? "",
    contactNom: s?.contactNom ?? "",
    contactEmail: s?.contactEmail ?? "",
    contactProfileId: s?.contactProfileId ?? "",
  };
}

/**
 * Les comptes qu'on peut relier à la fiche d'un sous-traitant (AUTH-44) : les
 * membres actifs de rôle `sous_traitant` — c'est ce lien que la base remonte
 * pour lui montrer SES tâches —, sans ceux déjà reliés à une AUTRE fiche, plus
 * celui de la fiche elle-même (même s'il a changé de rôle depuis : l'effacer
 * sans qu'on l'ait demandé couperait l'entreprise de son planning).
 */
export function comptesSousTraitantLiables(
  membres: readonly { profileId: string; nom: string; actif: boolean; role: RoleMembre }[],
  fiches: readonly Pick<SousTraitant, "id" | "contactProfileId">[],
  ficheId: string | null
): { valeur: string; libelle: string }[] {
  const pris = new Set(fiches.filter((f) => f.id !== ficheId && f.contactProfileId).map((f) => f.contactProfileId));
  const courant = fiches.find((f) => f.id === ficheId)?.contactProfileId ?? null;
  const options = membres
    .filter((m) => (m.actif && m.role === "sous_traitant" && !pris.has(m.profileId)) || m.profileId === courant)
    .map((m) => ({ valeur: m.profileId, libelle: m.nom }));
  if (courant && !options.some((o) => o.valeur === courant)) options.push({ valeur: courant, libelle: "Compte déjà rattaché" });
  return options;
}

// ============ FICHE CONDUCTEUR DU SALARIÉ ============

export interface FicheConducteurLiee {
  id: string;
  salarieId: string | null;
  profileId: string | null;
  email: string | null;
  telephone: string | null;
  actif: boolean;
}

/**
 * Ce que la case « Conducteur de travaux » demande à la table `conducteurs`
 * (RH-06, `synchroniserFicheConducteur`) :
 *  - cochée : créer la fiche, ou la mettre à jour et la réactiver — nom,
 *    courriel et téléphone viennent de RH, qui devient la seule saisie ;
 *  - décochée : `actif = false`, JAMAIS une suppression (des documents la
 *    désignent par `conducteur_id`).
 */
export type PlanConducteur =
  | { geste: "rien" }
  | { geste: "retirer"; id: string }
  | { geste: "ecrire"; id: string | null; ligne: { nom: string; email: string | null; telephone: string | null; profile_id: string | null; salarie_id: string; actif: true } };

export function planConducteur(salarie: Pick<Salarie, "id" | "nom" | "prenom" | "email" | "telephone" | "profileId">, existante: FicheConducteurLiee | null, veut: boolean): PlanConducteur {
  if (!veut) return existante && existante.actif ? { geste: "retirer", id: existante.id } : { geste: "rien" };
  return {
    geste: "ecrire",
    id: existante?.id ?? null,
    ligne: {
      nom: nomComplet(salarie),
      email: salarie.email || existante?.email || null,
      telephone: salarie.telephone || existante?.telephone || null,
      // Le compte de la personne : sans lui, son tableau de bord montre les affaires de toute la société.
      profile_id: salarie.profileId || existante?.profileId || null,
      salarie_id: salarie.id,
      actif: true,
    },
  };
}

/**
 * Faut-il proposer le rôle « Conducteur de travaux » au compte (AUTH-20) ?
 * DEMANDÉ, JAMAIS IMPOSÉ : changer un rôle retire des droits. Rien à proposer
 * sans compte, ni s'il est déjà conducteur.
 */
export function roleAProposer(profileId: string | null, membres: readonly { profileId: string; role: RoleMembre }[]): { profileId: string; roleActuel: RoleMembre | null } | null {
  if (!profileId) return null;
  const membre = membres.find((m) => m.profileId === profileId) ?? null;
  if (membre?.role === "conducteur") return null;
  return { profileId, roleActuel: membre?.role ?? null };
}
