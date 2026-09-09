/**
 * Récupère le document d'une facture chez la plateforme.
 *
 * Sert surtout aux factures **reçues** : nous n'en avons aucun exemplaire, seul
 * le fournisseur en a produit un. Pour nos propres factures, l'application
 * fabrique déjà le PDF Factur-X et n'a rien à demander.
 *
 * L'original portait ici un générateur de PDF de secours, pour rendre lisible
 * une facture créée par API sans fichier source. Il n'est pas porté : nous
 * savons produire le nôtre, et une seconde mise en page divergerait de la
 * première au premier changement.
 */

import {
  appelPdp,
  corsHeaders,
  identifiantPlateforme,
  json,
  journaliser,
  userClient,
} from "../_shared/pdp.ts";

/** Les chemins où la plateforme peut ranger le document, du plus fidèle au plus simple. */
const CHEMINS = (id: string) => [
  `/v1.beta/invoices/${id}/file?docType=Converted`,
  `/v1.beta/invoices/${id}/file`,
  `/v1.beta/invoices/${id}/pdf`,
];

function versBase64(octets: Uint8Array): string {
  let binaire = "";
  const bloc = 0x8000;
  for (let i = 0; i < octets.length; i += bloc) {
    binaire += String.fromCharCode(...octets.subarray(i, i + bloc));
  }
  return btoa(binaire);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const debut = Date.now();
  try {
    const { facture_entrante_id, facture_id } = await req.json();
    if (!facture_entrante_id && !facture_id) {
      return json({ error: "facture_entrante_id ou facture_id requis" }, 400);
    }

    const supabase = userClient(req);

    let societeId: string | null = null;
    let identifiant: string | null = null;

    if (facture_entrante_id) {
      const { data } = await supabase
        .from("factures_entrantes")
        .select("societe_id, pdp_identifiant")
        .eq("id", facture_entrante_id)
        .maybeSingle();
      if (!data) return json({ error: "Facture entrante introuvable" }, 404);
      societeId = data.societe_id;
      identifiant = data.pdp_identifiant;
    } else {
      const { data } = await supabase
        .from("factures")
        .select("societe_id, pdp_identifiant")
        .eq("id", facture_id)
        .maybeSingle();
      if (!data) return json({ error: "Facture introuvable" }, 404);
      societeId = data.societe_id;
      identifiant = data.pdp_identifiant;
    }

    if (!identifiant) {
      return json({ error: "Ce document n'est pas lié à la plateforme." }, 400);
    }

    const incarner = societeId ? await identifiantPlateforme(societeId) : null;

    for (const chemin of CHEMINS(identifiant)) {
      const reponse = await appelPdp(chemin, { societeId, incarner });
      if (!reponse.ok) continue;

      const octets = new Uint8Array(await reponse.arrayBuffer());
      if (!octets.length) continue;

      await journaliser({
        societeId,
        operation: "recuperation_document",
        cibleType: facture_entrante_id ? "facture_entrante" : "facture",
        cibleId: facture_entrante_id ?? facture_id,
        statut: "succes",
        message: `${octets.length} octets depuis ${chemin}`,
        dureeMs: Date.now() - debut,
      });

      return json({
        contenu: versBase64(octets),
        type: reponse.headers.get("content-type") ?? "application/pdf",
        source: chemin,
      });
    }

    await journaliser({
      societeId,
      operation: "recuperation_document",
      cibleType: facture_entrante_id ? "facture_entrante" : "facture",
      cibleId: facture_entrante_id ?? facture_id,
      statut: "echec",
      message: "aucun document disponible chez la plateforme",
      dureeMs: Date.now() - debut,
    });

    return json(
      {
        error:
          "La plateforme n'héberge aucun document pour cette facture. Les données structurées restent consultables.",
      },
      404
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
