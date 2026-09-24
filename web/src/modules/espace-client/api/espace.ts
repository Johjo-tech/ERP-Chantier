import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { analyser } from "@/lib/validation";

/**
 * Lectures de l'espace client. La RLS proposée (acces_clients / mes_clients)
 * ne rend déjà que les lignes du client — brouillons exclus ; on filtre en
 * plus sur ses identifiants pour que la requête dise ce qu'elle veut.
 */
const schemaChantier = z.object({
  id: z.string(),
  nom: z.string(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  date_debut: z.string().nullable(),
  date_fin: z.string().nullable(),
});

const schemaDoc = z.object({ id: z.string(), numero: z.string().nullable(), date: z.string(), client_nom: z.string() });

export async function chantiersDuClient(clientIds: readonly string[]) {
  // Par la vue restreinte : le client ne lit jamais la ligne entière (notes internes).
  const { data, error } = await supabasePropositions()
    .from("v_espace_client_chantiers")
    .select("id, nom, adresse, code_postal, ville, date_debut, date_fin")
    .in("client_id", [...clientIds])
    .order("date_debut", { ascending: false });
  if (error) throw error;
  return analyser(z.array(schemaChantier), data, "chantiers du client");
}

export async function devisDuClient(clientIds: readonly string[]) {
  const [devis, totaux] = await Promise.all([
    supabase().from("devis").select("id, numero, date, client_nom, statut").in("client_id", [...clientIds]).neq("statut", "brouillon").order("date", { ascending: false }),
    supabase().from("v_devis_totaux").select("devis_id, ttc"),
  ]);
  if (devis.error) throw devis.error;
  if (totaux.error) throw totaux.error;
  const ttc = new Map((totaux.data ?? []).map((t) => [t.devis_id, t.ttc ?? 0]));
  return analyser(z.array(schemaDoc.extend({ statut: z.string() })), devis.data, "devis du client").map((d) => ({ ...d, ttc: ttc.get(d.id) ?? 0 }));
}

export async function facturesDuClient(clientIds: readonly string[]) {
  const [factures, totaux] = await Promise.all([
    supabase().from("factures").select("id, numero, date, client_nom, echeance, type_document").in("client_id", [...clientIds]).not("numero", "is", null).order("date", { ascending: false }),
    supabase().from("v_facture_totaux").select("facture_id, ttc"),
  ]);
  if (factures.error) throw factures.error;
  if (totaux.error) throw totaux.error;
  const ttc = new Map((totaux.data ?? []).map((t) => [t.facture_id, t.ttc ?? 0]));
  return analyser(z.array(schemaDoc.extend({ echeance: z.string().nullable(), type_document: z.string() })), factures.data, "factures du client").map((f) => ({ ...f, ttc: ttc.get(f.id) ?? 0 }));
}
