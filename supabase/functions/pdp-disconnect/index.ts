/**
 * Retire la délégation.
 *
 * La révocation côté plateforme est tentée, mais son échec n'empêche pas la
 * suppression locale : ce qui compte est que nous n'ayons plus les jetons.
 * Les garder après un « déconnectez-moi » serait le vrai manquement.
 */

import { adminClient, appelPdp, corsHeaders, json, journaliser, userClient } from "../_shared/pdp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { societe_id } = await req.json();
    if (!societe_id) return json({ error: "societe_id requis" }, 400);

    const supabase = userClient(req);
    const { data: utilisateur } = await supabase.auth.getUser();
    if (!utilisateur?.user) return json({ error: "Non authentifié" }, 401);

    // La RLS confirme l'appartenance : on ne déconnecte pas la société d'autrui.
    const { data: societe } = await supabase
      .from("societes")
      .select("id")
      .eq("id", societe_id)
      .maybeSingle();
    if (!societe) return json({ error: "Société introuvable" }, 404);

    let revoquee = false;
    try {
      const reponse = await appelPdp("/oauth2/revoke", {
        methode: "POST",
        societeId: societe_id,
        corps: {},
      });
      revoquee = reponse.ok;
    } catch {
      // La plateforme est injoignable : on efface quand même.
    }

    const admin = adminClient();
    const { data: connexion } = await admin
      .from("pdp_connexions")
      .select("id")
      .eq("societe_id", societe_id)
      .maybeSingle();

    if (connexion?.id) {
      await admin.from("pdp_connexion_secrets").delete().eq("connexion_id", connexion.id);
      await admin
        .from("pdp_connexions")
        .update({
          etat: "non_connecte",
          message: null,
          pdp_company_id: null,
          pdp_seller_number: null,
          connecte_le: null,
          expire_le: null,
          maj_le: new Date().toISOString(),
        })
        .eq("id", connexion.id);
    }

    await journaliser({
      societeId: societe_id,
      operation: "deconnexion",
      statut: "succes",
      message: revoquee ? "révoquée côté plateforme" : "effacée localement seulement",
    });

    return json({ deconnecte: true, revoquee });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
