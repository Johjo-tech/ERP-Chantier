import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { siretValide } from "@/modules/clients/domain/identifiants";

/** Intervenants de la société (PAR-06) : conducteurs de travaux et fournisseurs. */

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const email = z.preprocess((v) => videEnNull(typeof v === "string" ? v.trim() : v), z.email("Adresse e-mail invalide.").nullable());

export const schemaSaisieConducteur = z.object({
  nom: z.string().trim().min(1, "Le nom du conducteur est requis."),
  email,
  telephone: texte,
  /** Le compte de la personne : sans lui, son tableau de bord montre les affaires de toute la société. */
  profile_id: z.preprocess(videEnNull, z.string().nullable()),
});
export type SaisieConducteur = z.infer<typeof schemaSaisieConducteur>;

export const schemaSaisieFournisseur = z.object({
  nom: z.string().trim().min(1, "Le nom du fournisseur est requis."),
  specialite: texte,
  contact_nom: texte,
  telephone: texte,
  email,
  adresse: texte,
  code_postal: texte,
  ville: texte,
  // Le mal formé bloque, l'absent jamais — même règle que les clients.
  siret: z.preprocess(videEnNull, z.string().trim().nullable().refine((v) => v === null || siretValide(v), "Le SIRET est incorrect : sa clé de contrôle ne tombe pas juste.")),
  notes: texte,
});
export type SaisieFournisseur = z.infer<typeof schemaSaisieFournisseur>;

/**
 * Les comptes qu'on peut lier à une fiche conducteur : les membres actifs,
 * sans ceux déjà liés à une AUTRE fiche (un seul compte par société — index
 * `conducteurs_un_compte_par_societe`), plus celui de la fiche elle-même.
 */
export function comptesLiables(
  membres: readonly { profileId: string; nom: string; actif: boolean }[],
  fiches: readonly { id: string; profile_id: string | null }[],
  ficheId: string | null
): { valeur: string; libelle: string }[] {
  const pris = new Set(fiches.filter((f) => f.id !== ficheId && f.profile_id).map((f) => f.profile_id));
  const courant = fiches.find((f) => f.id === ficheId)?.profile_id ?? null;
  return membres
    .filter((m) => (m.actif && !pris.has(m.profileId)) || m.profileId === courant)
    .map((m) => ({ valeur: m.profileId, libelle: m.nom }));
}
