import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { estRole, type RoleMembre } from "@/modules/auth-roles/domain/permissions";
import {
  nomAffichable,
  refusLisible,
  schemaInvitation,
  schemaReponseInvitation,
  type EtatInvitation,
  type Invitation,
  type IssueRole,
  type Membre,
  type SaisieInvitation,
} from "../domain/comptes";

/**
 * Un refus métier déjà rédigé en français : `messageErreur` montre tel quel un
 * code P0001 (comme les messages des déclencheurs), au lieu du « vous n'avez
 * pas le droit » générique du 42501.
 */
function refus(message: string) {
  return Object.assign(new Error(message), { code: "P0001" });
}

/** Le 42501 de `proteger_dernier_admin` porte un motif précis : on le rend lisible. */
function traduire(e: { code?: string; message?: string }) {
  const lisible = refusLisible(e.message);
  return lisible ? refus(lisible) : e;
}

const ligneMembre = z.object({
  id: z.string(),
  role: z.string().refine(estRole, "Rôle inconnu"),
  actif: z.boolean(),
  profile_id: z.string(),
  profil: z.object({ nom: z.string().nullable(), email: z.string().nullable(), actif: z.boolean() }).nullable(),
});

/** Tous les membres de la société, actifs ou non (AUTH-50). */
export async function listerMembres(societeId: string): Promise<Membre[]> {
  const { data, error } = await supabase()
    .from("membres_societe")
    .select("id, role, actif, profile_id, profil:profiles(nom, email, actif)")
    .eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(ligneMembre), data, "membres de la société").map((m) => ({
    id: m.id,
    profileId: m.profile_id,
    nom: nomAffichable(m.profil?.nom, m.profil?.email),
    email: m.profil?.email ?? "",
    role: m.role as RoleMembre,
    actif: m.actif,
    compteActif: m.profil?.actif ?? true,
  }));
}

/**
 * Change le rôle d'un membre (`membres_update` : administrateur seul). Zéro
 * ligne touchée = ce compte n'est pas membre, ou la RLS a écarté la demande :
 * on le dit, au lieu d'annoncer un changement qui n'a pas eu lieu.
 */
export async function definirRole(membre: Pick<Membre, "id" | "role">, role: RoleMembre): Promise<IssueRole> {
  if (membre.role === role) return "inchange";
  const { data, error } = await supabase().from("membres_societe").update({ role }).eq("id", membre.id).select("id");
  if (error) throw traduire(error);
  return data.length ? "change" : "absent";
}

/**
 * Désactive ou réactive l'accès d'un membre à CETTE société. La ligne reste :
 * l'historique (auteur d'une validation, d'une facture…) garde son nom.
 */
export async function definirAcces(membreId: string, actif: boolean): Promise<void> {
  const { data, error } = await supabase().from("membres_societe").update({ actif }).eq("id", membreId).select("id");
  if (error) throw traduire(error);
  if (!data.length) throw refus("Seul un administrateur peut modifier l'accès d'un compte.");
}

export async function listerInvitations(societeId: string): Promise<Invitation[]> {
  const { data, error } = await supabase()
    .from("invitations")
    .select("id, email, role, statut, salarie_id, sous_traitant_id, invitee_le, cree_le")
    .eq("societe_id", societeId)
    .order("cree_le", { ascending: false });
  if (error) throw error;
  return analyser(z.array(schemaInvitation), data, "invitations");
}

/**
 * Annule sans effacer : les déclencheurs n'appliquent que `en_attente`, le lien
 * déjà envoyé ne donne donc plus rien, et la trace de l'invitation reste.
 */
export async function annulerInvitation(id: string): Promise<void> {
  const { data, error } = await supabase().from("invitations").update({ statut: "annulee" }).eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw refus("Seul un administrateur peut annuler une invitation.");
}

export async function supprimerInvitation(id: string): Promise<void> {
  const { data, error } = await supabase().from("invitations").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data.length) throw refus("Seul un administrateur peut supprimer une invitation.");
}

const DELAI_INVITATION_MS = 30_000;

/**
 * Invite un salarié par la fonction de bord `inviter-salarie` : créer une
 * identité exige la clé de service, qui ne doit jamais approcher le navigateur.
 * Son motif de refus (« adresse déjà prise », « réessayez dans 8 min »…) est
 * repris tel quel : `functions.invoke` le cache derrière un message générique.
 */
export async function inviterSalarie(salarieId: string, saisie: SaisieInvitation): Promise<{ etat: EtatInvitation; email: string }> {
  const { data, error } = await supabase().functions.invoke("inviter-salarie", {
    body: { salarie_id: salarieId, email: saisie.email, role: saisie.role },
    signal: AbortSignal.timeout(DELAI_INVITATION_MS),
  });
  if (error) {
    const corps: unknown = await (error as { context?: Response }).context?.json?.().catch((e: unknown) => {
      console.warn("Réponse d'erreur illisible :", e);
      return null;
    });
    const r = schemaReponseInvitation.safeParse(corps);
    throw refus(r.success && "erreur" in r.data ? r.data.erreur : "L'invitation n'a pas pu être envoyée.");
  }
  const reponse = analyser(schemaReponseInvitation, data, "invitation");
  if ("erreur" in reponse) throw refus(reponse.erreur);
  return reponse;
}

const ligneSalarie = z.object({
  id: z.string(),
  nom: z.string().nullable(),
  prenom: z.string().nullable(),
  email: z.string().nullable(),
  profile_id: z.string().nullable(),
  actif: z.boolean().nullable(),
});
export interface SalarieCompte {
  id: string;
  nom: string;
  email: string;
  profileId: string | null;
}

/** Les salariés actifs de la société, par la vue d'annuaire (les colonnes RH sensibles y sont masquées). */
export async function listerSalaries(societeId: string): Promise<SalarieCompte[]> {
  const { data, error } = await supabase()
    .from("v_salaries_annuaire")
    .select("id, nom, prenom, email, profile_id, actif")
    .eq("societe_id", societeId)
    .order("nom");
  if (error) throw error;
  return analyser(z.array(ligneSalarie), data, "salariés")
    .filter((s) => s.actif !== false)
    .map((s) => ({
      id: s.id,
      nom: [s.prenom, s.nom].filter(Boolean).join(" ") || "—",
      email: s.email ?? "",
      profileId: s.profile_id,
    }));
}

/** Les fiches conducteur qui suivent un salarié : elles décident du rôle proposé. */
export async function listerConducteursSuivis(societeId: string): Promise<{ salarie_id: string | null }[]> {
  const { data, error } = await supabase().from("conducteurs").select("salarie_id").eq("societe_id", societeId).not("salarie_id", "is", null);
  if (error) throw error;
  return analyser(z.array(z.object({ salarie_id: z.string().nullable() })), data, "conducteurs");
}
