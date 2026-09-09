/**
 * E-reporting : déclarer à l'administration ce qui n'est pas facturé par voie
 * électronique.
 *
 * Le dispositif français ne se limite pas aux factures entre entreprises. Les
 * ventes aux particuliers et les encaissements se déclarent en agrégé, période
 * par période. C'est une obligation distincte de la facturation, et l'oublier
 * expose autant.
 *
 * Deux points de vigilance repris de l'expérience de ce dépôt :
 *
 *  - les totaux se lisent dans `v_facture_totaux`, jamais dans les colonnes de
 *    `factures` : sur 410 factures, 351 y ont zéro. Une déclaration à zéro
 *    serait pire qu'une absence de déclaration ;
 *  - l'adresse de l'API varie selon sa version. On essaie les chemins connus,
 *    mais on s'arrête au premier refus qui n'est pas un 404 : une erreur
 *    métier ne se corrige pas en frappant à une autre porte.
 */

import {
  adminClient,
  appelPdp,
  corsHeaders,
  identifiantPlateforme,
  json,
  journaliser,
  numeroVendeur,
  userClient,
} from "../_shared/pdp.ts";

const arrondi = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debut = Date.now();
  let societeId: string | null = null;

  try {
    const corpsRequete = await req.json().catch(() => ({}));
    const periode = String(corpsRequete?.periode ?? "");
    const flux = corpsRequete?.flux === "encaissements" ? "encaissements" : "transactions";
    const regime = corpsRequete?.regime ? String(corpsRequete.regime) : null;
    const echeance = corpsRequete?.echeance ? String(corpsRequete.echeance) : null;
    societeId = corpsRequete?.societe_id ? String(corpsRequete.societe_id) : null;

    if (!/^\d{4}-\d{2}$/.test(periode)) {
      return json({ error: "Période invalide (attendu AAAA-MM)" }, 400);
    }
    if (!societeId) return json({ error: "societe_id requis" }, 400);

    const supabase = userClient(req);
    const { data: societe } = await supabase
      .from("societes")
      .select("id, nom, raison_sociale_legale, siren, siret, tva_intracom")
      .eq("id", societeId)
      .maybeSingle();
    if (!societe) return json({ error: "Société introuvable" }, 403);

    const debutPeriode = `${periode}-01`;
    const finIncluse = new Date(
      Number(periode.slice(0, 4)),
      Number(periode.slice(5, 7)),
      0
    )
      .toISOString()
      .slice(0, 10);
    // Borne exclusive pour la requête, fin incluse pour la déclaration.
    const finExclusive = new Date(new Date(`${finIncluse}T00:00:00Z`).getTime() + 86_400_000)
      .toISOString()
      .slice(0, 10);

    const { data: factures } = await supabase
      .from("factures")
      .select("id, numero, date, type_document, devise")
      .eq("societe_id", societeId)
      .not("numero", "is", null)
      .gte("date", debutPeriode)
      .lt("date", finExclusive)
      .order("date");

    const lignes = factures ?? [];

    // Les totaux viennent de la vue : les colonnes sont vides sur l'essentiel
    // des factures, et une déclaration à zéro n'aurait aucun sens.
    const totauxParFacture = new Map<string, { ht: number; tva: number; ttc: number }>();
    if (lignes.length) {
      const { data: vues } = await supabase
        .from("v_facture_totaux")
        .select("facture_id, ht, tva, ttc")
        .in(
          "facture_id",
          lignes.map((f) => f.id)
        );
      for (const v of vues ?? []) {
        totauxParFacture.set(v.facture_id as string, {
          ht: Number(v.ht ?? 0),
          tva: Number(v.tva ?? 0),
          ttc: Number(v.ttc ?? 0),
        });
      }
    }

    const { data: reglements } = await supabase
      .from("reglements")
      .select("date, montant, mode")
      .eq("societe_id", societeId)
      .gte("date", debutPeriode)
      .lt("date", finExclusive)
      .order("date");

    const encaissements = (reglements ?? []).map((r) => ({
      date: r.date,
      montant: Number(r.montant ?? 0),
      mode: r.mode ?? null,
    }));

    const totaux = {
      nombre: lignes.length,
      ht: arrondi(lignes.reduce((s, f) => s + (totauxParFacture.get(f.id)?.ht ?? 0), 0)),
      tva: arrondi(lignes.reduce((s, f) => s + (totauxParFacture.get(f.id)?.tva ?? 0), 0)),
      ttc: arrondi(lignes.reduce((s, f) => s + (totauxParFacture.get(f.id)?.ttc ?? 0), 0)),
      encaisse: arrondi(encaissements.reduce((s, e) => s + e.montant, 0)),
    };

    const incarner = await identifiantPlateforme(societeId);
    const vendeur =
      (await numeroVendeur(societeId)) ??
      societe.siren ??
      (societe.siret ? String(societe.siret).slice(0, 9) : null);

    const charge = {
      type: "b2c",
      flow: flux === "encaissements" ? "payments" : "transactions",
      regime,
      period: periode,
      period_start: debutPeriode,
      period_end: finIncluse,
      due_date: echeance,
      currency_code: lignes[0]?.devise ?? "EUR",
      declarant: {
        name: societe.raison_sociale_legale ?? societe.nom,
        legal_registration_identifier: vendeur ? { scheme: "0002", value: vendeur } : undefined,
        vat_identifier: societe.tva_intracom ?? undefined,
      },
      transactions: {
        count: totaux.nombre,
        total_ht: totaux.ht,
        total_vat: totaux.tva,
        total_ttc: totaux.ttc,
        documents: lignes.map((f) => {
          const t = totauxParFacture.get(f.id) ?? { ht: 0, tva: 0, ttc: 0 };
          return {
            number: f.numero,
            issue_date: f.date,
            type_code: String(f.type_document ?? "").includes("avoir") ? 381 : 380,
            total_ht: arrondi(t.ht),
            total_vat: arrondi(t.tva),
            total_ttc: arrondi(t.ttc),
          };
        }),
      },
      payments: { total: totaux.encaisse, entries: encaissements },
    };

    const chemins = ["/v1.beta/e_reportings", "/v1.beta/ereportings", "/v1/e_reportings"];
    let dernier: { statut: number; texte: string } | null = null;
    let accepte: { id?: string } | null = null;

    for (const chemin of chemins) {
      const reponse = await appelPdp(chemin, {
        methode: "POST",
        societeId,
        incarner,
        corps: charge,
      });
      const texte = await reponse.text();
      if (reponse.ok) {
        accepte = JSON.parse(texte || "{}");
        break;
      }
      dernier = { statut: reponse.status, texte };
      // Un 404 dit « pas ici » ; tout autre refus dit « pas comme ça ».
      if (reponse.status !== 404) break;
    }

    const admin = adminClient();
    const commun = {
      societe_id: societeId,
      periode,
      flux,
      regime,
      echeance,
      nb_factures: totaux.nombre,
      total_ht: totaux.ht,
      total_tva: totaux.tva,
      total_ttc: totaux.ttc,
      donnees: charge,
      maj_le: new Date().toISOString(),
    };

    if (!accepte) {
      const message = `La plateforme a répondu ${dernier?.statut} : ${(dernier?.texte ?? "").slice(0, 400)}`;
      await admin
        .from("ereporting_depots")
        .upsert({ ...commun, statut: "echec", message }, { onConflict: "societe_id,periode,flux" });
      await journaliser({
        societeId,
        operation: "ereporting",
        statut: "echec",
        codeHttp: dernier?.statut ?? null,
        message,
        dureeMs: Date.now() - debut,
      });
      return json({ error: message }, 502);
    }

    await admin.from("ereporting_depots").upsert(
      {
        ...commun,
        statut: "transmis",
        message: null,
        pdp_depot_id: accepte.id ? String(accepte.id) : null,
        transmis_le: new Date().toISOString(),
      },
      { onConflict: "societe_id,periode,flux" }
    );

    await journaliser({
      societeId,
      operation: "ereporting",
      statut: "succes",
      message: `${periode} — ${totaux.nombre} document(s), ${totaux.ttc.toFixed(2)} € TTC`,
      dureeMs: Date.now() - debut,
    });

    return json({ transmis: true, periode, totaux, depot: accepte.id ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await journaliser({
      societeId,
      operation: "ereporting",
      statut: "echec",
      message,
      dureeMs: Date.now() - debut,
    });
    return json({ error: message }, 500);
  }
});
