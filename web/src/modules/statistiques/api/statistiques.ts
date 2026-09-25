import { z } from "zod";
import { clientStatistiques, supabase, type Client } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaCaMois, schemaIndicateurs, type CaMois, type Indicateurs } from "../domain/indicateurs";
import type { Bornes } from "../domain/periodes";
import { schemaActivite, schemaStatClient, type Activite, type StatClient } from "../domain/pilotage";
import { schemaCaEquipe, schemaStatConducteur, schemaStatMetier, type CaEquipe, type StatConducteur, type StatMetier } from "../domain/statistiques";

/**
 * Les agrégats du pilotage et des statistiques, calculés PAR LA BASE
 * (proposition 20260926080000, SECURITY INVOKER : la RLS s'applique, et une
 * garde refuse qui n'a pas « statistiques / voir »). Rien n'est recalculé ici.
 */

const periode = (societeId: string, b: Bornes) => ({ p_societe: societeId, p_du: b.du, p_au: b.au });

export async function lireIndicateurs(societeId: string, jour: string, client: Client = supabase()): Promise<Indicateurs> {
  const { data, error } = await clientStatistiques(client).rpc("stats_indicateurs", { p_societe: societeId, p_jour: jour });
  if (error) throw error;
  const [ligne] = analyser(z.array(schemaIndicateurs), data, "indicateurs du tableau de bord");
  if (!ligne) throw new Error("Les indicateurs du tableau de bord sont vides.");
  return ligne;
}

export async function lireCaParMois(societeId: string, b: Bornes, client: Client = supabase()): Promise<CaMois[]> {
  const { data, error } = await clientStatistiques(client).rpc("stats_ca_par_mois", periode(societeId, b));
  if (error) throw error;
  return analyser(z.array(schemaCaMois), data, "chiffre d'affaires par mois");
}

export async function lireActivite(societeId: string, limite: number, client: Client = supabase()): Promise<Activite[]> {
  const { data, error } = await clientStatistiques(client).rpc("stats_activite_recente", { p_societe: societeId, p_limite: limite });
  if (error) throw error;
  return analyser(z.array(schemaActivite), data, "activité récente");
}

export async function lireParClient(societeId: string, b: Bornes, limite: number | null, client: Client = supabase()): Promise<StatClient[]> {
  const { data, error } = await clientStatistiques(client).rpc("stats_par_client", { ...periode(societeId, b), p_limite: limite });
  if (error) throw error;
  return analyser(z.array(schemaStatClient), data, "statistiques par client");
}

export async function lireParConducteur(societeId: string, b: Bornes, jour: string, client: Client = supabase()): Promise<StatConducteur[]> {
  const { data, error } = await clientStatistiques(client).rpc("stats_par_conducteur", { ...periode(societeId, b), p_jour: jour });
  if (error) throw error;
  return analyser(z.array(schemaStatConducteur), data, "statistiques par conducteur");
}

export async function lireParMetier(societeId: string, b: Bornes, jour: string, client: Client = supabase()): Promise<StatMetier[]> {
  const { data, error } = await clientStatistiques(client).rpc("stats_par_metier", { ...periode(societeId, b), p_jour: jour });
  if (error) throw error;
  return analyser(z.array(schemaStatMetier), data, "statistiques par métier");
}

export async function lireCaParEquipe(societeId: string, b: Bornes, client: Client = supabase()): Promise<CaEquipe[]> {
  const { data, error } = await clientStatistiques(client).rpc("stats_ca_par_equipe", periode(societeId, b));
  if (error) throw error;
  return analyser(z.array(schemaCaEquipe), data, "chiffre d'affaires par équipe");
}
