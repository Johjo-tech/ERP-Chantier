import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { lireInfosEntreprise } from "@/modules/societes/api/reglages";

/**
 * Le gérant et son téléphone : l'ancienne fiche les rangeait dans le document
 * libre `societe_settings.infos_entreprise` (clés `gerant`, `gerantTelephone`),
 * et le PPSPS les y relit (`chantiers/api/liens.ts`). Aucune colonne ne les
 * porte : on écrit donc PAR FUSION, comme les réglages — le reste du document
 * (logo hérité, réglages, documents légaux d'avant) reste intact.
 */
export const schemaGerant = z.object({ gerant: z.string(), gerantTelephone: z.string() });
export type Gerant = z.infer<typeof schemaGerant>;

const schemaLecture = z.object({ gerant: z.string().optional(), gerantTelephone: z.string().optional() }).loose();

export function gerantDepuisInfos(infos: Json): Gerant {
  const r = schemaLecture.safeParse(infos ?? {});
  return { gerant: r.success ? (r.data.gerant ?? "") : "", gerantTelephone: r.success ? (r.data.gerantTelephone ?? "") : "" };
}

export async function lireGerant(societeId: string): Promise<Gerant> {
  return gerantDepuisInfos(await lireInfosEntreprise(societeId));
}

export async function enregistrerGerant(societeId: string, g: Gerant): Promise<void> {
  const infos = await lireInfosEntreprise(societeId);
  const base = infos && typeof infos === "object" && !Array.isArray(infos) ? infos : {};
  const suivant = { ...base, gerant: g.gerant.trim(), gerantTelephone: g.gerantTelephone.trim() };
  const { data, error } = await supabase()
    .from("societe_settings")
    .upsert({ societe_id: societeId, infos_entreprise: suivant as Json }, { onConflict: "societe_id" })
    .select("societe_id");
  if (error) throw error;
  if (!data?.length) throw { code: "42501", message: "Aucune ligne modifiée" };
}
