import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { COLLECTIONS_SAUVEGARDE, documentSauvegarde } from "../domain/sauvegarde";

/** PostgREST plafonne une réponse (max_rows) : au-delà, par pages. */
const PAGE = 1000;

const schemaLignes = z.array(z.record(z.string(), z.unknown()));

/**
 * Une collection entière de la société, avec les droits de l'utilisateur. Le
 * nom de la source est dynamique : le typage des tables n'a rien à vérifier
 * ici, le contenu part tel que la base le rend.
 */
async function lireCollection(source: string, select: string, societeId: string): Promise<Record<string, unknown>[]> {
  const tout: Record<string, unknown>[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase()
      .from(source as "clients")
      .select(select)
      .eq("societe_id", societeId)
      .order("id")
      .range(debut, debut + PAGE - 1);
    if (error) throw error;
    const page = analyser(schemaLignes, data, `sauvegarde : ${source}`);
    tout.push(...page);
    if (page.length < PAGE) return tout;
  }
}

/** Le fichier de sauvegarde complet, prêt à télécharger. */
export async function construireSauvegarde(societeId: string, codeSociete: string, exporteLe: string): Promise<string> {
  const db = supabase();
  const [societe, settings, ...collections] = await Promise.all([
    db.from("societes").select("*").eq("id", societeId).maybeSingle(),
    db.from("societe_settings").select("*").eq("societe_id", societeId).maybeSingle(),
    ...COLLECTIONS_SAUVEGARDE.map((c) => lireCollection(c.source, c.select, societeId)),
  ]);
  if (societe.error) throw societe.error;
  if (settings.error) throw settings.error;
  const parCle = Object.fromEntries(COLLECTIONS_SAUVEGARDE.map((c, i) => [c.cle, collections[i] ?? []]));
  return documentSauvegarde(codeSociete, exporteLe, societe.data, settings.data, parCle);
}
