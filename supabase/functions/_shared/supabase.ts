/**
 * Les deux clients dont toute fonction de bord a besoin, et la différence
 * entre les deux — qui est une différence de droits, pas de commodité.
 *
 * Ils vivaient dans `pdp.ts`, où le connecteur de facturation électronique les
 * avait écrits le premier. Un module d'invitation n'a rien à importer du PDP :
 * ils sont remontés ici, et `pdp.ts` les réexporte pour ses onze appelants.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Client agissant au nom de l'utilisateur : la RLS s'applique.
 *
 * C'est le client par défaut d'une fonction de bord. Tout ce qui peut passer
 * par lui doit passer par lui : la base décide, la fonction n'a pas à refaire
 * — donc pas à se tromper sur — le contrôle des droits.
 */
export function userClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    }
  );
}

/**
 * Client de service : contourne la RLS.
 *
 * Réservé à ce qu'aucune clé publique ne peut faire — lire un jeton PDP,
 * fabriquer une identité. Jamais pour s'épargner une policy.
 */
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}
