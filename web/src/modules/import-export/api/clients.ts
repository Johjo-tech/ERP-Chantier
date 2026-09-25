import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { ClientAEcrire, ExistantImport } from "../domain/apercu-clients";

type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

/** 200 par requête : assez pour que l'import tienne en quelques allers-retours, assez peu pour qu'un refus se localise. */
export const LOT_IMPORT_CLIENTS = 200;

const schemaExistant = z.object({
  id: z.string(),
  nom: z.string(),
  siret: z.string().nullable(),
  cadre_facturation: z.enum(["B2C", "B2B_national", "B2G", "B2B_international"]).nullable(),
});

/** Le minimum pour reconnaître un client existant (CLI-32). */
export async function clientsRapprochables(societeId: string): Promise<ExistantImport[]> {
  const { data, error } = await supabase().from("clients").select("id, nom, siret, cadre_facturation").eq("societe_id", societeId);
  if (error) throw error;
  return analyser(z.array(schemaExistant), data, "clients existants");
}

export interface ResultatImportClients {
  crees: number;
  misAJour: number;
  echecs: { noms: string[]; motif: string }[];
}

/** Un refus de la base, dit en français et rapporté aux clients concernés. */
export function motifRefusClients(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === "42501") return "vos droits ne permettent pas d'écrire les clients";
  if (e?.code === "23502") return "une colonne obligatoire est restée vide";
  if (e?.code === "23514" || e?.code === "22P02") return "une valeur n'est pas acceptée par la base";
  return "refus de la base";
}

/**
 * Toutes les lignes d'un lot portent LES MÊMES clés : supabase-js déclare
 * `columns=` sur leur union, et PostgREST écrit NULL pour celles qui manquent
 * à une ligne — une colonne NOT NULL ferait tomber l'insertion entière (23502).
 */
export function uniformiser(societeId: string, lignes: readonly Partial<ClientAEcrire>[]): ClientInsert[] {
  const cles = [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  return lignes.map((l) => {
    const ligne: Record<string, unknown> = { societe_id: societeId };
    for (const cle of cles) ligne[cle] = (l as Record<string, unknown>)[cle] ?? null;
    return ligne as ClientInsert;
  });
}

/**
 * Créations par lots de 200, mises à jour UNE PAR UNE (IMP-14) : « SCI MILLY
 * refusée » vaut mieux qu'« un lot de 38 refusé ». Aucun `upsert` : la table
 * n'a pas de contrainte d'unicité métier, le rapprochement a été tranché avant.
 * Un lot en échec n'arrête pas les autres : un import à moitié fait ET DIT
 * vaut mieux qu'un import annulé sans explication.
 */
export async function importerClients(
  societeId: string,
  aCreer: readonly Partial<ClientAEcrire>[],
  aMettreAJour: readonly { id: string; nom: string; valeurs: Partial<ClientAEcrire> }[]
): Promise<ResultatImportClients> {
  const echecs: ResultatImportClients["echecs"] = [];
  let crees = 0;
  let misAJour = 0;
  const uniformes = uniformiser(societeId, aCreer);

  for (let i = 0; i < uniformes.length; i += LOT_IMPORT_CLIENTS) {
    const lot = uniformes.slice(i, i + LOT_IMPORT_CLIENTS);
    const { data, error } = await supabase().from("clients").insert(lot).select("id");
    if (error) {
      console.error("Import de clients : lot refusé", error);
      echecs.push({ noms: lot.map((c) => c.nom), motif: motifRefusClients(error) });
    } else crees += data.length;
  }

  for (const { id, nom, valeurs } of aMettreAJour) {
    const { data, error } = await supabase().from("clients").update(valeurs).eq("id", id).select("id");
    if (error || !data.length) {
      if (error) console.error("Import de clients : mise à jour refusée", error);
      // Une mise à jour que la RLS écarte ne lève rien : elle ne touche simplement aucune ligne.
      echecs.push({ noms: [nom], motif: error ? motifRefusClients(error) : motifRefusClients({ code: "42501" }) });
    } else misAJour++;
  }
  return { crees, misAJour, echecs };
}
