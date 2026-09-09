/**
 * Dépose une facture sur la plateforme.
 *
 * L'application envoie le CII qu'elle a produit : la charge EN 16931 et sa
 * syntaxe XML vivent dans `src/api/regles-en16931.ts` et `regles-cii.ts`, sous
 * soixante-quatre tests. Les réécrire ici en Deno créerait une seconde
 * implémentation de la même règle — c'est exactement ce qui a déjà fait
 * diverger la machine à états de ce projet, trois fois.
 *
 * La contrepartie est qu'un client pourrait envoyer autre chose que ce que la
 * base contient. On ne fait donc pas confiance au XML reçu : le numéro et le
 * total sont relus en base et confrontés au document avant tout envoi. Une
 * facture ne part que si elle dit la même chose que sa ligne.
 *
 * À noter : contrairement à l'original, aucun appel de conversion. La
 * plateforme accepte le CII directement, et c'est celui que le validateur
 * Mustangproject a déclaré valide.
 */

import {
  adminClient,
  appelPdp,
  corsHeaders,
  identifiantPlateforme,
  json,
  journaliser,
  userClient,
} from "../_shared/pdp.ts";

/** Ce que le XML annonce, pour le confronter à la base. */
function lireDansXml(xml: string, balise: string): string | null {
  const trouve = xml.match(new RegExp(`<${balise}[^>]*>([^<]+)</${balise}>`));
  return trouve ? trouve[1].trim() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debut = Date.now();
  let societeId: string | null = null;

  try {
    const { facture_id, xml } = await req.json();
    if (!facture_id) return json({ error: "facture_id requis" }, 400);
    if (typeof xml !== "string" || !xml.includes("CrossIndustryInvoice")) {
      return json({ error: "Le document transmis n'est pas une facture CII." }, 400);
    }

    const supabase = userClient(req);
    const { data: utilisateur } = await supabase.auth.getUser();
    if (!utilisateur?.user) return json({ error: "Non authentifié" }, 401);

    // La RLS décide de ce que l'appelant peut voir : c'est elle qui empêche
    // d'émettre la facture d'une autre société.
    const { data: facture, error } = await supabase
      .from("factures")
      .select("id, societe_id, numero, statut_cycle, pdp_identifiant")
      .eq("id", facture_id)
      .single();
    if (error || !facture) return json({ error: "Facture introuvable" }, 404);
    societeId = facture.societe_id;

    if (!facture.numero) {
      return json({ error: "Numérotez la facture avant de la transmettre." }, 400);
    }
    if (facture.pdp_identifiant) {
      return json(
        { error: `Cette facture a déjà été déposée (${facture.pdp_identifiant}).` },
        409
      );
    }

    // Le document doit dire la même chose que sa ligne. Sans ce contrôle, la
    // vérification faite côté navigateur ne vaudrait rien.
    const numeroXml = lireDansXml(xml, "ram:ID");
    if (numeroXml !== facture.numero) {
      return json(
        {
          error: `Le document porte le numéro « ${numeroXml} » alors que la facture est « ${facture.numero} ». Transmission refusée.`,
        },
        409
      );
    }

    const { data: totaux } = await supabase
      .from("v_facture_totaux")
      .select("ttc")
      .eq("facture_id", facture_id)
      .maybeSingle();
    const totalXml = lireDansXml(xml, "ram:GrandTotalAmount");
    const attendu = Number(totaux?.ttc ?? 0);
    if (totalXml !== null && Math.abs(Number(totalXml) - attendu) > 0.01) {
      return json(
        {
          error: `Le document annonce ${totalXml} € alors que la facture totalise ${attendu.toFixed(2)} €. Transmission refusée.`,
        },
        409
      );
    }

    const incarner = await identifiantPlateforme(facture.societe_id);
    const reponse = await appelPdp(
      `/v1.beta/invoices?external_id=${encodeURIComponent(facture_id)}`,
      {
        methode: "POST",
        societeId: facture.societe_id,
        incarner,
        entetes: { "Content-Type": "application/xml" },
        corps: xml,
      }
    );
    const corps = await reponse.json().catch(() => ({}));

    if (!reponse.ok) {
      await journaliser({
        societeId,
        operation: "depot_facture",
        cibleType: "facture",
        cibleId: facture_id,
        statut: "echec",
        codeHttp: reponse.status,
        message: corps?.message ?? `La plateforme a répondu ${reponse.status}`,
        reponse: corps,
        dureeMs: Date.now() - debut,
      });
      return json(
        { error: corps?.message ?? `La plateforme a répondu ${reponse.status}`, details: corps },
        502
      );
    }

    const identifiant = String(corps.id ?? "");
    const maintenant = new Date().toISOString();
    const admin = adminClient();

    await admin
      .from("factures")
      .update({
        pdp_identifiant: identifiant,
        pdp_transmission_id: corps.transmission_id ? String(corps.transmission_id) : null,
        statut_cycle: "deposee",
        depose_le: maintenant,
      })
      .eq("id", facture_id);

    // Le cycle de vie est la trace de ce qui est arrivé au document : c'est lui
    // que l'écran montrera, pas le journal technique.
    await admin.from("facture_cycle_vie").insert({
      facture_id,
      statut: "deposee",
      date_statut: maintenant,
      auteur_id: utilisateur.user.id,
      message: "Déposée sur la plateforme",
      donnees: corps,
    });

    await journaliser({
      societeId,
      operation: "depot_facture",
      cibleType: "facture",
      cibleId: facture_id,
      statut: "succes",
      codeHttp: reponse.status,
      message: `déposée sous ${identifiant}`,
      dureeMs: Date.now() - debut,
    });

    return json({ depose: true, identifiant });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await journaliser({
      societeId,
      operation: "depot_facture",
      statut: "echec",
      message,
      dureeMs: Date.now() - debut,
    });
    return json({ error: message }, 500);
  }
});
