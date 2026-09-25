import { z } from "zod";
import { estRole, ROLES_LIBELLES, type RoleMembre } from "@/modules/auth-roles/domain/permissions";

/**
 * Comptes et accès d'une société : membres, rôles, invitations (AUTH-18 à 20,
 * 40, 43). La base décide de tout — politiques `membres_*` et `invitations_*`
 * (administrateur seul), déclencheur `trg_proteger_dernier_admin`, fonction de
 * bord `inviter-salarie`. Ce module ne fait que présenter et relayer.
 */

/**
 * Rôles qu'on peut donner à un SALARIÉ invité. `sous_traitant` en est exclu : ce
 * rôle vise la fiche sous-traitant, et la fonction de bord le refuse (AUTH-19).
 */
export const ROLES_INVITATION: readonly { role: RoleMembre; libelle: string }[] = [
  { role: "technicien", libelle: "Technicien — déclare ses travaux" },
  { role: "conducteur", libelle: "Conducteur de travaux" },
  { role: "secretaire", libelle: "Secrétaire — devis, factures, RH" },
  { role: "lecture", libelle: "Lecture seule" },
  { role: "admin", libelle: "Administrateur — tous les droits" },
];

/**
 * Le rôle que la fiche RH laisse attendre : « conducteur » si une fiche
 * conducteur suit ce salarié, sinon « technicien » (`roleProposePourSalarie`).
 */
export function rolePropose(salarieId: string, conducteursSuivis: readonly { salarie_id: string | null }[]): RoleMembre {
  return conducteursSuivis.some((c) => c.salarie_id === salarieId) ? "conducteur" : "technicien";
}

export interface Membre {
  id: string;
  profileId: string;
  nom: string;
  email: string;
  role: RoleMembre;
  actif: boolean;
  /** `profiles.actif` : faux, le compte est coupé de TOUTES ses sociétés (AUTH-32). */
  compteActif: boolean;
}

/** Le nom à afficher : `profiles.nom`, à défaut l'adresse (jamais « un utilisateur »). */
export function nomAffichable(nom: string | null | undefined, email: string | null | undefined): string {
  return (nom ?? "").trim() || (email ?? "").trim() || "—";
}

/** Actifs d'abord, puis par nom ; les administrateurs n'ont pas de passe-droit dans l'ordre. */
export function trierMembres(m: readonly Membre[]): Membre[] {
  return [...m].sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"));
}

export function adminsActifs(m: readonly Membre[]): number {
  return m.filter((x) => x.actif && x.role === "admin").length;
}

/**
 * Pourquoi on ne peut pas retirer à ce membre son rôle d'administrateur ni son
 * accès — miroir d'AFFICHAGE de `proteger_dernier_admin` (AUTH-40). La base
 * refuse de toute façon ; l'écran évite de proposer un geste voué à l'échec.
 */
export function verrouAdmin(cible: Membre, moi: string, membres: readonly Membre[]): string | null {
  if (cible.role !== "admin" || !cible.actif) return null;
  if (cible.profileId === moi) return "Vous ne pouvez pas retirer votre propre rôle d'administrateur.";
  if (adminsActifs(membres) <= 1) return "Une société doit conserver au moins un administrateur actif.";
  return null;
}

/** Issue d'un changement de rôle, comme `definirRoleDuCompte` (AUTH-20). */
export type IssueRole = "change" | "inchange" | "absent" | "refuse";

export const MESSAGES_ISSUE: Record<IssueRole, string> = {
  change: "Rôle modifié.",
  inchange: "Ce compte avait déjà ce rôle.",
  absent: "Ce compte n'est pas membre de cette société : son rôle n'a pas changé.",
  refuse: "Seul un administrateur peut changer un rôle.",
};

/**
 * Les refus du déclencheur `proteger_dernier_admin`, rédigés sans accents en
 * base, redits en français lisible. Tout autre message passe tel quel.
 */
const REFUS_CONNUS: readonly [RegExp, string][] = [
  [/retirer votre propre role administrateur/i, "Vous ne pouvez pas retirer votre propre rôle d'administrateur."],
  [/supprimer votre propre acces administrateur/i, "Vous ne pouvez pas supprimer votre propre accès d'administrateur."],
  [/conserver au moins un administrateur actif/i, "Une société doit conserver au moins un administrateur actif."],
];

export function refusLisible(message: string | null | undefined): string | null {
  const m = message ?? "";
  return REFUS_CONNUS.find(([motif]) => motif.test(m))?.[1] ?? null;
}

// ============ INVITATIONS ============

export const STATUTS_INVITATION = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  annulee: "Annulée",
  expiree: "Expirée",
} as const;
export type StatutInvitation = keyof typeof STATUTS_INVITATION;

export const schemaInvitation = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string().refine(estRole, "Rôle inconnu"),
  statut: z.enum(["en_attente", "acceptee", "annulee", "expiree"]),
  salarie_id: z.string().nullable(),
  sous_traitant_id: z.string().nullable(),
  invitee_le: z.string().nullable(),
  cree_le: z.string(),
});
export type Invitation = z.infer<typeof schemaInvitation>;

export function libelleRole(role: string): string {
  return estRole(role) ? ROLES_LIBELLES[role] : role;
}

/** L'invitation qui attend encore pour ce salarié (une seule, par index unique). */
export function invitationEnAttente(invitations: readonly Invitation[], salarieId: string): Invitation | null {
  return invitations.find((i) => i.salarie_id === salarieId && i.statut === "en_attente") ?? null;
}

export const schemaSaisieInvitation = z.object({
  email: z.string().trim().pipe(z.email("Indiquez une adresse e-mail valide.")),
  role: z.enum(["technicien", "conducteur", "secretaire", "lecture", "admin"], { message: "Rôle impossible pour un salarié." }),
});
export type SaisieInvitation = z.infer<typeof schemaSaisieInvitation>;

/** Contrat de la fonction de bord `inviter-salarie` (AUTH-52). */
export const schemaReponseInvitation = z.union([
  z.object({ etat: z.enum(["invitee", "confirmation_renvoyee", "rattachee"]), email: z.string() }),
  z.object({ erreur: z.string() }),
]);
export type EtatInvitation = "invitee" | "confirmation_renvoyee" | "rattachee";

/**
 * Trois issues, trois phrases : un compte déjà confirmé se rattache sans
 * courriel — le dire, sinon on attendrait un mail qui ne viendra jamais.
 */
export function messageInvitation(etat: EtatInvitation, email: string): string {
  if (etat === "rattachee") return "Ce compte existait déjà : il vient d'être rattaché, sans courriel.";
  if (etat === "confirmation_renvoyee") return `Courriel de confirmation renvoyé à ${email}.`;
  return `Invitation envoyée à ${email}.`;
}
