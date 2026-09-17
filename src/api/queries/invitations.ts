/**
 * Les invitations en attente d'une société.
 *
 * L'envoi du courriel passe par la fonction de bord `inviter-salarie` — il
 * exige la clé de service. Tout le reste se fait très bien à la clé publique :
 * la RLS accorde la lecture à tout membre (`est_membre`) et l'écriture au seul
 * administrateur (`est_admin`), ce qui rend une fonction de bord inutile pour
 * lister, annuler ou effacer.
 */

import { dyn, remove, updateOne } from "../client";
import type { Tables, Uuid } from "../types";

export type Invitation = Tables<"invitations">;

/**
 * Les invitations d'une société, la plus récente d'abord.
 *
 * Toutes, pas seulement celles en attente : une invitation acceptée explique
 * un compte apparu, une invitation annulée explique un compte qui n'est jamais
 * venu.
 */
export async function listInvitations(societeId: Uuid): Promise<Invitation[]> {
  const { data, error } = await dyn()
    .from("invitations")
    .select("*")
    .eq("societe_id", societeId)
    .order("cree_le", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invitation[];
}

/**
 * Annule une invitation sans l'effacer.
 *
 * Le statut passe à `annulee`, et les déclencheurs ne regardent que
 * `en_attente` : la personne aurait beau confirmer son adresse, elle
 * n'obtiendrait plus rien. Garder la ligne laisse une trace de qui avait été
 * invité, et par qui.
 */
export function annulerInvitation(id: Uuid) {
  return updateOne("invitations", id, { statut: "annulee" });
}

export function supprimerInvitation(id: Uuid) {
  return remove("invitations", id);
}
