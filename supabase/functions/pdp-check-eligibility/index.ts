/**
 * Le client est-il joignable par facture électronique ?
 *
 * L'annuaire de la plateforme dit si une entreprise sait recevoir. Sans cette
 * vérification, on découvre le refus au moment d'émettre — c'est-à-dire trop
 * tard, la facture portant déjà un numéro.
 *
 * Le résultat est retenu sur la fiche client : l'annuaire ne bouge pas tous les
 * jours, et on ne va pas l'interroger à chaque facture.
 */

import { appelPdp, corsHeaders, json, journaliser, userClient } from "../_shared/pdp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debut = Date.now();
  try {
    const { client_id, societe_id } = await req.json();
    if (!client_id) return json({ error: "client_id requis" }, 400);

    const supabase = userClient(req);
    const { data: client } = await supabase
      .from("clients")
      .select("id, nom, siren, siret, adresse_electronique_schema, adresse_electronique_valeur")
      .eq("id", client_id)
      .maybeSingle();
    if (!client) return json({ error: "Client introuvable" }, 404);

    const identifiant =
      client.adresse_electronique_valeur ?? client.siret ?? client.siren ?? null;
    if (!identifiant) {
      return json({
        eligible: false,
        statut: "inconnu",
        message:
          "Ce client n'a ni adresse électronique, ni SIRET, ni SIREN : il ne peut pas être recherché dans l'annuaire.",
      });
    }

    const reponse = await appelPdp(
      `/v1.beta/directory_entries?identifier=${encodeURIComponent(String(identifiant))}`,
      { societeId: societe_id ?? null }
    );
    const corps = await reponse.json().catch(() => null);
    const entrees = Array.isArray(corps?.data) ? corps.data : [];
    const eligible = reponse.ok && entrees.length > 0;

    const statut = !reponse.ok ? "indetermine" : eligible ? "eligible" : "absent";
    const message = !reponse.ok
      ? `Annuaire interrogeable plus tard (HTTP ${reponse.status}).`
      : eligible
        ? "Ce client peut recevoir des factures électroniques."
        : "Ce client n'est pas encore inscrit à l'annuaire.";

    // On retient le résultat : l'annuaire ne change pas tous les jours.
    await supabase
      .from("clients")
      .update({
        eligibilite_statut: statut,
        eligibilite_verifie_le: new Date().toISOString(),
        eligibilite_message: message,
      })
      .eq("id", client_id);

    await journaliser({
      societeId: societe_id ?? null,
      operation: "eligibilite",
      cibleType: "client",
      cibleId: client_id,
      statut: reponse.ok ? "succes" : "echec",
      codeHttp: reponse.status,
      message,
      dureeMs: Date.now() - debut,
    });

    return json({ eligible, statut, message, entrees: entrees.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
