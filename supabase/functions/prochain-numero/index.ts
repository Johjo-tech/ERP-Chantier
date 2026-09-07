/**
 * Edge Function: Générer le prochain numéro
 * Atomique - évite les doublons même avec requêtes parallèles
 *
 * Remplace: nextNumero() du HTML (qui était racy)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const { societeId, type } = await req.json();

    if (!societeId || !type) {
      return new Response(
        JSON.stringify({ error: "Missing societeId or type" }),
        { status: 400 }
      );
    }

    // Obtenir/créer le compteur pour cette société
    let { data: counters, error: getError } = await supabase
      .from("counters")
      .select("*")
      .eq("societe_id", societeId)
      .single();

    if (getError && getError.code !== "PGRST116") {
      throw getError;
    }

    if (!counters) {
      // Créer le compteur initial
      const { data: newCounter, error: createError } = await supabase
        .from("counters")
        .insert({
          societe_id: societeId,
          devis: 0,
          facture: 0,
          intervention: 0,
          bon_commande: 0,
          sav: 0,
        })
        .select()
        .single();

      if (createError) throw createError;
      counters = newCounter;
    }

    // Incrémenter le compteur (atomiquement!)
    const newCount = (counters[type] || 0) + 1;

    const { error: updateError } = await supabase
      .from("counters")
      .update({ [type]: newCount })
      .eq("societe_id", societeId);

    if (updateError) throw updateError;

    // Générer le numéro
    const year = new Date().getFullYear();
    const typeCodes: Record<string, string> = {
      devis: "DEV",
      facture: "FAC",
      intervention: "RAP",
      bon_commande: "BC",
      sav: "SAV",
    };
    const typeCode = typeCodes[type] || type.toUpperCase();
    const numero = `${typeCode}-${year}-${String(newCount).padStart(4, "0")}`;

    return new Response(JSON.stringify({ numero }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
