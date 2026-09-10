/**
 * Ouvre la délégation : la société connecte elle-même son compte.
 *
 * Aucun document signé, aucun secret partagé — la société autorise ERP-Chantier
 * à émettre en son nom, et peut retirer cette autorisation quand elle veut.
 *
 * PKCE : le vérifieur reste ici, seule son empreinte SHA-256 part à
 * l'autorisation. Un code intercepté ne sert donc à personne d'autre.
 */

import {
  adminClient,
  configPdp,
  corsHeaders,
  json,
  normaliserEnv,
  userClient,
} from "../_shared/pdp.ts";

/** Chaîne aléatoire en base64url, sans remplissage. */
function alea(octets = 48): string {
  const tampon = new Uint8Array(octets);
  crypto.getRandomValues(tampon);
  return btoa(String.fromCharCode(...tampon))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function empreinte(verifieur: string): Promise<string> {
  const condensat = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifieur)
  );
  return btoa(String.fromCharCode(...new Uint8Array(condensat)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { societe_id, retour_url } = await req.json();
    if (!societe_id) return json({ error: "societe_id requis" }, 400);

    const supabase = userClient(req);
    const { data: utilisateur } = await supabase.auth.getUser();
    if (!utilisateur?.user) return json({ error: "Non authentifié" }, 401);

    // La RLS ne laisse voir que les sociétés dont on est membre : c'est elle
    // qui empêche de connecter la société d'un autre.
    const { data: societe, error } = await supabase
      .from("societes")
      .select("id, siren, siret, email, adresse_electronique_valeur")
      .eq("id", societe_id)
      .single();
    if (error || !societe) return json({ error: "Société introuvable" }, 404);

    const { data: connexion } = await adminClient()
      .from("pdp_connexions")
      .select("environnement")
      .eq("societe_id", societe_id)
      .maybeSingle();

    const env = normaliserEnv(connexion?.environnement);
    const bacASable = env === "sandbox";
    const siren = String(societe.siren ?? societe.siret ?? "").replace(/\D/g, "").slice(0, 9);

    // En production le SIREN identifie l'émetteur : sans lui, rien n'est
    // possible. En bac à sable la plateforme fournit une société fictive.
    if (!bacASable && !/^\d{9}$/.test(siren)) {
      return json(
        {
          error:
            "SIREN invalide : renseignez les 9 chiffres du SIREN dans les réglages de la société avant de connecter la plateforme en production.",
        },
        400
      );
    }

    let clientId: string | undefined;
    let baseUrl: string;
    try {
      ({ clientId, baseUrl } = configPdp(env));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
    if (!clientId) return json({ error: "client_id de la plateforme non configuré" }, 500);

    const verifieur = alea();
    const etat = alea(24);
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pdp-oauth-callback`;

    await adminClient().from("pdp_oauth_etats").insert({
      etat,
      societe_id,
      code_verifier: verifieur,
      profile_id: utilisateur.user.id,
      redirect_uri: redirectUri,
      retour_url: retour_url ?? null,
      environnement: env,
    });

    // En bac à sable, la plateforme travaille sur des numéros fictifs plutôt
    // que sur le vrai SIREN. `000000001` est la société d'essai partagée.
    const numeroSociete = bacASable ? "000000001" : siren;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state: etat,
      code_challenge: await empreinte(verifieur),
      code_challenge_method: "S256",
      /* En production on force l'inscription à l'annuaire de réception :
         recevoir est une obligation depuis le 1er septembre 2026, et c'est le
         premier intérêt de l'enrôlement. */
      superpdp_send_and_receive: bacASable ? "any" : "receive",
      superpdp_company_number_scheme: bacASable ? "sandbox" : "fr_siren",
    });

    if (societe.email) params.set("login_hint", String(societe.email));
    if (!bacASable && societe.adresse_electronique_valeur) {
      params.set(
        "superpdp_directory_entry_identifier",
        String(societe.adresse_electronique_valeur)
      );
    }
    if (Deno.env.get("SUPERPDP_ONLY_FUTURE") === "true") {
      params.set("superpdp_only_future", "true");
    }
    // Aucune portée par défaut : on n'en demande que si elle est configurée.
    const portee = Deno.env.get("SUPERPDP_OAUTH_SCOPE");
    if (portee) params.set("scope", portee);
    if (numeroSociete) params.set("superpdp_company_number", numeroSociete);

    return json({
      url: `${baseUrl}/oauth2/authorize?${params.toString()}`,
      redirect_uri: redirectUri,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
