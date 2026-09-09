/**
 * Déclare un statut de cycle de vie à la plateforme.
 *
 * Sert surtout sur les factures **reçues** : approuver, contester, refuser,
 * déclarer payé. C'est une obligation du dispositif — le destinataire doit dire
 * ce qu'il fait du document, et son silence bloque le fournisseur.
 *
 * La liste des codes est fermée : envoyer un code hors dispositif serait
 * refusé par la plateforme, autant le dire ici avec un message lisible.
 */

import {
  adminClient,
  appelPdp,
  corsHeaders,
  identifiantPlateforme,
  json,
  journaliser,
  LIBELLES_CYCLE,
  statutDeCode,
  userClient,
} from "../_shared/pdp.ts";

/** Les statuts qu'un destinataire peut déclarer. */
const CODES_ADMIS = [
  "fr:204", // approuvée
  "fr:205", // approuvée partiellement
  "fr:206", // en litige
  "fr:207", // suspendue
  "fr:208", // complétée
  "fr:209", // refusée
  "fr:210", // paiement refusé
  "fr:211", // paiement transmis
  "fr:212", // encaissée
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debut = Date.now();
  try {
    const { facture_id, code, motif } = await req.json();
    if (!facture_id || !code) return json({ error: "facture_id et code requis" }, 400);
    if (!CODES_ADMIS.includes(code)) {
      return json({ error: `Code de statut inconnu. Admis : ${CODES_ADMIS.join(", ")}` }, 400);
    }
    // Un refus sans motif laisse le fournisseur sans rien à corriger.
    if ((code === "fr:206" || code === "fr:209") && !String(motif ?? "").trim()) {
      return json({ error: "Un refus ou un litige doit être motivé." }, 400);
    }

    const supabase = userClient(req);
    const { data: facture, error } = await supabase
      .from("factures")
      .select("id, societe_id, pdp_identifiant")
      .eq("id", facture_id)
      .single();
    if (error || !facture) return json({ error: "Facture introuvable" }, 404);
    if (!facture.pdp_identifiant) {
      return json({ error: "Cette facture n'est pas liée à la plateforme." }, 400);
    }

    const reponse = await appelPdp("/v1.beta/invoice_events", {
      methode: "POST",
      societeId: facture.societe_id,
      incarner: await identifiantPlateforme(facture.societe_id),
      corps: {
        invoice_id: Number(facture.pdp_identifiant),
        status_code: code,
        ...(motif ? { details: [{ reason: motif }] } : {}),
      },
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      await journaliser({
        societeId: facture.societe_id,
        operation: "declaration_statut",
        cibleType: "facture",
        cibleId: facture_id,
        statut: "echec",
        codeHttp: reponse.status,
        message: corps?.message ?? `La plateforme a répondu ${reponse.status}`,
        dureeMs: Date.now() - debut,
      });
      return json({ error: corps?.message ?? `La plateforme a répondu ${reponse.status}` }, 502);
    }

    const statut = statutDeCode(code);
    const admin = adminClient();
    await admin.from("facture_cycle_vie").insert({
      facture_id,
      pdp_evenement_id: corps?.id ? String(corps.id) : null,
      code_plateforme: code,
      statut: statut ?? "deposee",
      date_statut: new Date().toISOString(),
      message: motif ?? LIBELLES_CYCLE[statut ?? ""] ?? code,
      donnees: corps,
    });
    if (statut) {
      await admin.from("factures").update({ statut_cycle: statut }).eq("id", facture_id);
    }

    await journaliser({
      societeId: facture.societe_id,
      operation: "declaration_statut",
      cibleType: "facture",
      cibleId: facture_id,
      statut: "succes",
      message: `${code} déclaré`,
      dureeMs: Date.now() - debut,
    });

    return json({ declare: true, code, statut });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
