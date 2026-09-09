/**
 * Rapatrie les factures reçues des fournisseurs.
 *
 * Recevoir est l'obligation entrée en vigueur le 1er septembre 2026 : une
 * entreprise doit pouvoir accepter une facture électronique, qu'elle en émette
 * ou non. Ces factures arrivent chez la plateforme, pas dans une boîte mail.
 *
 * Une facture reçue qui n'entre pas en base est une facture perdue. Le retour
 * de chaque insertion est donc vérifié, et les échecs comptés à part : on
 * n'annonce jamais un import qui n'a pas eu lieu.
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

interface FacturePdp {
  id: number;
  en_invoice?: {
    number?: string;
    issue_date?: string;
    payment_due_date?: string;
    currency_code?: string;
    seller?: {
      name?: string;
      legal_name?: string;
      vat_identifier?: string;
      legal_registration_identifier?: { value?: string };
    };
    totals?: {
      total_without_vat?: string;
      total_vat_amount?: { value?: string };
      total_with_vat?: string;
      amount_due_for_payment?: string;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debut = Date.now();
  let societeId: string | null = null;

  try {
    const { societe_id } = await req.json();
    societeId = societe_id ?? null;
    if (!societe_id) return json({ error: "societe_id requis" }, 400);

    const supabase = userClient(req);
    const { data: societe } = await supabase
      .from("societes")
      .select("id")
      .eq("id", societe_id)
      .maybeSingle();
    if (!societe) return json({ error: "Société introuvable" }, 404);

    const incarner = await identifiantPlateforme(societe_id);
    const reponse = await appelPdp(
      "/v1.beta/invoices?direction=in&limit=100&expand[]=en_invoice",
      { societeId: societe_id, incarner }
    );
    const corps = await reponse.json().catch(() => ({}));

    if (!reponse.ok) {
      await journaliser({
        societeId,
        operation: "reception_factures",
        statut: "echec",
        codeHttp: reponse.status,
        message: corps?.message ?? `La plateforme a répondu ${reponse.status}`,
        dureeMs: Date.now() - debut,
      });
      /* Deux refus méritent un message distinct : ils ne se corrigent pas au
         même endroit. L'un tient aux identifiants de l'application, l'autre à
         la délégation de la société. */
      if (reponse.status === 401) {
        return json(
          {
            error:
              "Authentification refusée par la plateforme. Vérifiez les identifiants de l'application.",
            code: "identifiants",
          },
          401
        );
      }
      if (reponse.status === 403) {
        return json(
          {
            error:
              "La plateforme refuse l'accès à cette société. La délégation est-elle toujours valable ?",
            code: "delegation",
          },
          403
        );
      }
      return json({ error: corps?.message ?? `La plateforme a répondu ${reponse.status}` }, 502);
    }

    const distantes: FacturePdp[] = corps?.data ?? [];
    const admin = adminClient();

    const { data: connues } = await admin
      .from("factures_entrantes")
      .select("pdp_identifiant")
      .eq("societe_id", societe_id);
    const dejaLa = new Set((connues ?? []).map((f) => f.pdp_identifiant).filter(Boolean));

    /* La liste omet souvent le bloc vendeur : sans le nom du fournisseur, une
       facture entrante est illisible dans l'écran. On va le chercher au détail. */
    async function nomVendeur(id: number): Promise<string | null> {
      try {
        const r = await appelPdp(`/v1.beta/invoices/${id}`, { societeId: societe_id, incarner });
        if (!r.ok) return null;
        const d = await r.json().catch(() => ({}));
        const inv = d?.data ?? d;
        return (
          inv?.en_invoice?.seller?.name ??
          inv?.seller?.name ??
          inv?.en_invoice?.seller?.legal_name ??
          null
        );
      } catch {
        return null;
      }
    }

    const nouvelles = distantes.filter((f) => !dejaLa.has(String(f.id)));
    let importees = 0;
    const echecs: string[] = [];

    for (const f of nouvelles) {
      const en = f.en_invoice ?? {};
      const totaux = en.totals ?? {};
      const vendeur = en.seller ?? {};
      const nom = vendeur.name ?? vendeur.legal_name ?? (await nomVendeur(f.id));

      const { error } = await admin.from("factures_entrantes").insert({
        societe_id,
        pdp_identifiant: String(f.id),
        numero: en.number ?? null,
        emetteur_nom: nom,
        emetteur_siren: vendeur.legal_registration_identifier?.value ?? null,
        emetteur_tva_intracom: vendeur.vat_identifier ?? null,
        date_emission: en.issue_date ?? null,
        echeance: en.payment_due_date ?? null,
        devise: en.currency_code ?? "EUR",
        total_ht: totaux.total_without_vat ?? null,
        total_tva: totaux.total_vat_amount?.value ?? null,
        total_ttc: totaux.total_with_vat ?? null,
        net_a_payer: totaux.amount_due_for_payment ?? null,
        statut_cycle: "recue",
        donnees: f,
        recue_le: new Date().toISOString(),
      });

      if (error) echecs.push(`${f.id} : ${error.message}`);
      else importees++;
    }

    await journaliser({
      societeId,
      operation: "reception_factures",
      statut: echecs.length ? "echec" : "succes",
      message:
        `${importees} importée(s) sur ${nouvelles.length}` +
        (echecs.length ? ` — ${echecs.length} en échec` : ""),
      reponse: echecs.length ? { echecs } : null,
      dureeMs: Date.now() - debut,
    });

    return json({ importees, candidates: nouvelles.length, total: distantes.length, echecs });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await journaliser({
      societeId,
      operation: "reception_factures",
      statut: "echec",
      message,
      dureeMs: Date.now() - debut,
    });
    return json({ error: message }, 500);
  }
});
