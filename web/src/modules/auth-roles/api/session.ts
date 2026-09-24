import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { construireMatrice, estRole, type RoleMembre } from "../domain/permissions";
import type { AccesClient, Session } from "../domain/types";

export type { AccesClient, Session, SocieteAccessible, Utilisateur } from "../domain/types";

const ligneMembre = z.object({
  role: z.string().refine(estRole, "Rôle inconnu"),
  societe: z
    .object({
      id: z.string(),
      code: z.string(),
      nom: z.string(),
      niveau_abonnement: z.number().int().min(1).max(5).nullish(),
    })
    .nullable(),
});

const ligneDroit = z.object({
  role: z.string().refine(estRole, "Rôle inconnu"),
  module: z.string(),
  action: z.string(),
});

const profil = z.object({ id: z.string(), nom: z.string(), email: z.string().nullable() });

export async function seConnecter(email: string, motDePasse: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw error;
}

export async function seDeconnecter(): Promise<void> {
  const { error } = await supabase().auth.signOut();
  if (error) throw error;
}

/** L'identifiant du compte connecté, ou null. Ne fait aucun appel réseau. */
export async function compteConnecte(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}

export function surChangementDeSession(rappel: () => void): () => void {
  const { data } = supabase().auth.onAuthStateChange(() => rappel());
  return () => data.subscription.unsubscribe();
}

/**
 * Charge tout ce que la session doit savoir avant le premier rendu : profil,
 * sociétés où le compte est membre ACTIF, et la matrice des droits.
 */
export async function chargerSession(userId: string): Promise<Session> {
  const client = supabase();
  // `*` sur la société : une colonne ajoutée plus tard (niveau d'abonnement)
  // apparaît sans que ce code ait à changer, et son absence ne casse rien.
  const [profilR, membresR, droitsR] = await Promise.all([
    client.from("profiles").select("id, nom, email").eq("id", userId).single(),
    client
      .from("membres_societe")
      .select("role, societe:societes(*)")
      .eq("profile_id", userId)
      .eq("actif", true),
    client.from("role_permissions").select("role, module, action"),
  ]);
  if (profilR.error) throw profilR.error;
  if (membresR.error) throw membresR.error;
  if (droitsR.error) throw droitsR.error;

  const p = profil.parse(profilR.data);
  const societes = z
    .array(ligneMembre)
    .parse(membresR.data)
    .flatMap((m) =>
      m.societe
        ? [
            {
              id: m.societe.id,
              code: m.societe.code,
              nom: m.societe.nom,
              role: m.role as RoleMembre,
              niveauAbonnement: m.societe.niveau_abonnement ?? null,
            },
          ]
        : []
    )
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const droits = z.array(ligneDroit).parse(droitsR.data);
  const accesClients = await chargerAccesClients(userId);
  return {
    utilisateur: { id: p.id, email: p.email ?? "", nom: p.nom || p.email || "" },
    societes,
    matrice: construireMatrice(droits.map((d) => ({ ...d, role: d.role as RoleMembre }))),
    accesClients,
  };
}

const ligneAcces = z.object({
  client_id: z.string(),
  societe_id: z.string(),
  client: z.object({ nom: z.string() }).nullable(),
  societe: z.object({ nom: z.string() }).nullable(),
});

/** Table absente (migration proposée non appliquée) : pas d'espace client, sans erreur. */
const TABLE_ABSENTE = new Set(["42P01", "PGRST205", "PGRST200"]);

async function chargerAccesClients(userId: string): Promise<AccesClient[]> {
  const { data, error } = await supabasePropositions()
    .from("acces_clients")
    .select("client_id, societe_id, client:clients(nom), societe:societes(nom)")
    .eq("profile_id", userId)
    .eq("actif", true);
  if (error) {
    if (TABLE_ABSENTE.has(error.code)) return [];
    throw error;
  }
  return z
    .array(ligneAcces)
    .parse(data)
    .map((a) => ({ clientId: a.client_id, clientNom: a.client?.nom ?? "", societeId: a.societe_id, societeNom: a.societe?.nom ?? "" }));
}
