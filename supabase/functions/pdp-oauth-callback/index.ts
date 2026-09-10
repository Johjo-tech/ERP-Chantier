/**
 * Retour d'autorisation : la société vient d'accorder la délégation.
 *
 * Cette fonction est appelée par la plateforme, pas par l'application : elle
 * échange le code contre un couple de jetons, les range hors de portée de
 * l'écran, et renvoie l'utilisateur d'où il vient.
 *
 * L'état est consommé **avant** toute autre vérification : un code rejoué ne
 * doit jamais retrouver son vérifieur, même si l'échange échoue ensuite.
 */

import {
  adminClient,
  configPdp,
  identiteSociete,
  journaliser,
  normaliserEnv,
  oauthStateExpired,
} from "../_shared/pdp.ts";

/** Renvoie l'utilisateur vers l'application, avec le résultat en clair. */
function retour(cible: string, params: Record<string, string>): Response {
  const url = new URL(cible);
  for (const [cle, valeur] of Object.entries(params)) url.searchParams.set(cle, valeur);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const etat = url.searchParams.get("state");
  const appUrl = Deno.env.get("APP_URL") ?? "https://erpchantier.vercel.app";
  let cible = `${appUrl}/#reglages`;
  const debut = Date.now();

  try {
    if (!etat) return retour(cible, { pdp: "erreur", message: "état manquant" });

    const admin = adminClient();
    const { data: st } = await admin
      .from("pdp_oauth_etats")
      .select("*")
      .eq("etat", etat)
      .maybeSingle();
    if (!st) return retour(cible, { pdp: "erreur", message: "demande inconnue ou déjà utilisée" });

    // Usage unique, consommé d'abord : un code rejoué ne retrouve rien.
    await admin.from("pdp_oauth_etats").delete().eq("etat", etat);
    if (st.retour_url) cible = st.retour_url;

    if (oauthStateExpired({ expires_at: st.expire_le, created_at: st.cree_le }, Date.now())) {
      return retour(cible, {
        pdp: "erreur",
        message: "Demande de connexion expirée, recommencez depuis les réglages",
      });
    }

    const erreur = url.searchParams.get("error");
    if (erreur || !code) {
      return retour(cible, {
        pdp: "erreur",
        message: url.searchParams.get("error_description") ?? erreur ?? "code manquant",
      });
    }

    // L'environnement est figé dans l'état : le code s'échange avec le secret
    // de l'application qui l'a émis, même si la société a changé depuis.
    const env = normaliserEnv(st.environnement);
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    let baseUrl: string;
    try {
      ({ clientId, clientSecret, baseUrl } = configPdp(env));
    } catch (e) {
      return retour(cible, { pdp: "erreur", message: e instanceof Error ? e.message : String(e) });
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pdp-oauth-callback`;
    const reponse = await fetch(`${baseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: st.code_verifier ?? "",
      }),
    });
    const corps = await reponse.json().catch(() => ({}));

    if (!reponse.ok || typeof corps?.access_token !== "string") {
      await journaliser({
        societeId: st.societe_id,
        operation: "oauth_callback",
        statut: "echec",
        codeHttp: reponse.status,
        message: corps?.error_description ?? corps?.error ?? "échange de code refusé",
        dureeMs: Date.now() - debut,
      });
      return retour(cible, {
        pdp: "erreur",
        message: corps?.error_description ?? corps?.error ?? `HTTP ${reponse.status}`,
      });
    }

    const maintenant = new Date().toISOString();
    const expireLe = new Date(Date.now() + Number(corps.expires_in ?? 3600) * 1000).toISOString();

    // La connexion d'abord : c'est elle que l'écran lit.
    const { data: connexion } = await admin
      .from("pdp_connexions")
      .upsert(
        {
          societe_id: st.societe_id,
          fournisseur: "superpdp",
          environnement: env,
          etat: "connecte",
          message: null,
          connecte_le: maintenant,
          expire_le: expireLe,
          maj_le: maintenant,
        },
        { onConflict: "societe_id,fournisseur" }
      )
      .select("id")
      .single();

    // Les jetons ensuite, dans la table que l'application ne voit pas.
    if (connexion?.id) {
      await admin.from("pdp_connexion_secrets").upsert(
        {
          connexion_id: connexion.id,
          access_token: corps.access_token,
          refresh_token: corps.refresh_token ?? null,
          expire_le: expireLe,
          bail_refresh: null,
          dernier_refresh_le: maintenant,
          maj_le: maintenant,
        },
        { onConflict: "connexion_id" }
      );
    }

    /* L'identité de la société, lue depuis la session : une session
       `authorization_code` vaut pour exactement une société. La déduire des
       factures laisserait une société neuve sans identité — elle n'en a
       encore émis aucune. */
    const identite = await identiteSociete(st.societe_id);

    await journaliser({
      societeId: st.societe_id,
      operation: "oauth_callback",
      statut: "succes",
      message: `connectée en ${env}`,
      reponse: {
        company_id: identite.companyId,
        company_number: identite.companyNumber,
        source: identite.source,
      },
      dureeMs: Date.now() - debut,
    });

    return retour(cible, { pdp: "connecte" });
  } catch (e) {
    return retour(cible, { pdp: "erreur", message: e instanceof Error ? e.message : String(e) });
  }
});
