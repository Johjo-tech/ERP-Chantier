import { z } from "zod";
import { lireTout } from "@/lib/lecture";
import { supabase } from "@/lib/supabase";
import { COLLECTIONS_SAUVEGARDE, documentSauvegarde } from "../domain/sauvegarde";

const schemaLignes = z.array(z.record(z.string(), z.unknown()));

/**
 * Une collection entière de la société, avec les droits de l'utilisateur. Le
 * nom de la source est dynamique : le typage des tables n'a rien à vérifier
 * ici, le contenu part tel que la base le rend.
 */
async function lireCollection(source: string, select: string, societeId: string): Promise<Record<string, unknown>[]> {
  // Une sauvegarde incomplète serait pire qu'aucune : compte exact et `lireTout` (relecture 4, M1).
  return lireTout(
    (debut, fin) => supabase().from(source as "clients").select(select, { count: "exact" }).eq("societe_id", societeId).order("id").range(debut, fin),
    schemaLignes.element,
    `collection « ${source} » de la sauvegarde`
  );
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
