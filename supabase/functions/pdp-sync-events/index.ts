/**
 * Rapatrie le cycle de vie d'une facture déposée.
 *
 * La plateforme raconte ce qui arrive au document — reçue, approuvée, refusée,
 * payée. C'est cette histoire que l'écran doit montrer, pas seulement « envoyée ».
 *
 * Deux précautions. Les événements sont paginés : on parcourt toutes les pages,
 * faute de quoi un long cycle serait tronqué en silence. Et un code inconnu ne
 * change pas le statut : il est conservé tel quel, mais deviner son sens ferait
 * passer une facture pour encaissée alors qu'elle est en litige.
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

interface EvenementPdp {
  id: number;
  status_code: string;
  status_text?: string;
  created_at?: string;
  data?: { reason?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debut = Date.now();
  let societeId: string | null = null;

  try {
    const { facture_id } = await req.json();
    if (!facture_id) return json({ error: "facture_id requis" }, 400);

    const supabase = userClient(req);
    const { data: facture, error } = await supabase
      .from("factures")
      .select("id, societe_id, pdp_identifiant")
      .eq("id", facture_id)
      .single();
    if (error || !facture) return json({ error: "Facture introuvable" }, 404);
    societeId = facture.societe_id;
    if (!facture.pdp_identifiant) {
      return json({ error: "Cette facture n'a pas été déposée sur la plateforme." }, 400);
    }

    const incarner = await identifiantPlateforme(facture.societe_id);
    const evenements: EvenementPdp[] = [];
    let apres: number | null = null;

    // Vingt pages de mille : bien au-delà de ce qu'un cycle de vie produit.
    for (let page = 0; page < 20; page++) {
      const reponse = await appelPdp(
        `/v1.beta/invoice_events?invoice_id=${facture.pdp_identifiant}&limit=1000` +
          (apres ? `&starting_after_id=${apres}` : ""),
        { societeId: facture.societe_id, incarner }
      );
      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        await journaliser({
          societeId,
          operation: "synchronisation_cycle",
          cibleType: "facture",
          cibleId: facture_id,
          statut: "echec",
          codeHttp: reponse.status,
          message: corps?.message ?? `La plateforme a répondu ${reponse.status}`,
          dureeMs: Date.now() - debut,
        });
        return json({ error: corps?.message ?? `La plateforme a répondu ${reponse.status}` }, 502);
      }
      const lot: EvenementPdp[] = corps?.data ?? [];
      evenements.push(...lot);
      if (!corps?.has_after || !lot.length) break;
      apres = lot[lot.length - 1].id;
    }

    const admin = adminClient();
    const { data: connus } = await admin
      .from("facture_cycle_vie")
      .select("pdp_evenement_id")
      .eq("facture_id", facture_id);
    const dejaVus = new Set((connus ?? []).map((e) => e.pdp_evenement_id));

    const nouveaux = evenements.filter((e) => !dejaVus.has(String(e.id)));
    for (const e of nouveaux) {
      const statut = statutDeCode(e.status_code);
      await admin.from("facture_cycle_vie").insert({
        facture_id,
        pdp_evenement_id: String(e.id),
        code_plateforme: e.status_code,
        // Un code inconnu ne fabrique pas un statut : la ligne existe, elle
        // porte le code brut, et l'écran saura le montrer tel quel.
        statut: statut ?? "deposee",
        date_statut: e.created_at ?? new Date().toISOString(),
        message: e.status_text ?? LIBELLES_CYCLE[statut ?? ""] ?? e.status_code,
        donnees: e,
      });
    }

    // L'état courant de la facture suit le dernier événement traduisible.
    const dernierConnu = [...evenements].reverse().find((e) => statutDeCode(e.status_code));
    if (dernierConnu) {
      await admin
        .from("factures")
        .update({ statut_cycle: statutDeCode(dernierConnu.status_code) })
        .eq("id", facture_id);
    }

    await journaliser({
      societeId,
      operation: "synchronisation_cycle",
      cibleType: "facture",
      cibleId: facture_id,
      statut: "succes",
      message: `${nouveaux.length} nouvel(s) événement(s) sur ${evenements.length}`,
      dureeMs: Date.now() - debut,
    });

    return json({ importes: nouveaux.length, total: evenements.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await journaliser({
      societeId,
      operation: "synchronisation_cycle",
      statut: "echec",
      message,
      dureeMs: Date.now() - debut,
    });
    return json({ error: message }, 500);
  }
});
