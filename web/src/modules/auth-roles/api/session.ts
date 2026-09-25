import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { verifierMatrice } from "../domain/demarrage";
import { construireMatrice, estRole, type Matrice, type RoleMembre } from "../domain/permissions";
import { NIVEAU_ABONNEMENT_MAX, NIVEAU_ABONNEMENT_MIN } from "../domain/types";
import type { AccesClient, Session } from "../domain/types";

export type { AccesClient, Session, SocieteAccessible, Utilisateur } from "../domain/types";

const ligneMembre = z.object({
  role: z.string().refine(estRole, "Rôle inconnu"),
  societe: z
    .object({
      id: z.string(),
      code: z.string(),
      nom: z.string(),
      niveau_abonnement: z.number().int().min(NIVEAU_ABONNEMENT_MIN).max(NIVEAU_ABONNEMENT_MAX).nullish(),
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

/**
 * Ferme la session DANS CE NAVIGATEUR seulement, sans appel au serveur.
 *
 * Sert quand le jeton a expiré : un `signOut()` global serait présenté avec le
 * même jeton refusé, et laisserait la session morte en place.
 */
export async function fermerSessionLocale(): Promise<void> {
  const { error } = await supabase().auth.signOut({ scope: "local" });
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
 * Charge tout ce que la session doit savoir avant le premier rendu, DANS
 * L'ORDRE de l'ancien démarrage (`integrations/session.ts#chargerSession`) :
 *
 *   1. la matrice des droits — tout l'affichage s'y réfère ; vide ou tronquée,
 *      l'application refuse de démarrer (`verifierMatrice`) ;
 *   2. le profil, puis les sociétés où le compte est membre ACTIF, avec son
 *      rôle dans chacune (une ligne de `membres_societe` par société) ;
 *   3. les accès « espace client ».
 *
 * Séquentiel à dessein : une matrice illisible arrête tout avant qu'on
 * interroge le reste. L'annuaire des comptes n'est plus un préalable : chaque
 * écran qui nomme un compte le lit par sa requête, indexée par société (D-AUTH-01).
 */
export async function chargerSession(userId: string): Promise<Session> {
  const matrice = await chargerMatrice();
  const client = supabase();
  const profilR = await client.from("profiles").select("id, nom, email").eq("id", userId).single();
  if (profilR.error) throw profilR.error;
  // `*` sur la société : une colonne ajoutée plus tard (niveau d'abonnement)
  // apparaît sans que ce code ait à changer, et son absence ne casse rien.
  const membresR = await client
    .from("membres_societe")
    .select("role, societe:societes(*)")
    .eq("profile_id", userId)
    .eq("actif", true);
  if (membresR.error) throw membresR.error;

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

  const accesClients = await chargerAccesClients();
  return {
    utilisateur: { id: p.id, email: p.email ?? "", nom: p.nom || p.email || "" },
    societes,
    matrice,
    accesClients,
  };
}

/** La matrice entière, ou un refus de démarrer (AUTH-33). */
async function chargerMatrice(): Promise<Matrice> {
  const { data, error, count } = await supabase().from("role_permissions").select("role, module, action", { count: "exact" });
  if (error) throw error;
  const droits = z
    .array(ligneDroit)
    .parse(data ?? [])
    .map((d) => ({ ...d, role: d.role as RoleMembre }));
  return construireMatrice(verifierMatrice(droits, count));
}

const ligneAcces = z.object({
  client_id: z.string(),
  client_nom: z.string(),
  societe_id: z.string(),
  societe_nom: z.string(),
});

/** Vue absente (migration proposée non appliquée) : pas d'espace client, sans erreur. */
const TABLE_ABSENTE = new Set(["42P01", "PGRST205", "PGRST200"]);

async function chargerAccesClients(): Promise<AccesClient[]> {
  // La vue ne rend que les accès du compte connecté, avec les seuls noms utiles.
  const { data, error } = await supabasePropositions().from("v_mes_acces_clients").select("client_id, client_nom, societe_id, societe_nom");
  if (error) {
    if (TABLE_ABSENTE.has(error.code)) return [];
    throw error;
  }
  return z
    .array(ligneAcces)
    .parse(data)
    .map((a) => ({ clientId: a.client_id, clientNom: a.client_nom, societeId: a.societe_id, societeNom: a.societe_nom }));
}
