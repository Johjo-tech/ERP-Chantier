/**
 * Inviter un salarié à se créer un compte, depuis sa fiche.
 *
 * L'envoi passe par la fonction de bord `inviter-salarie` : fabriquer une
 * identité exige la clé de service, qui ne peut pas approcher le navigateur.
 * Tout le reste — lister, annuler — se fait à la clé publique, la RLS suffit.
 *
 * Une fois l'adresse confirmée, la base fait seule le rattachement : deux
 * déclencheurs sur `auth.users` inscrivent le membre et renseignent
 * `salaries.profile_id`. L'écran n'a rien à écrire dans le champ « Compte
 * utilisateur » — il n'a qu'à recharger.
 */

import { supabase } from "@/api/client";
import * as queries from "@/api/queries";
import type { Invitation } from "@/api/queries/invitations";
import type { Uuid } from "@/api/types";

export type { Invitation };

export type EtatInvitation = "invitee" | "confirmation_renvoyee" | "rattachee";

export interface ResultatInvitation {
  etat: EtatInvitation;
  email: string;
}

/**
 * Le motif que la fonction a pris soin d'écrire.
 *
 * `functions.invoke` remplace le corps de la réponse par un message générique
 * — « Edge Function returned a non-2xx status code » — et range la réponse
 * brute, non lue, dans `context`. Sans cette reprise, « cette adresse est déjà
 * le compte de Dupont » n'arriverait jamais sous les yeux de personne. Même
 * parade que dans `ocr.ts`, pour la même raison.
 */
async function motifDuServeur(erreur: unknown): Promise<string | null> {
  const reponse = (erreur as { context?: Response } | null)?.context;
  if (!reponse || typeof reponse.json !== "function") return null;
  try {
    const corps = (await reponse.json()) as { erreur?: unknown };
    return typeof corps?.erreur === "string" && corps.erreur ? corps.erreur : null;
  } catch {
    return null;
  }
}

export async function inviterSalarie(
  salarieId: Uuid,
  email: string,
  role: string
): Promise<ResultatInvitation> {
  const { data, error } = await supabase.functions.invoke<ResultatInvitation>(
    "inviter-salarie",
    { body: { salarie_id: salarieId, email, role } }
  );

  if (error) {
    const motif = await motifDuServeur(error);
    throw new Error(motif ?? "L'invitation n'a pas pu être envoyée.");
  }
  if (!data?.etat) throw new Error("Réponse inattendue du service d'invitation.");
  return data;
}

/**
 * Les invitations d'une société, par son uuid.
 *
 * L'uuid plutôt que la session : `session.ts` importe déjà ce module, et lui
 * demander la société en retour ferait un cycle. C'est donc lui qui résout, au
 * moment de poser la fonction sur `window`.
 */
export async function chargerInvitations(societeId: Uuid): Promise<Invitation[]> {
  return queries.listInvitations(societeId);
}

export function annulerInvitation(id: Uuid) {
  return queries.annulerInvitation(id);
}
