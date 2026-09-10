/**
 * Notifications de la plateforme : nouvel événement, nouvelle facture reçue.
 *
 * Cette fonction est appelée par la plateforme, pas par un utilisateur : elle
 * se déploie donc avec `verify_jwt = false` et se protège par un secret partagé.
 *
 *   supabase secrets set SUPERPDP_WEBHOOK_SECRET=<aléatoire>
 *
 * puis, côté plateforme, un en-tête `x-webhook-secret` portant la même valeur.
 * Sans secret configuré, la fonction refuse tout : une porte ouverte vaut moins
 * qu'une porte fermée.
 */

import {
  adminClient,
  corsHeaders,
  json,
  journaliser,
  LIBELLES_CYCLE,
  statutDeCode,
} from "../_shared/pdp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);

  const secret = Deno.env.get("SUPERPDP_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return json({ error: "non autorisé" }, 401);
  }

  try {
    const charge = await req.json();
    const admin = adminClient();

    const identifiantPdp = charge?.invoice_id ?? charge?.invoice?.id;
    if (!identifiantPdp) return json({ recu: true, ignore: true });

    const { data: facture } = await admin
      .from("factures")
      .select("id, societe_id")
      .eq("pdp_identifiant", String(identifiantPdp))
      .maybeSingle();

    /* Une facture inconnue n'est pas une erreur : c'est le plus souvent une
       facture entrante, que `pdp-receive` rapatriera. On accuse réception pour
       que la plateforme ne réessaie pas indéfiniment. */
    if (!facture) return json({ recu: true, facture_inconnue: true });

    if (charge?.status_code) {
      const statut = statutDeCode(charge.status_code);
      await admin.from("facture_cycle_vie").insert({
        facture_id: facture.id,
        pdp_evenement_id: charge.id ? String(charge.id) : null,
        code_plateforme: charge.status_code,
        statut: statut ?? "deposee",
        date_statut: charge.created_at ?? new Date().toISOString(),
        message:
          charge.status_text ?? LIBELLES_CYCLE[statut ?? ""] ?? charge.status_code,
        donnees: charge,
      });
      if (statut) {
        await admin.from("factures").update({ statut_cycle: statut }).eq("id", facture.id);
      }
    }

    await journaliser({
      societeId: facture.societe_id,
      operation: "webhook",
      cibleType: "facture",
      cibleId: facture.id,
      statut: "succes",
      message: charge?.status_code ?? "notification reçue",
      requete: charge,
    });

    return json({ recu: true });
  } catch (e) {
    // On répond 200 : une notification qu'on n'a pas su lire ne doit pas faire
    // rejouer la plateforme en boucle. La trace suffit à la retrouver.
    await journaliser({
      operation: "webhook",
      statut: "echec",
      message: e instanceof Error ? e.message : String(e),
    });
    return json({ recu: true, erreur: true });
  }
});
